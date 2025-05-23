import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface StandardBucketProps extends s3.BucketProps {
  // Custom props
}

export class StandardBucket extends Construct {
  public readonly bucket: s3.IBucket;

  constructor(scope: Construct, id: string, props: StandardBucketProps) {
    super(scope, id);

    // Determine default for blockPublicAccess based on whether publicReadAccess is being set
    let effectiveBlockPublicAccess = props.blockPublicAccess;
    if (props.publicReadAccess === true && props.blockPublicAccess === undefined) {
      effectiveBlockPublicAccess = undefined;
    } else if (props.blockPublicAccess === undefined && props.publicReadAccess !== true) {
      effectiveBlockPublicAccess = s3.BlockPublicAccess.BLOCK_ALL;
    }

    let effectiveObjectOwnership = props.objectOwnership;
    if (props.publicReadAccess === true && props.objectOwnership === undefined) {
      effectiveObjectOwnership = s3.ObjectOwnership.BUCKET_OWNER_ENFORCED;
    }

    this.bucket = new s3.Bucket(this, 'Resource', {
      ...props,
      encryption: props.encryption ?? s3.BucketEncryption.S3_MANAGED,
      enforceSSL: props.enforceSSL ?? true,
      blockPublicAccess: effectiveBlockPublicAccess,
      objectOwnership: effectiveObjectOwnership,
    });
  }
}
