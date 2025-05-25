// In lib/stacks/lambda-compute-stack.ts
import * as cdk from 'aws-cdk-lib';
import { Stack, StackProps, Duration } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { ApiRoute } from '../constructs/api-route';
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { Construct } from 'constructs';
import { EnvironmentProps } from '../utils/config';
import { BasicDockerLambda } from '../constructs/lambda';
import { GOOGLE_CLIENT_ID } from '../utils/config';

export interface ComputeStackProps extends StackProps {
  readonly envProps: EnvironmentProps;
  readonly dockerRepository: ecr.IRepository;
  readonly imageTag: string;
  readonly outputBucket: s3.IBucket;
  readonly transformationCounterTable: dynamodb.ITable;
  readonly userProgressTable: dynamodb.ITable;
  readonly learningEntriesTable: dynamodb.ITable;
  readonly httpApi: apigwv2.HttpApi;
}

export class ComputeStack extends Stack {
  public readonly apiTransformationLambda: lambda.IFunction;
  public readonly userProgressLambda: lambda.IFunction;
  public readonly learningEntriesLambda: lambda.IFunction;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    const apiTransformationLambdaConstruct = new BasicDockerLambda(this, 'ApiTransformationLambda', {
      functionNameSuffix: 'ApiTransform',
      description: 'Handles API POST requests for CSV transformations.',
      dockerRepository: props.dockerRepository,
      imageTag: props.imageTag,
      cmd: ['aws_src_sample.lambdas.apig_post_lambda.api_post_lambda_handler'],
      environment: {
        OUTPUT_BUCKET_NAME: props.outputBucket.bucketName,
        FILE_TYPE_COUNTER_TABLE_NAME: props.transformationCounterTable.tableName,
      },
      memorySize: 512,
    });
    this.apiTransformationLambda = apiTransformationLambdaConstruct.function;
    // Grant specific permissions
    props.outputBucket.grantWrite(this.apiTransformationLambda);
    props.transformationCounterTable.grantReadWriteData(this.apiTransformationLambda);

    const userProgressLambdaConstruct = new BasicDockerLambda(this, 'UserProgressLambda', {
      functionNameSuffix: 'UserProgress',
      description: 'Handles API requests that GET/SET user data',
      dockerRepository: props.dockerRepository,
      imageTag: props.imageTag,
      cmd: ['aws_src_sample.lambdas.user_progress_lambda.user_progress_lambda_handler'],
      environment: {
        USER_PROGRESS_TABLE_NAME: props.userProgressTable.tableName,
      },
    });
    this.userProgressLambda = userProgressLambdaConstruct.function;
    // Grant specific permissions
    props.userProgressTable.grantReadWriteData(this.userProgressLambda);

    const learningEntriesLambdaConstruct = new BasicDockerLambda(this, 'LearningEntriesLambda', {
      functionNameSuffix: 'LearningEntries',
      description: 'Handles API requests that GET/SET learning entries (journal)',
      dockerRepository: props.dockerRepository,
      imageTag: props.imageTag,
      cmd: ['aws_src_sample.lambdas.learning_entries_lambda.learning_entries_lambda_handler'],
      environment: {
        LEARNING_ENTRIES_TABLE_NAME: props.learningEntriesTable.tableName,
      },
    });
    this.learningEntriesLambda = learningEntriesLambdaConstruct.function;
    // Grant specific permissions
    props.learningEntriesTable.grantReadWriteData(this.learningEntriesLambda);

    new ApiRoute(this, 'TransformCsvRoute', {
      httpApi: props.httpApi,
      routePath: '/transform_csv',
      methods: [apigwv2.HttpMethod.POST],
      handler: this.apiTransformationLambda,
    });

    const googleJwtAuthorizer = new HttpJwtAuthorizer('GoogleJwtAuthorizer', 'https://accounts.google.com', {
      jwtAudience: [GOOGLE_CLIENT_ID],
    });

    new ApiRoute(this, 'UserProgressRoute', {
      httpApi: props.httpApi,
      routePath: '/progress',
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST, apigwv2.HttpMethod.PUT],
      handler: this.userProgressLambda,
      authorizer: googleJwtAuthorizer,
    });

    new ApiRoute(this, 'LearningEntryRoute', {
      httpApi: props.httpApi,
      routePath: '/learning-entries',
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST, apigwv2.HttpMethod.PUT],
      handler: this.learningEntriesLambda,
      authorizer: googleJwtAuthorizer,
    });

    // CloudFormation Outputs for Lambda Function ARNs (optional, but can be useful)

    new cdk.CfnOutput(this, 'ApiTransformationLambdaArn', {
      value: this.apiTransformationLambda.functionArn,
    });

    new cdk.CfnOutput(this, 'UserProgressLambdaArn', {
      value: this.userProgressLambda.functionArn,
    });

    new cdk.CfnOutput(this, 'LearningEntriesLambdaArn', {
      value: this.learningEntriesLambda.functionArn,
    });
  }
}
