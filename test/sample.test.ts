import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as Sample from '../lib/sample-stack';

test('SQS Queue and Lambda created', () => {
  const app = new cdk.App();
  // WHEN
  const stack = new Sample.SampleStack(app, 'MyTestStack');
  // THEN

  const template = Template.fromStack(stack);
});
