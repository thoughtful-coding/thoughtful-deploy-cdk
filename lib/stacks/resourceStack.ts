import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3Notifications from 'aws-cdk-lib/aws-s3-notifications';
import { CorsHttpMethod, HttpApi, HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { Construct } from 'constructs';
import { EnvironmentProps } from '../utils/config';


export interface ResourceStackProps extends StackProps {
  envProps: EnvironmentProps;
}


export class ResourceStack extends Stack {

  readonly inputBucket: s3.Bucket;
  readonly outputBucket: s3.Bucket;
  readonly tranformationCounterTable: dynamodb.Table;
  readonly pongScoreTable: dynamodb.Table;
  readonly dockerRepository: ecr.IRepository;
  readonly sampleAppAPI: HttpApi;

  readonly fileTriggerLambda: lambda.Function;
  readonly apiTransformationLambda: lambda.Function;
  readonly pongScoreGetLambda: lambda.Function;
  readonly pongScoreSetLambda: lambda.Function;

  constructor(scope: Construct, id: string, props: ResourceStackProps) {
    super(scope, id, props);
  
    // Create input/output buckets
    this.inputBucket = new s3.Bucket(
      this,
      `${props.envProps.account}-${props.envProps.region}-transformation-input-bucket`,
      {
        removalPolicy: RemovalPolicy.RETAIN
        
      }
    );
    this.outputBucket = new s3.Bucket(
      this,
      `${props.envProps.account}-${props.envProps.region}-transformation-output-bucket`,
      {
        removalPolicy: RemovalPolicy.RETAIN
      }
    );
    
    // Create lambda using ECR repo
    this.tranformationCounterTable = new dynamodb.Table(this, 'TransformationCounterTable', {
      partitionKey: { name: 'file_type', type: dynamodb.AttributeType.STRING },
      tableName: 'TransformationCounterTable',
      removalPolicy: RemovalPolicy.RETAIN, 
    }); 
    
    this.pongScoreTable = new dynamodb.Table(this, 'PongScoreTable', {
      partitionKey: { name: 'user', type: dynamodb.AttributeType.STRING },
      tableName: 'PongScoreTable',
      removalPolicy: RemovalPolicy.RETAIN, 
    }); 

    this.dockerRepository = new ecr.Repository(
      this,
      `SampleAppDockerRepository`,
      {
        repositoryName: `sample_app_src_rep-${props.envProps.account}-${props.envProps.region}`,
        removalPolicy: RemovalPolicy.RETAIN,
      }
    )
    
    this.sampleAppAPI = new HttpApi(this, 'SampleAppAPI', {
      apiName: 'SampleAppAPI',
      corsPreflight: {
        allowOrigins: ['https://eric-rizzi.github.io'],
        allowMethods: [
          CorsHttpMethod.GET,
          CorsHttpMethod.POST,
          CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['Content-Type'],
        maxAge: Duration.days(10),
      },
    }); 

    this.fileTriggerLambda = new lambda.DockerImageFunction(
      this,
      "FileTriggerTest",
      {
        code: lambda.DockerImageCode.fromEcr(this.dockerRepository, {tagOrDigest: "latest", cmd: ["aws_src_sample.lambdas.s3_put_lambda.s3_put_lambda_handler"]}),
        environment: {
          OUTPUT_BUCKET_NAME: this.outputBucket.bucketName,
          FILE_TYPE_COUNTER_TABLE_NAME: this.tranformationCounterTable.tableName,
          REGION: "us-east-2",
        },
        timeout: Duration.seconds(40),
      }
    );

    this.apiTransformationLambda = new lambda.DockerImageFunction(
      this,
      "APITransformationLambda",
      {
        code: lambda.DockerImageCode.fromEcr(this.dockerRepository, {tagOrDigest: "latest", cmd: ["aws_src_sample.lambdas.apig_post_lambda.api_post_lambda_handler"]}),
        environment: {
          OUTPUT_BUCKET_NAME: this.outputBucket.bucketName,
          FILE_TYPE_COUNTER_TABLE_NAME: this.tranformationCounterTable.tableName,
          REGION: "us-east-2",
        },
        timeout: Duration.seconds(40),
      }
    );

    this.pongScoreGetLambda = new lambda.DockerImageFunction(
      this,
      "PongScoreGetLambda",
      {
        code: lambda.DockerImageCode.fromEcr(this.dockerRepository, {tagOrDigest: "latest", cmd: ["aws_src_sample.lambdas.pong_score_lambda.pong_score_lambda_handler"]}),//change this
        environment: {
          OUTPUT_BUCKET_NAME: this.outputBucket.bucketName,
          REGION: "us-east-2",
          PONG_SCORE_TABLE_NAME: this.pongScoreTable.tableName,
        },
        timeout: Duration.seconds(40),
      }
    );
    
    this.pongScoreSetLambda = new lambda.DockerImageFunction(
      this,
      "PongScoreSetLambda",
      {
        code: lambda.DockerImageCode.fromEcr(this.dockerRepository, {tag: "latest", cmd: ["aws_src_sample.lambdas.pong_score_lambda.pong_score_get_lambda_handler"]}),//change this
        environment: {
          OUTPUT_BUCKET_NAME: this.outputBucket.bucketName,
          REGION: "us-east-2",
          PONG_SCORE_TABLE_NAME: this.pongScoreTable.tableName,
        },
        timeout: Duration.seconds(40),
      }
    );

    const lambdaintegrationpostcsv = new HttpLambdaIntegration('lambdaintegration',
      this.apiTransformationLambda,
    );
    const lambdaintegrationgetpong = new HttpLambdaIntegration('lambdaintegration',
      this.pongScoreGetLambda,
    );
    const lambdaintegrationpostpong = new HttpLambdaIntegration('lambdaintegration',
      this.pongScoreSetLambda,
    );

    this.sampleAppAPI.addRoutes({
      path: '/transform_csv', // Specify the path for the route
      methods: [HttpMethod.POST], // Specify the HTTP methods for the route
      integration: lambdaintegrationpostcsv,
    });

    this.sampleAppAPI.addRoutes({
      path: '/pongscore', // Specify the path for the route
      methods: [HttpMethod.GET], // Specify the HTTP methods for the route
      integration: lambdaintegrationgetpong,
    });
    this.sampleAppAPI.addRoutes({
      path: '/pongscore', // Specify the path for the route
      methods: [HttpMethod.POST], // Specify the HTTP methods for the route
      integration: lambdaintegrationpostpong,
    });
    
    this.inputBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED_PUT,
      new s3Notifications.LambdaDestination(this.fileTriggerLambda),
    )
    
    const lambdas = [this.fileTriggerLambda, this.apiTransformationLambda, this.pongScoreGetLambda];
    for (const lambda of lambdas) {
      lambda.addToRolePolicy(new iam.PolicyStatement({
        actions: ['s3:GetObject', 's3:PutObject'],
        resources: [`${this.inputBucket.bucketArn}/*`,`${this.outputBucket.bucketArn}/*`],
      }));
      lambda.addToRolePolicy(new iam.PolicyStatement({
        actions: ['ecr:GetDownloadUrlForLayer',
        'ecr:BatchGetImage',
        'ecr:BatchCheckLayerAvailability'],
        resources: [this.dockerRepository.repositoryArn],
      }));
      lambda.addToRolePolicy(new iam.PolicyStatement({
        actions: ['ecr:GetAuthorizationToken'],
        resources: ['*'],
      }));

      this.outputBucket.grantWrite(lambda);
      this.tranformationCounterTable.grantFullAccess(lambda);
      this.pongScoreTable.grantFullAccess(lambda);
    }
    
    this.inputBucket.grantRead(this.fileTriggerLambda);
  }
}
