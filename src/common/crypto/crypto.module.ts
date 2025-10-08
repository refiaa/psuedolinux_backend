import { Module } from '@nestjs/common';

import { AeadService } from './aead.service';
import { CryptoService } from './crypto.service';
import { HmacService } from './hmac.service';
import { KeyDerivationService } from './key-derivation.service';

@Module({
  providers: [KeyDerivationService, HmacService, AeadService, CryptoService],
  exports: [KeyDerivationService, HmacService, AeadService, CryptoService]
})
export class CryptoModule {}
