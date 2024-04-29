#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ResourceStack } from '../lib/stacks/resourceStack';
import { OverviewStack } from '../lib/stacks/overviewStack';
import { CdkConfig } from '../lib/utils/config';

const app = new cdk.App();

const resourceStack = new ResourceStack(app, 'SampleResourceStack', {envProps: CdkConfig.getEnvironment()});
const overviewStack = new OverviewStack(app, 'SampleOverviewStack', {resourceStack: resourceStack});
