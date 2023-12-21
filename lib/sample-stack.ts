import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';


const PYTHON_CODE = `
def simple_handler(event, context) -> None:
    print("Hello there dude!")
    print(event)
    print(context)
`


export class SampleStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here

    // example resource
    const queue = new sqs.Queue(
      this,
      'SampleQueue',
      {
        visibilityTimeout: Duration.seconds(300),

      },
    );

    const lamba = new lambda.Function(
      this,
      "SampleLambda",
      {
        runtime: lambda.Runtime.PYTHON_3_10,
        memorySize: 1024,
        timeout: Duration.minutes(1),
        handler: 'index.simple_handler',  // Note: inline code saved to `index.py` file
        code: lambda.Code.fromInline(PYTHON_CODE),   
      },
    );

    lamba.addEventSource(new SqsEventSource(queue));
    
    // Permissions
    queue.grantConsumeMessages(lamba);
  }
}