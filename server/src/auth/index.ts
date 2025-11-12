import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

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

// Refresh token interface
export interface RefreshToken {
  id: string;
  token: string;
  userId: string;
  expiresAt: Date;
  isRevoked: boolean;
  createdAt: Date;
}

// In-memory user store (in production, use database)
const users: User[] = [
  {
    id: 'admin-1',
    username: 'admin',
    email: 'admin@security.local',
    password: '$2b$12$0nuXboOAh4HoJny5bFtCmum9uD4Vf0nYe8geUNxDw2NTC.bQD/N4S', // 'admin123'
    role: 'admin',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'user-1',
    username: 'user',
    email: 'user@security.local',
    password: '$2b$12$j1KFVKaOA6Ssv/ilYJrNBOHerAa52Qin02yhYfhDqfnn4e2oa9tva', // 'user123'
    role: 'user',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

export class AuthService {
  // Generate JWT token
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

  // Verify JWT token
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

  // Hash password
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, config.security.bcryptRounds);
  }

  // Compare password
  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  // Register new user
  async register(userData: {
    username: string;
    email: string;
    password: string;
    role?: 'admin' | 'user' | 'viewer';
  }): Promise<AuthResult> {
    try {
      // Check if user already exists
      const existingUser = users.find(u => 
        u.username === userData.username || u.email === userData.email
      );

      if (existingUser) {
        return {
          success: false,
          error: 'User with this username or email already exists'
        };
      }

      // Hash password
      const hashedPassword = await this.hashPassword(userData.password);

      // Create new user
      const newUser: User = {
        id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        username: userData.username,
        email: userData.email,
        password: hashedPassword,
        role: userData.role || 'user',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      users.push(newUser);

      logger.info(`New user registered: ${newUser.username}`, 'AuthService');

      // Generate token
      let token: string;
      try {
        token = this.generateToken(newUser);
      } catch (error) {
        logger.error(`Failed to generate JWT token during registration: ${error}`, 'AuthService');
        return {
          success: false,
          error: 'Failed to generate authentication token'
        };
      }

      // Return user without password
      const { password, ...userWithoutPassword } = newUser;

      return {
        success: true,
        user: userWithoutPassword,
        token
      };
    } catch (error) {
      logger.error(`Registration error: ${error}`, 'AuthService');
      return {
        success: false,
        error: 'Registration failed'
      };
    }
  }

  // Login user
  async login(credentials: {
    username: string;
    password: string;
  }): Promise<AuthResult> {
    try {
      // Find user by username
      const user = users.find(u => u.username === credentials.username);

      if (!user) {
        return {
          success: false,
          error: 'Invalid username or password'
        };
      }

      // Check if user is active
      if (!user.isActive) {
        return {
          success: false,
          error: 'Account is disabled'
        };
      }

      // Compare password
      const isPasswordValid = await this.comparePassword(credentials.password, user.password);

      if (!isPasswordValid) {
        return {
          success: false,
          error: 'Invalid username or password'
        };
      }

      // Update last login
      user.lastLogin = new Date();
      user.updatedAt = new Date();

      logger.info(`User logged in: ${user.username}`, 'AuthService');

      // Generate token
      let token: string;
      try {
        token = this.generateToken(user);
      } catch (error) {
        logger.error(`Failed to generate JWT token: ${error}`, 'AuthService');
        return {
          success: false,
          error: 'Failed to generate authentication token'
        };
      }

      // Return user without password
      const { password, ...userWithoutPassword } = user;

      return {
        success: true,
        user: userWithoutPassword,
        token
      };
    } catch (error) {
      logger.error(`Login error: ${error}`, 'AuthService');
      return {
        success: false,
        error: 'Login failed'
      };
    }
  }

  // Get user by ID
  getUserById(userId: string): Omit<User, 'password'> | null {
    const user = users.find(u => u.id === userId);
    
    if (!user) {
      return null;
    }

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  // Get all users (admin only)
  getAllUsers(): Omit<User, 'password'>[] {
    return users.map(({ password, ...user }) => user);
  }

  // Update user
  async updateUser(userId: string, updates: Partial<Omit<User, 'id' | 'createdAt'>> & { password?: string }): Promise<AuthResult> {
    try {
      const userIndex = users.findIndex(u => u.id === userId);

      if (userIndex === -1) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      const user = users[userIndex];

      // Update user fields
      const { password: newPassword, ...otherUpdates } = updates;
      Object.assign(user, otherUpdates, { updatedAt: new Date() });

      // Hash new password if provided
      if (newPassword) {
        user.password = await this.hashPassword(newPassword);
      }

      logger.info(`User updated: ${user.username}`, 'AuthService');

      // Return user without password
      const { password: _, ...userWithoutPassword } = user;

      return {
        success: true,
        user: userWithoutPassword
      };
    } catch (error) {
      logger.error(`User update error: ${error}`, 'AuthService');
      return {
        success: false,
        error: 'User update failed'
      };
    }
  }

  // Delete user
  deleteUser(userId: string): { success: boolean; error?: string } {
    try {
      const userIndex = users.findIndex(u => u.id === userId);

      if (userIndex === -1) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      const user = users[userIndex];
      users.splice(userIndex, 1);

      logger.info(`User deleted: ${user.username}`, 'AuthService');

      return { success: true };
    } catch (error) {
      logger.error(`User deletion error: ${error}`, 'AuthService');
      return {
        success: false,
        error: 'User deletion failed'
      };
    }
  }

  // Change password
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<AuthResult> {
    try {
      const user = users.find(u => u.id === userId);

      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      // Verify current password
      const isCurrentPasswordValid = await this.comparePassword(currentPassword, user.password);

      if (!isCurrentPasswordValid) {
        return {
          success: false,
          error: 'Current password is incorrect'
        };
      }

      // Hash and update new password
      user.password = await this.hashPassword(newPassword);
      user.updatedAt = new Date();

      logger.info(`Password changed for user: ${user.username}`, 'AuthService');

      return { success: true };
    } catch (error) {
      logger.error(`Password change error: ${error}`, 'AuthService');
      return {
        success: false,
        error: 'Password change failed'
      };
    }
  }
}

// Create singleton instance
export const authService = new AuthService();

export default authService;