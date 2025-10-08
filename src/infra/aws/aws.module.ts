import { Global, Module } from '@nestjs/common';

import { awsProviders } from './aws.providers';

@Global()
@Module({
  providers: [...awsProviders],
  exports: [...awsProviders]
})
export class AwsModule {}
