#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ResourceStack } from '../lib/stacks/resourceStack';
import { ComputeStack } from '../lib/stacks/computeStack';
import { OverviewStack } from '../lib/stacks/overviewStack';

const app = new cdk.App();
const resourceStack = new ResourceStack(app, 'SampleStack');
const computeStack = new ComputeStack(app, 'ComputeStack', {resourceStack: resourceStack});
const overviewStack = new OverviewStack(app, 'OverviewStack', {resourceStack: resourceStack,computeStack: computeStack});
