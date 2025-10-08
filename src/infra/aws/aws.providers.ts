import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KMSClient } from '@aws-sdk/client-kms';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

import { AWS_KMS, AWS_SECRETS_MANAGER } from './aws.constants';

type AwsConfig = {
  region: string;
  secretsManagerEndpoint?: string;
  kmsEndpoint?: string;
};

export const awsProviders: Provider[] = [
  {
    provide: AWS_SECRETS_MANAGER,
    inject: [ConfigService],
    useFactory: (configService: ConfigService) => {
      const config = configService.get<AwsConfig>('aws');
      if (!config) {
        throw new Error('AWS configuration is missing');
      }
      return new SecretsManagerClient({
        region: config.region,
        endpoint: config.secretsManagerEndpoint
      });
    }
  },
  {
    provide: AWS_KMS,
    inject: [ConfigService],
    useFactory: (configService: ConfigService) => {
      const config = configService.get<AwsConfig>('aws');
      if (!config) {
        throw new Error('AWS configuration is missing');
      }
      return new KMSClient({
        region: config.region,
        endpoint: config.kmsEndpoint
      });
    }
  }
];
