import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as s3Notifications from 'aws-cdk-lib/aws-s3-notifications';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { Construct } from 'constructs';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { ResourceStack } from './resourceStack';


export interface ComputeStackProps extends StackProps {
    readonly resourceStack: ResourceStack;
}


export class ComputeStack extends Stack {

  readonly fileTriggerLambda: lambda.Function;
  readonly stlPostLambda: lambda.Function;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);
  
    this.fileTriggerLambda = new lambda.DockerImageFunction(
      this,
      "FileTriggerTest",
      {
        code: lambda.DockerImageCode.fromEcr(props.resourceStack.dockerRepository, {tag: "latest", cmd: ["aws_src_sample.lambdas.s3_put_lambda.s3_put_lambda_handler"]}),
        environment: {
          OUTPUT_BUCKET_NAME: props.resourceStack.outputBucket.bucketName,
          FILE_TYPE_COUNTER_TABLE_NAME: props.resourceStack.dataTable.tableName,
          REGION: "us-east-2",
        },
        timeout: Duration.seconds(40),
      }
    );

    this.stlPostLambda = new lambda.DockerImageFunction(
      this,
      "APIGPostLambda",
      {
        code: lambda.DockerImageCode.fromEcr(props.resourceStack.dockerRepository, {tag: "latest", cmd: ["aws_src_sample.lambdas.apig_post_lambda.api_post_lambda_handler"]}),
        environment: {
          OUTPUT_BUCKET_NAME: props.resourceStack.outputBucket.bucketName,
          FILE_TYPE_COUNTER_TABLE_NAME: props.resourceStack.dataTable.tableName,
          REGION: "us-east-2",
        },
        timeout: Duration.seconds(40),
      }
    );
    const pongscoregetLambda = new lambda.DockerImageFunction(
      this,
      "pongscorelambda",
      {
        code: lambda.DockerImageCode.fromEcr(props.resourceStack.dockerRepository, {tag: "latest", cmd: ["aws_src_sample.lambdas.pong_score_lambda.pong_score_lambda_handler"]}),//change this
        environment: {
          OUTPUT_BUCKET_NAME: props.resourceStack.outputBucket.bucketName,
          //FILE_TYPE_COUNTER_TABLE_NAME: dataTable.tableName, no
          REGION: "us-east-2",
          PONG_SCORE_TABLE_NAME: props.resourceStack.pongScoreTable.tableName,
        },
        timeout: Duration.seconds(40),
      }
    );
    const pongscorepostLambda = new lambda.DockerImageFunction(
      this,
      "pongscorelambda2",
      {
        code: lambda.DockerImageCode.fromEcr(props.resourceStack.dockerRepository, {tag: "latest", cmd: ["aws_src_sample.lambdas.pong_score_lambda.pong_score_get_lambda_handler"]}),//change this
        environment: {
          OUTPUT_BUCKET_NAME: props.resourceStack.outputBucket.bucketName,
          //FILE_TYPE_COUNTER_TABLE_NAME: dataTable.tableName, no
          REGION: "us-east-2",
          PONG_SCORE_TABLE_NAME: props.resourceStack.pongScoreTable.tableName,
        },
        timeout: Duration.seconds(40),
      }
    );
    

    const lambdaintegrationpostcsv = new HttpLambdaIntegration('lambdaintegration',
      this.stlPostLambda,
    );
    const lambdaintegrationgetpong = new HttpLambdaIntegration('lambdaintegration',
      pongscoregetLambda,
    );
    const lambdaintegrationpostpong = new HttpLambdaIntegration('lambdaintegration',
      pongscorepostLambda,
    );

    props.resourceStack.filegetapi.addRoutes({
      path: '/csv', // Specify the path for the route
      methods: [apigatewayv2.HttpMethod.POST], // Specify the HTTP methods for the route
      integration: lambdaintegrationpostcsv,
    });

    props.resourceStack.filegetapi.addRoutes({
      path: '/pongscore', // Specify the path for the route
      methods: [apigatewayv2.HttpMethod.GET], // Specify the HTTP methods for the route
      integration: lambdaintegrationgetpong,
    });
    props.resourceStack.filegetapi.addRoutes({
      path: '/pongscore', // Specify the path for the route
      methods: [apigatewayv2.HttpMethod.POST], // Specify the HTTP methods for the route
      integration: lambdaintegrationpostpong,
    });
    
    
    props.resourceStack.inputBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED_PUT,
      new s3Notifications.LambdaDestination(this.fileTriggerLambda),
    )
    
    // Permissions
    const lambdas = [this.fileTriggerLambda, this.stlPostLambda, pongscoregetLambda];
    for (const lambda of lambdas) {
      lambda.addToRolePolicy(new iam.PolicyStatement({
        actions: ['s3:GetObject', 's3:PutObject'],
        resources: [`${props.resourceStack.inputBucket.bucketArn}/*`,`${props.resourceStack.outputBucket.bucketArn}/*`],
      }));
      lambda.addToRolePolicy(new iam.PolicyStatement({
        actions: ['ecr:GetDownloadUrlForLayer',
        'ecr:BatchGetImage',
        'ecr:BatchCheckLayerAvailability'],
        resources: [props.resourceStack.dockerRepository.repositoryArn],
      }));
      lambda.addToRolePolicy(new iam.PolicyStatement({
        actions: ['ecr:GetAuthorizationToken'],
        resources: ['*'],
      }));

      props.resourceStack.outputBucket.grantWrite(lambda);
      props.resourceStack.dataTable.grantFullAccess(lambda);
      props.resourceStack.pongScoreTable.grantFullAccess(lambda);
    }
    
    props.resourceStack.inputBucket.grantRead(this.fileTriggerLambda);
  }
}