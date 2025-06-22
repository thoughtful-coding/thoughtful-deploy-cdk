import { RemovalPolicy, Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { EnvironmentProps } from '../utils/config';

import { StandardTable } from '../constructs/dynamodb-table';

export interface StorageStackProps extends StackProps {
  readonly envProps: EnvironmentProps;
}

export class StorageStack extends Stack {
  // Public properties to expose created resources to other stacks
  public readonly outputBucket: s3.IBucket;
  public readonly transformationCounterTable: dynamodb.ITable;
  public readonly userProgressTable: dynamodb.ITable;
  public readonly progressTable: dynamodb.ITable;
  public readonly learningEntriesTable: dynamodb.ITable;
  public readonly primmSubmissionsTable: dynamodb.ITable;
  public readonly throttlingStoreTable: dynamodb.ITable;
  public readonly refreshTokenTable: dynamodb.ITable;
  public readonly userPermissionsTable: dynamodb.ITable;

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

    const progressTableConstruct = new StandardTable(this, 'ProgressTableConstruct', {
      tableName: 'ProgressTable',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'unitId', type: dynamodb.AttributeType.STRING },
      removalPolicy: RemovalPolicy.RETAIN,
    });
    this.progressTable = progressTableConstruct.table;

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

    const primmSubmissionsTableConstruct = new StandardTable(this, 'UserPrimmSubmissionsTable', {
      tableName: 'UserPrimmSubmissions',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      // SK: lessonId#sectionId#primmExampleId#timestamp
      sortKey: { name: 'submissionCompositeKey', type: dynamodb.AttributeType.STRING },
    });
    this.primmSubmissionsTable = primmSubmissionsTableConstruct.table;

    const throttlingStoreTableConstruct = new StandardTable(this, 'ThrottlingStoreTable', {
      tableName: 'ThrottlingStore',
      partitionKey: { name: 'entityActionId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'periodType#periodIdentifier', type: dynamodb.AttributeType.STRING },
      timeToLiveAttribute: 'ttl',
    });
    this.throttlingStoreTable = throttlingStoreTableConstruct.table;

    const refreshTokenTableConstruct = new StandardTable(this, 'RefreshTokenTableConstruct', {
      tableName: 'RefreshTokenTable',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'tokenId', type: dynamodb.AttributeType.STRING },
      timeToLiveAttribute: 'ttl',
      removalPolicy: RemovalPolicy.DESTROY,
    });
    this.refreshTokenTable = refreshTokenTableConstruct.table;

    const userPermissionsTable = new dynamodb.Table(this, 'UserPermissionsTable', {
      tableName: 'UserPermissions',
      partitionKey: { name: 'granterUserId', type: dynamodb.AttributeType.STRING },
      // SK value will be 'permissionType#granteeUserId'
      sortKey: { name: 'granteePermissionTypeComposite', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.RETAIN,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
    });

    // Add GSI for querying by granteeUserId (e.g., teacherId)
    userPermissionsTable.addGlobalSecondaryIndex({
      indexName: 'GranteePermissionsIndex',
      partitionKey: { name: 'granteeUserId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'granterPermissionTypeComposite', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
    this.userPermissionsTable = userPermissionsTable;

    // Output the table names (optional but useful)

    new CfnOutput(this, 'OutputBucketNameOutput', {
      value: this.outputBucket.bucketName,
      description: 'Name of the S3 output bucket',
    });

    new CfnOutput(this, 'TransformationCounterTableNameOutput', {
      value: this.transformationCounterTable.tableName,
      description: 'Name of the TransformationCounter DynamoDB table',
    });

    new CfnOutput(this, 'ProgressTableNameOutput', {
      value: this.progressTable.tableName,
      description: 'Name of the Progress DynamoDB table',
    });

    new CfnOutput(this, 'LearningEntryVersionsTableNameOutput', {
      value: this.learningEntriesTable.tableName,
      description: 'Name of the LearningEntryVersions DynamoDB table',
    });

    new CfnOutput(this, 'PrimmSubmissionsTableNameOutput', {
      value: this.primmSubmissionsTable.tableName,
      description: 'Name of the PrimmSubmissions DynamoDB table',
    });

    new CfnOutput(this, 'ThrottlingStoreTableNameOutput', {
      value: this.throttlingStoreTable.tableName,
      description: 'Name of the ThrottlingStore DynamoDB table',
    });
  }
}
