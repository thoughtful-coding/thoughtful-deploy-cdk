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


const PYTHON_CODE = `
import os


def simple_handler(event, context) -> None:
    print("Hello there dude!")
    print(event)
    print(context)
    print("Will output to bucket", os.environ["OUTPUT_BUCKET_NAME"])
`


export class SampleStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
  
    // The code that defines your stack goes here
    const inputBucket = new s3.Bucket(
      this,
      'uclsinputbucket-1234',
      {
        removalPolicy: RemovalPolicy.RETAIN
        
      }
    )
    const outputBucket = new s3.Bucket(
      this,
      'uclsoutputbucket-1234',
      {
        removalPolicy: RemovalPolicy.RETAIN
      }
    )
    const dockerrepository = ecr.Repository.fromRepositoryName(this, 'randomrepository','danieluclsdockerrepository')
    // example resource
    const queue = new sqs.Queue(
      this,
      'SampleQueue',
      {
        visibilityTimeout: Duration.seconds(300),

      },
    );
    
    const samples3lambda = new lambda.DockerImageFunction(
      this,
      "FileTriggerTest",
      {
        code: lambda.DockerImageCode.fromEcr
        (dockerrepository, {tag:"latest"}),
        environment: {
          OUTPUT_BUCKET_NAME: outputBucket.bucketName,
        },
      }
    );
    `new lambda.Function(
      this,
      "S3Lambda",
      {
        runtime: lambda.Runtime.PYTHON_3_11,
        memorySize: 1024,
        timeout: Duration.minutes(1),
        handler: 'index.simple_handler',  // Note: inline code saved to file
        code: lambda.Code.fromInline(PYTHON_CODE),
        environment: {
          OUTPUT_BUCKET_NAME: outputBucket.bucketName,
        }
      },
    );
    `
    
    
    
    
    
    

    
    inputBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED_PUT,
      new s3Notifications.LambdaDestination(samples3lambda),
    )
    
    // Permissions
    queue.grantConsumeMessages(samples3lambda);
    samples3lambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['s3:GetObject', 's3:PutObject'],
      resources: [`${inputBucket.bucketArn}/*`,`${outputBucket.bucketArn}/*`],
    }));
    samples3lambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ecr:GetDownloadUrlForLayer',
      'ecr:BatchGetImage',
      'ecr:BatchCheckLayerAvailability'],
      resources: [dockerrepository.repositoryArn],
    }));
    samples3lambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ecr:GetAuthorizationToken'],
      resources: ['*'],
    }));
    inputBucket.grantRead(samples3lambda);
    outputBucket.grantWrite(samples3lambda);

    samples3lambda.addEventSource(new SqsEventSource(queue));
  }
}