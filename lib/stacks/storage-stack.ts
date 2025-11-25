import { RemovalPolicy, Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { EnvironmentProps } from '../utils/config';

import { StandardTable } from '../constructs/dynamodb-table';

export interface StorageStackProps extends StackProps {
  readonly envProps: EnvironmentProps;
}

export class StorageStack extends Stack {
  // Public properties to expose created resources to other stacks
  public readonly userProgressTable: dynamodb.ITable;
  public readonly learningEntriesTable: dynamodb.ITable;
  public readonly primmSubmissionsTable: dynamodb.ITable;
  public readonly throttleTable: dynamodb.ITable;
  public readonly refreshTokenTable: dynamodb.ITable;
  public readonly userPermissionsTable: dynamodb.ITable;
  public readonly firstSolutionsTable: dynamodb.ITable;
  public readonly userProfileTable: dynamodb.ITable;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    // DynamoDB Tables

    const userProgressTableConstruct = new StandardTable(this, 'UserProgressTable', {
      tableName: 'UserProgressTable',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'unitId', type: dynamodb.AttributeType.STRING },
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

    const primmSubmissionsTableConstruct = new StandardTable(this, 'PrimmSubmissionsTable', {
      tableName: 'PrimmSubmissionsTable',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      // SK: lessonId#sectionId#primmExampleId#timestamp
      sortKey: { name: 'submissionCompositeKey', type: dynamodb.AttributeType.STRING },
    });
    this.primmSubmissionsTable = primmSubmissionsTableConstruct.table;

    const throttleTableConstruct = new StandardTable(this, 'ThrottleTable', {
      tableName: 'ThrottleTable',
      partitionKey: { name: 'entityActionId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'periodType#periodIdentifier', type: dynamodb.AttributeType.STRING },
      timeToLiveAttribute: 'ttl',
    });
    this.throttleTable = throttleTableConstruct.table;

    const refreshTokenTableConstruct = new StandardTable(this, 'RefreshTokenTable', {
      tableName: 'RefreshTokenTable',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'tokenId', type: dynamodb.AttributeType.STRING },
      timeToLiveAttribute: 'ttl',
      removalPolicy: RemovalPolicy.DESTROY,
    });
    this.refreshTokenTable = refreshTokenTableConstruct.table;

    const userPermissionsTable = new dynamodb.Table(this, 'UserPermissionsTable', {
      tableName: 'UserPermissionsTable',
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

    const firstSolutionsTableConstruct = new StandardTable(this, 'FirstSolutionsTable', {
      tableName: 'FirstSolutionsTable',
      partitionKey: { name: 'sectionCompositeKey', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      removalPolicy: RemovalPolicy.RETAIN,
    });
    this.firstSolutionsTable = firstSolutionsTableConstruct.table;

    const userProfileTableConstruct = new StandardTable(this, 'UserProfileTable', {
      tableName: 'UserProfileTable',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      removalPolicy: RemovalPolicy.RETAIN,
    });
    this.userProfileTable = userProfileTableConstruct.table;

    // Output the table names (optional but useful)

    new CfnOutput(this, 'LearningEntriesTableNameOutput', {
      value: this.learningEntriesTable.tableName,
      description: 'Name of the LearningEntriesTable DynamoDB table',
    });

    new CfnOutput(this, 'PrimmSubmissionsTableNameOutput', {
      value: this.primmSubmissionsTable.tableName,
      description: 'Name of the PrimmSubmissionsTable DynamoDB table',
    });
  }
}
