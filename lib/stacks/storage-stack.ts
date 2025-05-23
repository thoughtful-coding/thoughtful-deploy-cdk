import { RemovalPolicy, Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { EnvironmentProps } from '../utils/config'; // Assuming your config.ts is in lib/utils/

import { StandardBucket } from '../constructs/s3-bucket';
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

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    const outputBucketName = `${props.envProps.account}-${props.envProps.region}-transformation-output-bucket`;
    const outputBucketNameConstruct = new StandardBucket(this, 'TransformationOutputBucket', {
      bucketName: outputBucketName,
      removalPolicy: RemovalPolicy.RETAIN,
      publicReadAccess: true,
    });
    this.outputBucket = outputBucketNameConstruct.bucket;

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

    const learningEntriesTableConstruct = new StandardTable(this, 'LearningEntriesTableConstruct', {
      tableName: 'LearningEntriesTable',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'entryId', type: dynamodb.AttributeType.STRING },
      removalPolicy: RemovalPolicy.RETAIN,
    });
    this.learningEntriesTable = learningEntriesTableConstruct.table;

    // CloudFormation Outputs for easy reference
    new CfnOutput(this, 'OutputBucketNameOutput', {
      value: this.outputBucket.bucketName,
      description: 'Name of the S3 output bucket',
    });
    new CfnOutput(this, 'TransformationCounterTableNameOutput', {
      value: this.transformationCounterTable.tableName,
      description: 'Name of the TransformationCounter DynamoDB table',
    });
  }
}
