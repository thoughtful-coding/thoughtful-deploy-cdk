import { Duration, RemovalPolicy, Stack, StackProps, aws_s3_notifications } from 'aws-cdk-lib';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as s3Notifications from 'aws-cdk-lib/aws-s3-notifications';
import { Construct } from 'constructs';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { S3 } from 'aws-cdk-lib/aws-ses-actions';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { EcrImage } from 'aws-cdk-lib/aws-ecs';



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
    const dockerRepository = ecr.Repository.fromRepositoryName(
      this,
      'randomrepository',
      'danieluclsdockerrepository',
    );
    const samples3lambda = new lambda.DockerImageFunction(
      this,
      "FileTriggerTest",
      {
        code: lambda.DockerImageCode.fromEcr(dockerRepository, {tag: "latest"}),
        environment: {
          OUTPUT_BUCKET_NAME: outputBucket.bucketName,
        },
        timeout: Duration.seconds(30),
      }
    );


    inputBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED_PUT,
      new s3Notifications.LambdaDestination(samples3lambda),
    )
    
    // Permissions
    samples3lambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['s3:GetObject', 's3:PutObject'],
      resources: [`${inputBucket.bucketArn}/*`,`${outputBucket.bucketArn}/*`],
    }));
    samples3lambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ecr:GetDownloadUrlForLayer',
      'ecr:BatchGetImage',
      'ecr:BatchCheckLayerAvailability'],
      resources: [dockerRepository.repositoryArn],
    }));
    samples3lambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ecr:GetAuthorizationToken'],
      resources: ['*'],
    }));
    inputBucket.grantRead(samples3lambda);
    outputBucket.grantWrite(samples3lambda);
  }
}