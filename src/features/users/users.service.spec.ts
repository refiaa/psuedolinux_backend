import { NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';

import type { UserQueryDto } from './dto/user-query.dto';
import { UserEntity } from './user.entity';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let repository: Partial<Repository<UserEntity>>;

  beforeEach(() => {
    repository = {
      findOne: jest.fn()
    };
    service = new UsersService(repository as Repository<UserEntity>);
  });

  it('should return requested fields when user exists', async () => {
    const user: UserEntity = Object.assign(new UserEntity(), {
      id: 'a4f1e5d9-54a4-4d61-b4e4-fd974420fe12',
      displayName: 'Alice',
      email: 'alice@example.com',
      isActive: true,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-02T00:00:00Z')
    });
    (repository.findOne as jest.Mock).mockResolvedValue(user);

    const dto: UserQueryDto = {
      id: user.id,
      fields: ['id', 'displayName', 'email']
    };

    const result = await service.findUserView(dto);
    expect(result).toEqual({
      id: user.id,
      displayName: 'Alice',
      email: 'alice@example.com'
    });
  });

  it('should throw NotFoundException when user missing', async () => {
    (repository.findOne as jest.Mock).mockResolvedValue(null);

    const dto: UserQueryDto = {
      id: '00000000-0000-0000-0000-000000000000',
      fields: ['id']
    };

    await expect(service.findUserView(dto)).rejects.toBeInstanceOf(NotFoundException);
  });
});
