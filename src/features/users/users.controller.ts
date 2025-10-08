import { BadRequestException, Controller, Get } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { SecureContext } from '../../common/security/secure-context.decorator';
import { SecureRequestState } from '../../common/security/secure-request.interface';
import { UserQueryDto } from './dto/user-query.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async getUser(@SecureContext() secureContext: SecureRequestState): Promise<Record<string, unknown>> {
    const dto = this.mapQuery(secureContext.payload.query);
    return this.usersService.findUserView(dto);
  }

  private mapQuery(rawQuery: unknown): UserQueryDto {
    const dto = plainToInstance(UserQueryDto, rawQuery);
    const errors = validateSync(dto, {
      whitelist: true,
      forbidNonWhitelisted: true
    });
    if (errors.length > 0) {
      throw new BadRequestException(errors.map((error) => Object.values(error.constraints ?? {})).flat());
    }
    return dto;
  }
}
