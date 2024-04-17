import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as s3Notifications from 'aws-cdk-lib/aws-s3-notifications';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { Construct } from 'constructs';
import { HttpApi } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';



export class SampleStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
  
    // Create input/output buckets
    const inputBucket = new s3.Bucket(
      this,
      'uclsinputbucket-1234',
      {
        removalPolicy: RemovalPolicy.RETAIN
        
      }
    );
    const outputBucket = new s3.Bucket(
      this,
      'uclsoutputbucket-1234',
      {
        removalPolicy: RemovalPolicy.RETAIN
      }
    );
    
    // Create lambda using ECR repo
    const dataTable = new dynamodb.Table(this, 'MyTable', {
      partitionKey: { name: 'file_type', type: dynamodb.AttributeType.STRING },
      tableName: 'fileformatcountertable',
      removalPolicy: RemovalPolicy.RETAIN, 
    }); 
    
    const pongScoreTable = new dynamodb.Table(this, 'MyTable2', {
      partitionKey: { name: 'user', type: dynamodb.AttributeType.STRING },
      tableName: 'scoretable',
      removalPolicy: RemovalPolicy.RETAIN, 
    }); 
    const dockerRepository = ecr.Repository.fromRepositoryName(
      this,
      'randomrepository',
      'danieluclsdockerrepository',
    );
    const samples3lambda = new lambda.DockerImageFunction(
      this,
      "FileTriggerTest",
      {
        code: lambda.DockerImageCode.fromEcr(dockerRepository, {tag: "latest", cmd: ["aws_src_sample.lambdas.s3_put_lambda.s3_put_lambda_handler"]}),
        environment: {
          OUTPUT_BUCKET_NAME: outputBucket.bucketName,
          FILE_TYPE_COUNTER_TABLE_NAME: dataTable.tableName,
          REGION: "us-east-2",
        },
        timeout: Duration.seconds(40),
      }
    );

    const apigLambda = new lambda.DockerImageFunction(
      this,
      "APIGPostLambda",
      {
        code: lambda.DockerImageCode.fromEcr(dockerRepository, {tag: "latest", cmd: ["aws_src_sample.lambdas.apig_post_lambda.api_post_lambda_handler"]}),
        environment: {
          OUTPUT_BUCKET_NAME: outputBucket.bucketName,
          FILE_TYPE_COUNTER_TABLE_NAME: dataTable.tableName,
          REGION: "us-east-2",
        },
        timeout: Duration.seconds(40),
      }
    );
    const pongscoregetLambda = new lambda.DockerImageFunction(
      this,
      "pongscorelambda",
      {
        code: lambda.DockerImageCode.fromEcr(dockerRepository, {tag: "latest", cmd: ["aws_src_sample.lambdas.pong_score_lambda.pong_score_lambda_handler"]}),//change this
        environment: {
          OUTPUT_BUCKET_NAME: outputBucket.bucketName,
          //FILE_TYPE_COUNTER_TABLE_NAME: dataTable.tableName, no
          REGION: "us-east-2",
          PONG_SCORE_TABLE_NAME: pongScoreTable.tableName,
        },
        timeout: Duration.seconds(40),
      }
    );
    
    const filegetapi = new HttpApi(this, 'MyApi', {
      apiName: 'MyService',
      corsPreflight: {
        //allowOrigins: ['https://holycrap872.github.io'],
        allowMethods: [apigatewayv2.CorsHttpMethod.GET, apigatewayv2.CorsHttpMethod.POST, apigatewayv2.CorsHttpMethod.OPTIONS],
        //allowHeaders: ['Content-Type'],
        maxAge: Duration.days(10),
      },
    }); 

    const lambdaintegrationpostcsv = new HttpLambdaIntegration('lambdaintegration',
    apigLambda,
  );
    const lambdaintegrationgetpong = new HttpLambdaIntegration('lambdaintegration',
    pongscoregetLambda,
  );

    filegetapi.addRoutes({
      path: '/csv', // Specify the path for the route
      methods: [apigatewayv2.HttpMethod.POST], // Specify the HTTP methods for the route
      integration: lambdaintegrationpostcsv,
    });

    filegetapi.addRoutes({
      path: '/pongscore', // Specify the path for the route
      methods: [apigatewayv2.HttpMethod.GET], // Specify the HTTP methods for the route
      integration: lambdaintegrationgetpong,
    });
    
    
    inputBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED_PUT,
      new s3Notifications.LambdaDestination(samples3lambda),
    )
    
    // Permissions
    const lambdas = [samples3lambda, apigLambda];
    for (const lambda of lambdas) {
      lambda.addToRolePolicy(new iam.PolicyStatement({
        actions: ['s3:GetObject', 's3:PutObject'],
        resources: [`${inputBucket.bucketArn}/*`,`${outputBucket.bucketArn}/*`],
      }));
      lambda.addToRolePolicy(new iam.PolicyStatement({
        actions: ['ecr:GetDownloadUrlForLayer',
        'ecr:BatchGetImage',
        'ecr:BatchCheckLayerAvailability'],
        resources: [dockerRepository.repositoryArn],
      }));
      lambda.addToRolePolicy(new iam.PolicyStatement({
        actions: ['ecr:GetAuthorizationToken'],
        resources: ['*'],
      }));

      outputBucket.grantWrite(lambda);
      dataTable.grantFullAccess(lambda);
    }
    
    inputBucket.grantRead(samples3lambda);
  }
}