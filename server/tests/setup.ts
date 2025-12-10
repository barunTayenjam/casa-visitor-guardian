import { DataSource } from 'typeorm';
import { User, Role, Session, AuditLog, PasswordHistory } from '../../server/src/models';

// Test database configuration
const testDataSource = new DataSource({
  type: 'postgres',
  host: process.env.TEST_DB_HOST || 'localhost',
  port: parseInt(process.env.TEST_DB_PORT || '5432'),
  username: process.env.TEST_DB_USER || 'postgres',
  password: process.env.TEST_DB_PASSWORD || 'password',
  database: process.env.TEST_DB_NAME || 'sentryvision_test',
  entities: [User, Role, Session, AuditLog, PasswordHistory],
  synchronize: false,
  logging: false,
  dropSchema: true,
  migrationsRun: true
});

// Global test setup
beforeAll(async () => {
  await testDataSource.initialize();
});

// Global test teardown
afterAll(async () => {
  await testDataSource.destroy();
});

// Clean database between tests
beforeEach(async () => {
  const entities = testDataSource.entityMetadatas;
  
  for (const entity of entities) {
    const repository = testDataSource.getRepository(entity.name);
    await repository.query(`DELETE FROM ${entity.tableName};`);
    
    // Reset auto-increment sequences
    if (entity.tableName !== 'migrations') {
      try {
        await repository.query(`ALTER SEQUENCE ${entity.tableName}_id_seq RESTART WITH 1;`);
      } catch (error) {
        // Ignore if sequence doesn't exist
      }
    }
  }
});

// Export test utilities
export { testDataSource };

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.AUDIT_INTEGRITY_SECRET = 'test-audit-secret';
process.env.TOTP_ENCRYPTION_KEY = 'test-totp-encryption-key-32';
process.env.BACKUP_CODE_ENCRYPTION_KEY = 'test-backup-code-key-32';