import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { Construct } from 'constructs';
import { HttpApi } from 'aws-cdk-lib/aws-apigatewayv2';


export class ResourceStack extends Stack {

  readonly inputBucket: s3.Bucket;
  readonly outputBucket: s3.Bucket;
  readonly dataTable: dynamodb.Table;
  readonly pongScoreTable: dynamodb.Table;
  readonly dockerRepository: ecr.IRepository;
  readonly filegetapi: HttpApi;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
  
    // Create input/output buckets
    this.inputBucket = new s3.Bucket(
      this,
      'uclsinputbucket-1234',
      {
        removalPolicy: RemovalPolicy.RETAIN
        
      }
    );
    this.outputBucket = new s3.Bucket(
      this,
      'uclsoutputbucket-1234',
      {
        removalPolicy: RemovalPolicy.RETAIN
      }
    );
    
    // Create lambda using ECR repo
    this.dataTable = new dynamodb.Table(this, 'MyTable', {
      partitionKey: { name: 'file_type', type: dynamodb.AttributeType.STRING },
      tableName: 'fileformatcountertable',
      removalPolicy: RemovalPolicy.RETAIN, 
    }); 
    
    this.pongScoreTable = new dynamodb.Table(this, 'MyTable2', {
      partitionKey: { name: 'user', type: dynamodb.AttributeType.STRING },
      tableName: 'scoretable',
      removalPolicy: RemovalPolicy.RETAIN, 
    }); 
    this.dockerRepository = ecr.Repository.fromRepositoryName(
      this,
      'randomrepository',
      'danieluclsdockerrepository',
    );

    this.filegetapi = new HttpApi(this, 'MyApi', {
      apiName: 'MyService',
      corsPreflight: {
        allowOrigins: ['https://holycrap872.github.io'],
        allowMethods: [
          apigatewayv2.CorsHttpMethod.GET,
          apigatewayv2.CorsHttpMethod.POST,
          apigatewayv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['Content-Type'],
        maxAge: Duration.days(10),
      },
    }); 
  }
}