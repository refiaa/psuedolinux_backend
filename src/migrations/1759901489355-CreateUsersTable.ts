import type { MigrationInterface, QueryRunner } from 'typeorm';
import { Table, TableIndex } from 'typeorm';

export class CreateUsersTable1759901489355 implements MigrationInterface {
  name = 'CreateUsersTable1759901489355';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()'
          },
          {
            name: 'display_name',
            type: 'varchar',
            length: '128',
            isNullable: false
          },
          {
            name: 'email',
            type: 'varchar',
            length: '256',
            isNullable: false
          },
          {
            name: 'avatar_url',
            type: 'varchar',
            length: '512',
            isNullable: true
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: 'true'
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()'
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'now()'
          }
        ]
      })
    );

    await queryRunner.createIndex(
      'users',
      new TableIndex({
        name: 'users_display_name_idx',
        columnNames: ['display_name']
      })
    );

    await queryRunner.createIndex(
      'users',
      new TableIndex({
        name: 'users_email_idx',
        columnNames: ['email'],
        isUnique: true
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('users', 'users_email_idx');
    await queryRunner.dropIndex('users', 'users_display_name_idx');
    await queryRunner.dropTable('users');
  }
}
