import { registerAs } from '@nestjs/config';

type AwsConfig = {
  region: string;
  secretsManagerEndpoint?: string;
  kmsEndpoint?: string;
  secretsManagerSecretId: string;
  kmsKeyId: string;
};

export default registerAs<AwsConfig>('aws', () => ({
  region: process.env.AWS_REGION ?? 'us-east-1',
  secretsManagerEndpoint: process.env.AWS_SECRETS_MANAGER_ENDPOINT,
  kmsEndpoint: process.env.AWS_KMS_ENDPOINT,
  secretsManagerSecretId: process.env.AWS_SECRETS_MANAGER_SECRET_ID ?? '',
  kmsKeyId: process.env.AWS_KMS_KEY_ID ?? ''
}));
