import { Module } from '@nestjs/common';

import { AntiReplayService } from './anti-replay.service';

@Module({
  providers: [AntiReplayService],
  exports: [AntiReplayService]
})
export class AntiReplayModule {}
