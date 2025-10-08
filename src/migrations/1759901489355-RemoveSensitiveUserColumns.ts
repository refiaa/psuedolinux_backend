import type { MigrationInterface, QueryRunner } from 'typeorm';
import { TableColumn, TableIndex } from 'typeorm';

export class RemoveSensitiveUserColumns1759901489355 implements MigrationInterface {
  name = 'RemoveSensitiveUserColumns1759901489355';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('users');
    if (!table) {
      return;
    }

    if (table.indices.find((index) => index.name === 'users_email_idx')) {
      await queryRunner.dropIndex('users', 'users_email_idx');
    }

    const columnsToDrop = ['email', 'avatar_url', 'is_active', 'created_at', 'updated_at'];
    for (const columnName of columnsToDrop) {
      const column = table.findColumnByName(columnName);
      if (column) {
        await queryRunner.dropColumn('users', column);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('users');
    if (!table) {
      return;
    }

    const columnsToAdd: TableColumn[] = [
      new TableColumn({
        name: 'email',
        type: 'varchar',
        length: '256',
        isNullable: false
      }),
      new TableColumn({
        name: 'avatar_url',
        type: 'varchar',
        length: '512',
        isNullable: true
      }),
      new TableColumn({
        name: 'is_active',
        type: 'boolean',
        default: 'true'
      }),
      new TableColumn({
        name: 'created_at',
        type: 'timestamptz',
        default: 'now()'
      }),
      new TableColumn({
        name: 'updated_at',
        type: 'timestamptz',
        default: 'now()'
      })
    ];

    for (const column of columnsToAdd) {
      if (!table.findColumnByName(column.name)) {
        await queryRunner.addColumn('users', column);
      }
    }

    if (!table.indices.find((index) => index.name === 'users_email_idx')) {
      await queryRunner.createIndex(
        'users',
        new TableIndex({
          name: 'users_email_idx',
          columnNames: ['email'],
          isUnique: true
        })
      );
    }
  }
}
