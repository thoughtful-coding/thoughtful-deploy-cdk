import * as cdk from 'aws-cdk-lib';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface ManagedSecretProps extends Omit<secretsmanager.SecretProps, 'secretName'> {
  secretName: string; // Make secretName mandatory for the construct
  // Add any other custom properties you want for your managed secrets
  // e.g., tags, specific resource policy requirements
}

export class ManagedSecret extends Construct {
  public readonly secret: secretsmanager.ISecret;
  public readonly secretArn: string;

  constructor(scope: Construct, id: string, props: ManagedSecretProps) {
    super(scope, id);

    this.secret = new secretsmanager.Secret(this, id, {
      ...props,
      secretName: props.secretName,
    });
    this.secretArn = this.secret.secretArn;
  }

  public grantRead(grantee: iam.IGrantable): void {
    this.secret.grantRead(grantee);
  }
}
