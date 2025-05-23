import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface StandardBucketProps extends s3.BucketProps {
    // Custom props
}

export class StandardBucket extends Construct {
  public readonly bucket: s3.IBucket;

  constructor(scope: Construct, id: string, props: StandardBucketProps) {
    super(scope, id);

    this.bucket = new s3.Bucket(this, 'Resource', {
      ...props,
      versioned: props.versioned ?? false,
      encryption: props.encryption ?? s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: props.blockPublicAccess ?? s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: props.enforceSSL ?? true,
    });
  }
}