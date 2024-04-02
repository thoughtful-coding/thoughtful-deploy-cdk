import { Duration, RemovalPolicy, Stack, StackProps, aws_s3_notifications } from 'aws-cdk-lib';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as s3Notifications from 'aws-cdk-lib/aws-s3-notifications';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { Construct } from 'constructs';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { S3 } from 'aws-cdk-lib/aws-ses-actions';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { EcrImage } from 'aws-cdk-lib/aws-ecs';
import { HttpApi, HttpIntegrationSubtype } from 'aws-cdk-lib/aws-apigatewayv2';
import { LambdaIntegration } from 'aws-cdk-lib/aws-apigateway';
import { HttpLambdaResponseType } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';



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
    const dataTable = new dynamodb.Table(this, 'MyTable', {
      partitionKey: { name: 'file_type', type: dynamodb.AttributeType.STRING },
      tableName: 'fileformatcountertable',
      removalPolicy: RemovalPolicy.RETAIN, 
    }); 
    

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
          FILE_TYPE_COUNTER_TABLE_NAME: dataTable.tableName,
        },
        timeout: Duration.seconds(40),
      }
    );
    
    //apig
``
    const lambda_function = new lambda.Function(this, 'InlineLambdaFunction', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.lambda_handler',
      code: lambda.Code.fromInline(`
    import json
    import base64

    def lambda_handler(event, context):
    try:
        if 'isBase64Encoded' in event and event['isBase64Encoded']:
            file_content = base64.b64decode(event['body'])
        else:
            file_content = event['body'].encode('utf-8')
        
        print("Received file content:", file_content)

        return {
            'statusCode': 200,
            'body': json.dumps('File processed successfully.')
        }
    except Exception as e:
        print(f"Error processing file: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps('Failed to process the file.')
        }
      `),
    });

    const filegetapi = new HttpApi(this, 'MyApi', {
      apiName: 'MyService',
    }); 
    const lambdaintegration = new HttpLambdaIntegration('lambdaintegration',
     lambda_function,
  );

    filegetapi.addRoutes({
      path: '/csv', // Specify the path for the route
      methods: [apigatewayv2.HttpMethod.POST], // Specify the HTTP methods for the route
      integration: lambdaintegration,
    });
    
    
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
    dataTable.grantFullAccess(samples3lambda);

  }
}