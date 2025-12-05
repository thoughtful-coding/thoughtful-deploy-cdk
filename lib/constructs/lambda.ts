// lib/constructs/basic-docker-lambda.ts
import { Duration, Stack } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { Construct } from 'constructs';

export interface BasicDockerLambdaProps {
  readonly functionNameSuffix: string; // To help create a unique function name
  readonly description?: string;
  readonly dockerRepository: ecr.IRepository;
  readonly imageTag: string;
  readonly cmd: string[];
  readonly environment?: { [key: string]: string };
  readonly timeout?: Duration;
  readonly memorySize?: number; // in MB
  // Add any other common props you want to abstract
}

export class BasicDockerLambda extends Construct {
  public readonly function: lambda.IFunction;

  constructor(scope: Construct, id: string, props: BasicDockerLambdaProps) {
    super(scope, id);

    const region = Stack.of(this).region; // Get region from the stack context

    this.function = new lambda.DockerImageFunction(this, id, {
      functionName: `${Stack.of(this).stackName}-${props.functionNameSuffix}`,
      description: props.description,
      code: lambda.DockerImageCode.fromEcr(props.dockerRepository, {
        tagOrDigest: props.imageTag,
        cmd: props.cmd,
      }),
      environment: {
        REGION: region,
        ...props.environment,
      },
      timeout: props.timeout ?? Duration.seconds(60),
      memorySize: props.memorySize ?? 256,
    });
  }
}
