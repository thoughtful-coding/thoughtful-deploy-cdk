import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export interface StandardTableProps extends dynamodb.TableProps {
    // Custom props
}

export class StandardTable extends Construct {
    public readonly table: dynamodb.ITable;

    constructor(scope: Construct, id: string, props: StandardTableProps) {
        super(scope, id);

        this.table = new dynamodb.Table(this, 'Resource', {
            ...props,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            billingMode: props.billingMode ?? dynamodb.BillingMode.PAY_PER_REQUEST,
            encryption: props.encryption ?? dynamodb.TableEncryption.AWS_MANAGED,
        });
    }
}
