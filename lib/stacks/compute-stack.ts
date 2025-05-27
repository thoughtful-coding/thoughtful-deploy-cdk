import * as cdk from 'aws-cdk-lib';
import { Stack, StackProps } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { EnvironmentProps } from '../utils/config';
import { BasicDockerLambda } from '../constructs/lambda';
import { ManagedSecret } from '../constructs/secret-manager';

export interface ComputeStackProps extends StackProps {
  readonly envProps: EnvironmentProps;
  readonly dockerRepository: ecr.IRepository;
  readonly imageTag: string;
  readonly outputBucket: s3.IBucket;
  readonly transformationCounterTable: dynamodb.ITable;
  readonly userProgressTable: dynamodb.ITable;
  readonly learningEntriesTable: dynamodb.ITable;
  readonly throttlingStoreTable: dynamodb.ITable;
  readonly chatbotApiKeySecret: ManagedSecret;
}

export class ComputeStack extends Stack {
  public readonly apiTransformationLambda: lambda.IFunction;
  public readonly userProgressLambda: lambda.IFunction;
  public readonly learningEntriesLambda: lambda.IFunction;
  public readonly primmFeedbackLambda: lambda.IFunction;

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
        CHATBOT_API_KEY_SECRETS_ARN: props.chatbotApiKeySecret.secretArn,
        THROTTLING_TABLE_NAME: props.throttlingStoreTable.tableName,
      },
    });
    this.learningEntriesLambda = learningEntriesLambdaConstruct.function;
    // Grant specific permissions
    props.learningEntriesTable.grantReadWriteData(this.learningEntriesLambda);
    props.chatbotApiKeySecret.grantRead(this.learningEntriesLambda);
    props.throttlingStoreTable.grantReadWriteData(this.learningEntriesLambda);

    const primmFeedbackLambdaConstruct = new BasicDockerLambda(this, 'PRIMMFeedbackLambda', {
      functionNameSuffix: 'PRIMMFeedback',
      description: 'Handles API requests that POST feedback for PRIMM exercises',
      dockerRepository: props.dockerRepository,
      imageTag: props.imageTag,
      cmd: ['aws_src_sample.lambdas.primm_feedback_lambda.primm_feedback_lambda_handler'],
      environment: {
        CHATBOT_API_KEY_SECRETS_ARN: props.chatbotApiKeySecret.secretArn,
        THROTTLING_TABLE_NAME: props.throttlingStoreTable.tableName,
      },
    });
    this.primmFeedbackLambda = primmFeedbackLambdaConstruct.function;
    // Grant specific permissions
    props.chatbotApiKeySecret.grantRead(this.primmFeedbackLambda);
    props.throttlingStoreTable.grantReadWriteData(this.primmFeedbackLambda);

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

    new cdk.CfnOutput(this, 'PRIMMFeedbackLambdaArn', {
      value: this.primmFeedbackLambda.functionArn,
    });
  }
}
