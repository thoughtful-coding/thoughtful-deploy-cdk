import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { EnvironmentProps, GOOGLE_CLIENT_ID } from '../utils/config';
import { BasicDockerLambda } from '../constructs/lambda';
import { ManagedSecret } from '../constructs/secret-manager';

export interface ComputeStackProps extends StackProps {
  readonly envProps: EnvironmentProps;
  readonly dockerRepository: ecr.IRepository;
  readonly imageTag: string;
  readonly userProgressTable: dynamodb.ITable;
  readonly learningEntriesTable: dynamodb.ITable;
  readonly primmSubmissionsTable: dynamodb.ITable;
  readonly throttleTable: dynamodb.ITable;
  readonly refreshTokenTable: dynamodb.ITable;
  readonly userPermissionsTable: dynamodb.ITable;
  readonly chatbotApiKeySecret: ManagedSecret;
  readonly jwtSecret: ManagedSecret;
}

export class ComputeStack extends Stack {
  public readonly userProgressLambda: lambda.IFunction;
  public readonly learningEntriesLambda: lambda.IFunction;
  public readonly primmFeedbackLambda: lambda.IFunction;
  public readonly instructorPortalLambda: lambda.IFunction;
  public readonly authLambda: lambda.IFunction;
  public readonly authorizerLambda: lambda.IFunction;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    const userProgressLambdaConstruct = new BasicDockerLambda(this, 'UserProgressLambda', {
      functionNameSuffix: 'UserProgress',
      description: 'Handles API requests that GET/SET user data',
      dockerRepository: props.dockerRepository,
      imageTag: props.imageTag,
      cmd: ['thoughtful_backend.lambdas.user_progress_lambda.user_progress_lambda_handler'],
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
      cmd: ['thoughtful_backend.lambdas.learning_entries_lambda.learning_entries_lambda_handler'],
      environment: {
        CHATBOT_API_KEY_SECRET_ARN: props.chatbotApiKeySecret.secretArn,
        THROTTLE_TABLE_NAME: props.throttleTable.tableName,
        LEARNING_ENTRIES_TABLE_NAME: props.learningEntriesTable.tableName,
      },
    });
    this.learningEntriesLambda = learningEntriesLambdaConstruct.function;
    // Grant specific permissions
    props.learningEntriesTable.grantReadWriteData(this.learningEntriesLambda);
    props.chatbotApiKeySecret.grantRead(this.learningEntriesLambda);
    props.throttleTable.grantReadWriteData(this.learningEntriesLambda);

    const primmFeedbackLambdaConstruct = new BasicDockerLambda(this, 'PRIMMFeedbackLambda', {
      functionNameSuffix: 'PRIMMFeedback',
      description: 'Handles API requests that POST feedback for PRIMM exercises',
      dockerRepository: props.dockerRepository,
      imageTag: props.imageTag,
      cmd: ['thoughtful_backend.lambdas.primm_feedback_lambda.primm_feedback_lambda_handler'],
      environment: {
        CHATBOT_API_KEY_SECRET_ARN: props.chatbotApiKeySecret.secretArn,
        THROTTLE_TABLE_NAME: props.throttleTable.tableName,
        PRIMM_SUBMISSIONS_TABLE_NAME: props.primmSubmissionsTable.tableName,
      },
    });
    this.primmFeedbackLambda = primmFeedbackLambdaConstruct.function;
    // Grant specific permissions
    props.chatbotApiKeySecret.grantRead(this.primmFeedbackLambda);
    props.throttleTable.grantReadWriteData(this.primmFeedbackLambda);
    props.primmSubmissionsTable.grantWriteData(this.primmFeedbackLambda);

    const instructorPortalLambdaConstruct = new BasicDockerLambda(this, 'InstructorPortalLambda', {
      functionNameSuffix: 'InstructorPortal',
      description: 'Handles API requests for the instructor portal',
      dockerRepository: props.dockerRepository,
      imageTag: props.imageTag,
      cmd: ['thoughtful_backend.lambdas.instructor_portal_lambda.instructor_portal_lambda_handler'],
      environment: {
        USER_PERMISSIONS_TABLE_NAME: props.userPermissionsTable.tableName,
        USER_PROGRESS_TABLE_NAME: props.userProgressTable.tableName,
        LEARNING_ENTRIES_TABLE_NAME: props.learningEntriesTable.tableName,
        PRIMM_SUBMISSIONS_TABLE_NAME: props.primmSubmissionsTable.tableName,
      },
    });
    this.instructorPortalLambda = instructorPortalLambdaConstruct.function;
    // Grant specific permissions
    props.userPermissionsTable.grantReadData(this.instructorPortalLambda);
    props.userProgressTable.grantReadData(this.instructorPortalLambda);
    props.learningEntriesTable.grantReadWriteData(this.instructorPortalLambda);
    props.primmSubmissionsTable.grantReadWriteData(this.instructorPortalLambda);

    const authLambdaConstruct = new BasicDockerLambda(this, 'AuthLambda', {
      functionNameSuffix: 'AuthHandler',
      description: 'Handles user login, logout, and token refresh.',
      dockerRepository: props.dockerRepository,
      imageTag: props.imageTag,
      cmd: ['thoughtful_backend.lambdas.auth_lambda.auth_lambda_handler'],
      environment: {
        REFRESH_TOKEN_TABLE_NAME: props.refreshTokenTable.tableName,
        JWT_SECRET_ARN: props.jwtSecret.secretArn,
        GOOGLE_CLIENT_ID: GOOGLE_CLIENT_ID,
      },
    });
    this.authLambda = authLambdaConstruct.function;
    props.jwtSecret.grantRead(this.authLambda);
    props.refreshTokenTable.grantReadWriteData(this.authLambda);

    const authorizerLambdaConstruct = new BasicDockerLambda(this, 'AuthorizerLambda', {
      functionNameSuffix: 'TokenAuthorizer',
      description: 'Validates custom JWT access tokens for API Gateway.',
      dockerRepository: props.dockerRepository,
      imageTag: props.imageTag,
      cmd: ['thoughtful_backend.lambdas.authorizer_lambda.authorizer_lambda_handler'],
      environment: {
        JWT_SECRET_ARN: props.jwtSecret.secretArn,
      },
      timeout: Duration.seconds(10), // Authorizers should be fast
    });
    this.authorizerLambda = authorizerLambdaConstruct.function;
    // Grant specific permissions
    props.jwtSecret.grantRead(this.authorizerLambda);
  }
}
