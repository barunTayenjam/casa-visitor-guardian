import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/**
 * Migration to create the user_sessions table used for JWT session validation.
 * Columns are aligned with the UserSession entity (server/src/models/UserSession.ts).
 */
export class CreateUserSessionsTable1700000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'user_sessions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            isGenerated: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'user_id',
            type: 'uuid',
          },
          {
            name: 'refresh_token',
            type: 'varchar',
            length: '255',
            isUnique: true,
          },
          {
            name: 'access_token_hash',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'ip_address',
            type: 'inet',
          },
          {
            name: 'user_agent',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'device_info',
            type: 'jsonb',
            isNullable: true,
            default: "'{}'::jsonb",
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'expires_at',
            type: 'timestamp',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'last_accessed',
            type: 'timestamp',
            default: 'now()',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
        indices: [
          {
            name: 'IDX_user_sessions_user_id',
            columnNames: ['user_id'],
          },
          {
            name: 'IDX_user_sessions_refresh_token',
            columnNames: ['refresh_token'],
          },
          {
            name: 'IDX_user_sessions_expires_at',
            columnNames: ['expires_at'],
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('user_sessions');
  }
}
