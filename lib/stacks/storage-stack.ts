import { RemovalPolicy, Duration, Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { EnvironmentProps } from '../utils/config';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';

import { StandardTable } from '../constructs/dynamodb-table';

export interface StorageStackProps extends StackProps {
  readonly envProps: EnvironmentProps;
}

export class StorageStack extends Stack {
  // Public properties to expose created resources to other stacks
  public readonly outputBucket: s3.IBucket;
  public readonly transformationCounterTable: dynamodb.ITable;
  public readonly userProgressTable: dynamodb.ITable;
  public readonly learningEntriesTable: dynamodb.ITable;

  public readonly apiEndpoint: string;
  public readonly httpApi: apigwv2.HttpApi;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    const outputBucketName = `${props.envProps.account}-${props.envProps.region}-transformation-output-bucket`;
    this.outputBucket = new s3.Bucket(this, 'TransformationOutputBucket', {
      bucketName: outputBucketName,
      removalPolicy: RemovalPolicy.RETAIN,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      publicReadAccess: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS_ONLY,
    });

    // DynamoDB Tables
    const transformationTableConstruct = new StandardTable(this, 'TransformationCounterTableConstruct', {
      tableName: 'TransformationCounterTable',
      partitionKey: {
        name: 'file_type',
        type: dynamodb.AttributeType.STRING,
      },
      removalPolicy: RemovalPolicy.RETAIN,
    });
    this.transformationCounterTable = transformationTableConstruct.table;

    const userProgressTableConstruct = new StandardTable(this, 'UserProgressTableConstruct', {
      tableName: 'UserProgressTable',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      removalPolicy: RemovalPolicy.RETAIN,
    });
    this.userProgressTable = userProgressTableConstruct.table;

    const learningEntriesTable = new dynamodb.Table(this, 'LearningEntriesTable', {
      tableName: 'LearningEntriesTable',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'versionId', type: dynamodb.AttributeType.STRING }, // SK: lessonId#sectionId#createdAtISO
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    learningEntriesTable.addGlobalSecondaryIndex({
      indexName: 'UserFinalLearningEntriesIndex',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'finalEntryCreatedAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
    this.learningEntriesTable = learningEntriesTable;

    // Output the table names (optional but useful)

    new CfnOutput(this, 'OutputBucketNameOutput', {
      value: this.outputBucket.bucketName,
      description: 'Name of the S3 output bucket',
    });
    new CfnOutput(this, 'TransformationCounterTableNameOutput', {
      value: this.transformationCounterTable.tableName,
      description: 'Name of the TransformationCounter DynamoDB table',
    });
    new CfnOutput(this, 'LearningEntryVersionsTableNameOutput', {
      value: this.learningEntriesTable.tableName,
      description: 'Name of the LearningEntryVersions DynamoDB table',
    });

    // API for various apps

    this.httpApi = new apigwv2.HttpApi(this, 'StorageStackHttpApi', {
      apiName: 'StorageStackHttpApi',
      description: 'HTTP API for the various apps',
      corsPreflight: {
        allowOrigins: ['https://eric-rizzi.github.io', 'http://localhost:5173'],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.OPTIONS,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.PUT,
        ],
        allowHeaders: ['Content-Type', 'Authorization'],
        maxAge: Duration.days(10),
      },
    });
    this.apiEndpoint = this.httpApi.url!; // The ! asserts that apiEndpoint is not undefined

    new CfnOutput(this, 'StorageStackHttpApiOutputEndpoint', {
      value: this.apiEndpoint,
      description: 'Endpoint URL for the Sample App API',
      exportName: 'StorageStackHttpApiEndpoint',
    });
  }
}
