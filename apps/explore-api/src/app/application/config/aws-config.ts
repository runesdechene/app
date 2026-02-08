import { AwsCredentialIdentity, Provider } from '@aws-sdk/types';

export const I_AWS_CONFIG = Symbol('I_AWS_CONFIG');

export type AWSConfig = {
  deploymentEnvironment: 'prod' | 'dev';
  credentials: AwsCredentialIdentity | Provider<AwsCredentialIdentity>;
  s3: {
    region: string;
  };
};
