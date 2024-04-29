import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import {ResourceStack} from '../lib/stacks/resourceStack';

test('SQS Queue and Lambda created', () => {
  const app = new cdk.App();
  // WHEN
  const stack = new ResourceStack(app, 'MyTestStack', {envProps: {account: "1111", "region": "us-east-2"}});
  // THEN

  const template = Template.fromStack(stack);
});
