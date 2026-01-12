import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { AppDataSource } from '../database.js';

// User interface
export interface User {
  id: string;
  username: string;
  email: string;
  password: string;
  role: 'admin' | 'user' | 'viewer';
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// JWT Payload interface
export interface JWTPayload {
  userId: string;
  username: string;
  role: string;
  iat?: number;
  exp?: number;
}

// Authentication result interface
export interface AuthResult {
  success: boolean;
  user?: Omit<User, 'password'>;
  token?: string;
  refreshToken?: string;
  error?: string;
}

// Seed default users to database (runs once on startup)
async function seedDefaultUsers() {
  if (config.nodeEnv !== 'development') {
    return;
  }

  try {
    if (!AppDataSource.isInitialized) {
      logger.warn('Database not initialized, skipping user seed', 'AuthService');
      return;
    }

    const userRepository = AppDataSource.getRepository('users');
    const roleRepository = AppDataSource.getRepository('roles');

    const existingUsers = await userRepository.count();
    if (existingUsers > 0) {
      logger.info(`Database has ${existingUsers} users, skipping seed`, 'AuthService');
      return;
    }

    let adminRole = await roleRepository.findOne({ where: { name: 'admin' } });
    if (!adminRole) {
      adminRole = await roleRepository.save({
        name: 'admin',
        description: 'Administrator role',
        permissions: ['*'],
        isActive: true
      });
    }

    let userRole = await roleRepository.findOne({ where: { name: 'user' } });
    if (!userRole) {
      userRole = await roleRepository.save({
        name: 'user',
        description: 'Standard user role',
        permissions: ['read:own', 'write:own'],
        isActive: true
      });
    }

    const adminPasswordHash = await bcrypt.hash('admin123', 12);
    const userPasswordHash = await bcrypt.hash('user123', 12);

    await userRepository.save({
      username: 'admin',
      email: 'admin@security.local',
      password_hash: adminPasswordHash,
      salt: 'dev-salt',
      role_id: adminRole.id,
      status: 'active',
      mfa_enabled: false,
      email_verified: true,
      failed_login_attempts: 0,
      created_at: new Date(),
      updated_at: new Date()
    });

    await userRepository.save({
      username: 'user',
      email: 'user@security.local',
      password_hash: userPasswordHash,
      salt: 'dev-salt',
      role_id: userRole.id,
      status: 'active',
      mfa_enabled: false,
      email_verified: true,
      failed_login_attempts: 0,
      created_at: new Date(),
      updated_at: new Date()
    });

    logger.warn('Default development users seeded to database. Change passwords in production!', 'AuthService');
  } catch (error) {
    logger.error(`Failed to seed default users: ${error}`, 'AuthService');
  }
}

seedDefaultUsers().catch(err => {
  logger.error(`Failed to seed default users: ${err}`, 'AuthService');
});

export class AuthService {
  generateToken(user: User): string {
    const payload: JWTPayload = {
      userId: user.id,
      username: user.username,
      role: user.role
    };

    try {
      return jwt.sign(payload, config.jwtSecret, {
        expiresIn: config.jwtExpiresIn,
        issuer: 'home-security-system',
        audience: 'home-security-client'
      } as jwt.SignOptions);
    } catch (error) {
      logger.error(`JWT signing error: ${error}`, 'AuthService');
      throw error;
    }
  }

  verifyToken(token: string): JWTPayload | null {
    try {
      const decoded = jwt.verify(token, config.jwtSecret, {
        issuer: 'home-security-system',
        audience: 'home-security-client'
      }) as JWTPayload;

      return decoded;
    } catch (error) {
      logger.warn(`JWT verification failed: ${error}`, 'AuthService');
      return null;
    }
  }

  hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, config.security.bcryptRounds);
  }

  comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  async register(userData: {
    username: string;
    email: string;
    password: string;
    role?: 'admin' | 'user' | 'viewer';
  }): Promise<AuthResult> {
    try {
      if (!AppDataSource.isInitialized) {
        return { success: false, error: 'Database not available' };
      }

      const result = await AppDataSource.query(
        `SELECT id FROM users WHERE username = $1 OR email = $2`,
        [userData.username, userData.email]
      );

      if (result && result.length > 0) {
        return {
          success: false,
          error: 'User with this username or email already exists'
        };
      }

      const hashedPassword = await this.hashPassword(userData.password);
      const roleResult = await AppDataSource.query(
        `SELECT id FROM roles WHERE name = $1`,
        [userData.role || 'user']
      );
      const roleId = roleResult && roleResult.length > 0 ? roleResult[0].id : null;

      const newUserResult = await AppDataSource.query(
        `INSERT INTO users (username, email, password_hash, salt, role_id, status, mfa_enabled, email_verified, failed_login_attempts, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'active', false, true, 0, NOW(), NOW())
         RETURNING id, username, email, created_at, updated_at`,
        [userData.username, userData.email, hashedPassword, 'salt', roleId]
      );

      if (newUserResult && newUserResult.length > 0) {
        const dbUser = newUserResult[0];
        const user: User = {
          id: dbUser.id,
          username: dbUser.username,
          email: dbUser.email,
          password: hashedPassword,
          role: userData.role || 'user',
          isActive: true,
          createdAt: dbUser.created_at,
          updatedAt: dbUser.updated_at
        };

        logger.info(`New user registered: ${user.username}`, 'AuthService');

        const token = this.generateToken(user);
        const { password, ...userWithoutPassword } = user;

        return {
          success: true,
          user: userWithoutPassword,
          token
        };
      }

      return { success: false, error: 'Registration failed' };
    } catch (error) {
      logger.error(`Registration error: ${error}`, 'AuthService');
      return { success: false, error: 'Registration failed' };
    }
  }

  async login(credentials: {
    username: string;
    password: string;
  }): Promise<AuthResult> {
    try {
      if (!AppDataSource.isInitialized) {
        return { success: false, error: 'Database not available' };
      }

      const result = await AppDataSource.query(
        `SELECT u.id, u.username, u.email, u.password_hash, u.status, r.name as role_name, u.created_at, u.updated_at
         FROM users u
         LEFT JOIN roles r ON u.role_id = r.id
         WHERE u.username = $1`,
        [credentials.username]
      );

      if (!result || result.length === 0) {
        return { success: false, error: 'Invalid username or password' };
      }

      const dbUser = result[0];

      if (dbUser.status !== 'active') {
        return { success: false, error: 'Account is disabled' };
      }

      const isPasswordValid = await this.comparePassword(credentials.password, dbUser.password_hash);

      if (!isPasswordValid) {
        return { success: false, error: 'Invalid username or password' };
      }

      const user: User = {
        id: dbUser.id,
        username: dbUser.username,
        email: dbUser.email,
        password: dbUser.password_hash,
        role: dbUser.role_name as 'admin' | 'user' | 'viewer' || 'user',
        isActive: true,
        createdAt: dbUser.created_at,
        updatedAt: dbUser.updated_at
      };

      logger.info(`User logged in: ${user.username}`, 'AuthService');

      const token = this.generateToken(user);
      const { password, ...userWithoutPassword } = user;

      return {
        success: true,
        user: userWithoutPassword,
        token
      };
    } catch (error) {
      logger.error(`Login error: ${error}`, 'AuthService');
      return { success: false, error: 'Login failed' };
    }
  }

  async getUserById(userId: string): Promise<Omit<User, 'password'> | null> {
    try {
      if (!AppDataSource.isInitialized) {
        return null;
      }

      const result = await AppDataSource.query(
        `SELECT u.id, u.username, u.email, u.status, r.name as role_name, u.created_at, u.updated_at, u.last_login
         FROM users u
         LEFT JOIN roles r ON u.role_id = r.id
         WHERE u.id = $1`,
        [userId]
      );

      if (!result || result.length === 0) {
        return null;
      }

      const dbUser = result[0];
      return {
        id: dbUser.id,
        username: dbUser.username,
        email: dbUser.email,
        role: dbUser.role_name as 'admin' | 'user' | 'viewer' || 'user',
        isActive: dbUser.status === 'active',
        createdAt: dbUser.created_at,
        updatedAt: dbUser.updated_at,
        lastLogin: dbUser.last_login
      };
    } catch (error) {
      logger.error(`getUserById error: ${error}`, 'AuthService');
      return null;
    }
  }

  async getAllUsers(): Promise<Omit<User, 'password'>[]> {
    try {
      if (!AppDataSource.isInitialized) {
        return [];
      }

      const result = await AppDataSource.query(
        `SELECT u.id, u.username, u.email, u.status, r.name as role_name, u.created_at, u.updated_at, u.last_login
         FROM users u
         LEFT JOIN roles r ON u.role_id = r.id
         ORDER BY u.created_at DESC`
      );

      return result.map((dbUser: any) => ({
        id: dbUser.id,
        username: dbUser.username,
        email: dbUser.email,
        role: dbUser.role_name as 'admin' | 'user' | 'viewer' || 'user',
        isActive: dbUser.status === 'active',
        createdAt: dbUser.created_at,
        updatedAt: dbUser.updated_at,
        lastLogin: dbUser.last_login
      }));
    } catch (error) {
      logger.error(`getAllUsers error: ${error}`, 'AuthService');
      return [];
    }
  }

  async updateUser(userId: string, updates: Partial<Omit<User, 'id' | 'createdAt'>> & { password?: string }): Promise<AuthResult> {
    try {
      if (!AppDataSource.isInitialized) {
        return { success: false, error: 'Database not available' };
      }

      const result = await AppDataSource.query(
        `SELECT id FROM users WHERE id = $1`,
        [userId]
      );

      if (!result || result.length === 0) {
        return { success: false, error: 'User not found' };
      }

      const { password: newPassword, ...otherUpdates } = updates;

      if (newPassword) {
        const hashedPassword = await this.hashPassword(newPassword);
        await AppDataSource.query(
          `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
          [hashedPassword, userId]
        );
      }

      logger.info(`User updated: ${userId}`, 'AuthService');

      return { success: true };
    } catch (error) {
      logger.error(`User update error: ${error}`, 'AuthService');
      return { success: false, error: 'User update failed' };
    }
  }

  async deleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!AppDataSource.isInitialized) {
        return { success: false, error: 'Database not available' };
      }

      const result = await AppDataSource.query(
        `DELETE FROM users WHERE id = $1 RETURNING username`,
        [userId]
      );

      if (!result || result.length === 0) {
        return { success: false, error: 'User not found' };
      }

      logger.info(`User deleted: ${userId}`, 'AuthService');
      return { success: true };
    } catch (error) {
      logger.error(`User deletion error: ${error}`, 'AuthService');
      return { success: false, error: 'User deletion failed' };
    }
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<AuthResult> {
    try {
      if (!AppDataSource.isInitialized) {
        return { success: false, error: 'Database not available' };
      }

      const result = await AppDataSource.query(
        `SELECT id, password_hash FROM users WHERE id = $1`,
        [userId]
      );

      if (!result || result.length === 0) {
        return { success: false, error: 'User not found' };
      }

      const dbUser = result[0];
      const isCurrentPasswordValid = await this.comparePassword(currentPassword, dbUser.password_hash);

      if (!isCurrentPasswordValid) {
        return { success: false, error: 'Current password is incorrect' };
      }

      const newPasswordHash = await this.hashPassword(newPassword);
      await AppDataSource.query(
        `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
        [newPasswordHash, userId]
      );

      logger.info(`Password changed for user: ${userId}`, 'AuthService');
      return { success: true };
    } catch (error) {
      logger.error(`Password change error: ${error}`, 'AuthService');
      return { success: false, error: 'Password change failed' };
    }
  }
}

export const authService = new AuthService();

export default authService;
