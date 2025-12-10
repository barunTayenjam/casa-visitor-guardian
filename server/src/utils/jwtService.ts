import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';

// Zod schemas for validation
export const JWTPayloadSchema = z.object({
  userId: z.string(),
  username: z.string(),
  email: z.string(),
  roleId: z.string().optional(),
  permissions: z.array(z.string()).default([]),
  iat: z.number().optional(),
  exp: z.number().optional()
});

export interface JWTPayload {
  userId: string;
  username: string;
  email: string;
  roleId?: string;
  permissions: string[];
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export class JWTService {
  private accessTokenSecret: string;
  private refreshTokenSecret: string;
  private accessTokenExpiresIn: string;
  private refreshTokenExpiresIn: string;
  private tokenBlacklist: Set<string>;
  private blacklistCleanupInterval: NodeJS.Timeout;

  constructor(
    accessTokenSecret?: string,
    refreshTokenSecret?: string,
    accessTokenExpiresIn: string = '15m',
    refreshTokenExpiresIn: string = '7d'
  ) {
    this.accessTokenSecret = accessTokenSecret || process.env.JWT_ACCESS_SECRET || 
      crypto.randomBytes(64).toString('hex');
    this.refreshTokenSecret = refreshTokenSecret || process.env.JWT_REFRESH_SECRET || 
      crypto.randomBytes(64).toString('hex');
    this.accessTokenExpiresIn = accessTokenExpiresIn;
    this.refreshTokenExpiresIn = refreshTokenExpiresIn;
    this.tokenBlacklist = new Set();
    
    // Start blacklist cleanup interval (every hour)
    this.blacklistCleanupInterval = setInterval(() => {
      this.cleanupBlacklist();
    }, 60 * 60 * 1000);
  }

  async generateTokenPair(payload: Omit<JWTPayload, 'iat' | 'exp'>): Promise<TokenPair> {
    try {
      // Validate payload
      const validatedPayload = JWTPayloadSchema.omit({ iat: true, exp: true }).parse(payload);

      // Generate access token
      const accessToken = jwt.sign(
        validatedPayload,
        this.accessTokenSecret,
        { expiresIn: this.accessTokenExpiresIn }
      );

      // Generate refresh token
      const refreshToken = jwt.sign(
        { userId: validatedPayload.userId },
        this.refreshTokenSecret,
        { expiresIn: this.refreshTokenExpiresIn }
      );

      // Calculate expiration time in seconds
      const expiresIn = this.parseExpiresIn(this.accessTokenExpiresIn);

      return {
        accessToken,
        refreshToken,
        expiresIn
      };

    } catch (error) {
      console.error('Token generation error:', error);
      throw new Error('Failed to generate tokens');
    }
  }

  async verifyAccessToken(token: string): Promise<JWTPayload | null> {
    try {
      // Check if token is blacklisted
      if (this.isTokenBlacklisted(token)) {
        return null;
      }

      const payload = jwt.verify(token, this.accessTokenSecret) as any;
      return JWTPayloadSchema.parse(payload);

    } catch (error) {
      console.error('Access token verification error:', error);
      return null;
    }
  }

  async verifyRefreshToken(token: string): Promise<{ userId: string } | null> {
    try {
      // Check if token is blacklisted
      if (this.isTokenBlacklisted(token)) {
        return null;
      }

      const payload = jwt.verify(token, this.refreshTokenSecret) as any;
      return { userId: payload.userId };

    } catch (error) {
      console.error('Refresh token verification error:', error);
      return null;
    }
  }

  async blacklistToken(token: string): Promise<void> {
    try {
      // Add token to blacklist
      this.tokenBlacklist.add(token);

      // Extract expiration time from token
      const decoded = jwt.decode(token) as any;
      if (decoded && decoded.exp) {
        const expirationTime = decoded.exp * 1000; // Convert to milliseconds
        const now = Date.now();
        
        // Schedule removal from blacklist after expiration
        setTimeout(() => {
          this.tokenBlacklist.delete(token);
        }, Math.max(0, expirationTime - now));
      }

    } catch (error) {
      console.error('Token blacklisting error:', error);
    }
  }

  isTokenBlacklisted(token: string): boolean {
    return this.tokenBlacklist.has(token);
  }

  private cleanupBlacklist(): void {
    try {
      const now = Date.now();
      const tokensToRemove: string[] = [];

      for (const token of this.tokenBlacklist) {
        try {
          const decoded = jwt.decode(token) as any;
          if (decoded && decoded.exp) {
            const expirationTime = decoded.exp * 1000;
            if (expirationTime <= now) {
              tokensToRemove.push(token);
            }
          }
        } catch {
          // Remove invalid tokens
          tokensToRemove.push(token);
        }
      }

      // Remove expired tokens
      tokensToRemove.forEach(token => this.tokenBlacklist.delete(token));

    } catch (error) {
      console.error('Blacklist cleanup error:', error);
    }
  }

  private parseExpiresIn(expiresIn: string): number {
    const unit = expiresIn.slice(-1);
    const value = parseInt(expiresIn.slice(0, -1));
    
    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 60 * 60;
      case 'd': return value * 24 * 60 * 60;
      default: return value; // Assume seconds if no unit
    }
  }

  // Generate a new access token from a refresh token
  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number } | null> {
    try {
      const payload = await this.verifyRefreshToken(refreshToken);
      if (!payload) {
        return null;
      }

      // Get user details (this would typically come from a database)
      // For now, we'll create a minimal payload
      const newPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
        userId: payload.userId,
        username: 'user', // This should come from database
        email: 'user@example.com', // This should come from database
        permissions: []
      };

      const accessToken = jwt.sign(
        newPayload,
        this.accessTokenSecret,
        { expiresIn: this.accessTokenExpiresIn }
      );

      const expiresIn = this.parseExpiresIn(this.accessTokenExpiresIn);

      return { accessToken, expiresIn };

    } catch (error) {
      console.error('Access token refresh error:', error);
      return null;
    }
  }

  // Extract token from authorization header
  extractTokenFromHeader(authHeader: string): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7);
  }

  // Validate token format
  isValidTokenFormat(token: string): boolean {
    if (!token || typeof token !== 'string') {
      return false;
    }
    
    const parts = token.split('.');
    return parts.length === 3; // JWT should have 3 parts: header.payload.signature
  }

  // Get token expiration time
  getTokenExpiration(token: string): Date | null {
    try {
      const decoded = jwt.decode(token) as any;
      if (decoded && decoded.exp) {
        return new Date(decoded.exp * 1000);
      }
      return null;
    } catch {
      return null;
    }
  }

  // Check if token is expired
  isTokenExpired(token: string): boolean {
    const expiration = this.getTokenExpiration(token);
    if (!expiration) {
      return true;
    }
    return expiration <= new Date();
  }

  // Destroy service and cleanup
  destroy(): void {
    if (this.blacklistCleanupInterval) {
      clearInterval(this.blacklistCleanupInterval);
    }
    this.tokenBlacklist.clear();
  }
}