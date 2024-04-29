import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Dashboard , GraphWidget, } from 'aws-cdk-lib/aws-cloudwatch';
import { ResourceStack } from './resourceStack';
import { ComputeStack } from './computeStack';


export interface OverviewStackProps extends StackProps {
    readonly resourceStack: ResourceStack;
    readonly computeStack: ComputeStack;
}


export class OverviewStack extends Stack {
  constructor(scope: Construct, id: string, props: OverviewStackProps) {
    super(scope, id, props);

    // Create a new CloudWatch Dashboard
    const dashboard = new Dashboard(this, 'LambdaDashboard', {
      dashboardName: 'LambdaActivityDashboard'
    });
  
    // Widget for Lambda Invocations
    const invocationWidget = new GraphWidget({
      title: 'STL Lambda Invocations',
      left: [
        props.computeStack.stlPostLambda.metricInvocations({
          statistic: 'Sum',
          period: Duration.minutes(1)
        })
      ]
    });
    dashboard.addWidgets(invocationWidget)
  
    // Widget for Lambda Errors
    const errorWidget = new GraphWidget({
      title: 'STL Lambda Invocation Errors',
      left: [
        props.computeStack.stlPostLambda.metricErrors({
        statistic: 'Sum',
         period: Duration.minutes(1)
        })
      ]
    });
  
      // Add widgets to the dashboard
    dashboard.addWidgets(errorWidget);
  }
}