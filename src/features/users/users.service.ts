import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { UserQueryDto } from './dto/user-query.dto';
import { UserEntity } from './user.entity';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(UserEntity) private readonly repository: Repository<UserEntity>) {}

  async findUserView(query: UserQueryDto): Promise<Record<string, unknown>> {
    const user = await this.repository.findOne({ where: { id: query.id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return query.fields.reduce<Record<string, unknown>>((accumulator, field) => {
      const value = user[field as keyof UserEntity];
      accumulator[field] = value as unknown;
      return accumulator;
    }, {});
  }
}
