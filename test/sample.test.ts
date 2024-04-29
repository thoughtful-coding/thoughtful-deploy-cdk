import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as Sample from '../lib/stacks/resourceStack';

test('SQS Queue and Lambda created', () => {
  const app = new cdk.App();
  // WHEN
  const stack = new Sample.ResourceStack(app, 'MyTestStack');
  // THEN

  const template = Template.fromStack(stack);
});
