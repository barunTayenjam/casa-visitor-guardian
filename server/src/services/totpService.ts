import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import crypto from 'crypto';
import { z } from 'zod';

// Zod schemas for validation
export const TOTPSetupSchema = z.object({
  userId: z.string(),
  issuer: z.string().default('SentryVision'),
  accountName: z.string(),
  algorithm: z.enum(['sha1', 'sha256', 'sha512']).default('sha256'),
  digits: z.number().min(4).max(10).default(6),
  period: z.number().min(15).max(300).default(30)
});

export const TOTPVerifySchema = z.object({
  userId: z.string(),
  token: z.string().min(4).max(10),
  window: z.number().min(1).max(10).default(2)
});

export const BackupCodeSchema = z.object({
  userId: z.string(),
  count: z.number().min(1).max(20).default(10)
});

export interface TOTPSetup {
  secret: string;
  qrCodeUrl: string;
  manualEntryKey: string;
  backupCodes: string[];
  expiresAt: Date;
}

export interface TOTPVerification {
  isValid: boolean;
  isBackupCode: boolean;
  backupCodeUsed?: string;
}

export interface BackupCode {
  code: string;
  isUsed: boolean;
  usedAt?: Date;
  usedIpAddress?: string;
  usedUserAgent?: string;
}

export class TOTPService {
  private encryptionKey: string;
  private backupCodeEncryptionKey: string;

  constructor(
    encryptionKey?: string,
    backupCodeEncryptionKey?: string
  ) {
    this.encryptionKey = encryptionKey || process.env.TOTP_ENCRYPTION_KEY || 
      crypto.randomBytes(32).toString('hex');
    this.backupCodeEncryptionKey = backupCodeEncryptionKey || 
      process.env.BACKUP_CODE_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
  }

  async generateTOTPSecret(setupData: z.infer<typeof TOTPSetupSchema>): Promise<TOTPSetup> {
    try {
      // Validate input
      const validated = TOTPSetupSchema.parse(setupData);

      // Generate TOTP secret
      const secret = speakeasy.generateSecret({
        name: `${validated.issuer}:${validated.accountName}`,
        issuer: validated.issuer,
        length: 32,
        algorithm: validated.algorithm as any,
        digits: validated.digits,
        period: validated.period
      });

      // Generate QR code
      const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url || '');

      // Generate backup codes
      const backupCodes = await this.generateBackupCodes({
        userId: validated.userId,
        count: 10
      });

      // Encrypt the secret
      const encryptedSecret = this.encryptData(secret.base32 || '');

      return {
        secret: encryptedSecret,
        qrCodeUrl,
        manualEntryKey: secret.base32 || '',
        backupCodes,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
      };

    } catch (error) {
      console.error('TOTP secret generation error:', error);
      throw new Error('Failed to generate TOTP secret');
    }
  }

  async verifyTOTPToken(verifyData: z.infer<typeof TOTPVerifySchema>, encryptedSecret: string): Promise<TOTPVerification> {
    try {
      // Validate input
      const validated = TOTPVerifySchema.parse(verifyData);

      // Decrypt the secret
      const secret = this.decryptData(encryptedSecret);

      // Verify TOTP token
      const isValid = speakeasy.totp.verify({
        secret: secret,
        encoding: 'base32',
        token: validated.token,
        window: validated.window,
        algorithm: 'sha256' // Default algorithm
      });

      return {
        isValid,
        isBackupCode: false
      };

    } catch (error) {
      console.error('TOTP verification error:', error);
      return {
        isValid: false,
        isBackupCode: false
      };
    }
  }

  async generateBackupCodes(backupData: z.infer<typeof BackupCodeSchema>): Promise<string[]> {
    try {
      // Validate input
      const validated = BackupCodeSchema.parse(backupData);

      const backupCodes: string[] = [];

      for (let i = 0; i < validated.count; i++) {
        // Generate a random 8-character alphanumeric code
        const code = crypto.randomBytes(4).toString('hex').toUpperCase();
        backupCodes.push(code);
      }

      return backupCodes;

    } catch (error) {
      console.error('Backup code generation error:', error);
      throw new Error('Failed to generate backup codes');
    }
  }

  async verifyBackupCode(
    userId: string,
    code: string,
    storedBackupCodes: BackupCode[]
  ): Promise<{ isValid: boolean; usedCode?: string; remainingCodes: BackupCode[] }> {
    try {
      // Find the backup code
      const backupCode = storedBackupCodes.find(bc => 
        bc.code === code && !bc.isUsed
      );

      if (!backupCode) {
        return {
          isValid: false,
          remainingCodes: storedBackupCodes
        };
      }

      // Mark the code as used
      backupCode.isUsed = true;
      backupCode.usedAt = new Date();

      return {
        isValid: true,
        usedCode: backupCode.code,
        remainingCodes: storedBackupCodes
      };

    } catch (error) {
      console.error('Backup code verification error:', error);
      return {
        isValid: false,
        remainingCodes: storedBackupCodes
      };
    }
  }

  encryptData(data: string): string {
    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, this.encryptionKey);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  decryptData(encryptedData: string): string {
    try {
      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];

      const decipher = crypto.createDecipher('aes-256-gcm', this.encryptionKey);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;

    } catch (error) {
      console.error('Data decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  encryptBackupCodes(backupCodes: BackupCode[]): string {
    const data = JSON.stringify(backupCodes);
    return this.encryptData(data);
  }

  decryptBackupCodes(encryptedData: string): BackupCode[] {
    try {
      const decrypted = this.decryptData(encryptedData);
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('Backup codes decryption error:', error);
      return [];
    }
  }

  generateRecoveryCode(): string {
    return crypto.randomBytes(8).toString('hex').toUpperCase();
  }

  validateTOTPFormat(token: string): boolean {
    // TOTP tokens are typically 6-8 digits
    return /^\d{6,8}$/.test(token);
  }

  validateBackupCodeFormat(code: string): boolean {
    // Backup codes are typically 8-character alphanumeric
    return /^[A-Z0-9]{8}$/.test(code);
  }

  async getCurrentTOTPToken(encryptedSecret: string): Promise<string> {
    try {
      const secret = this.decryptData(encryptedSecret);
      
      const token = speakeasy.totp({
        secret: secret,
        encoding: 'base32',
        algorithm: 'sha256'
      });

      return token;

    } catch (error) {
      console.error('Get current TOTP token error:', error);
      throw new Error('Failed to generate current TOTP token');
    }
  }

  async getTOTPInfo(encryptedSecret: string): Promise<{
    currentToken: string;
    nextToken: string;
    timeRemaining: number;
    period: number;
  }> {
    try {
      const secret = this.decryptData(encryptedSecret);
      const period = 30; // Default period

      const now = Math.floor(Date.now() / 1000);
      const timeRemaining = period - (now % period);

      const currentToken = speakeasy.totp({
        secret: secret,
        encoding: 'base32',
        algorithm: 'sha256',
        time: now
      });

      const nextToken = speakeasy.totp({
        secret: secret,
        encoding: 'base32',
        algorithm: 'sha256',
        time: now + period
      });

      return {
        currentToken,
        nextToken,
        timeRemaining,
        period
      };

    } catch (error) {
      console.error('Get TOTP info error:', error);
      throw new Error('Failed to get TOTP info');
    }
  }

  async rateLimitVerification(userId: string, attempts: number, windowMs: number = 60000): Promise<boolean> {
    // This would typically use Redis or a database to track attempts
    // For now, we'll implement a simple in-memory rate limiter
    // In production, you should use a proper rate limiting service
    
    const key = `totp_attempts:${userId}`;
    const now = Date.now();
    
    // This is a simplified implementation
    // In production, you'd store this in Redis or a database
    const attemptsData = {
      count: attempts,
      lastAttempt: now
    };

    // Reset if window has passed
    if (now - attemptsData.lastAttempt > windowMs) {
      attemptsData.count = 1;
      attemptsData.lastAttempt = now;
      return true;
    }

    // Check if attempts exceed limit (5 attempts per minute)
    if (attemptsData.count >= 5) {
      return false;
    }

    attemptsData.count++;
    attemptsData.lastAttempt = now;
    return true;
  }

  async logTOTPEvent(
    userId: string,
    action: 'setup' | 'verify' | 'backup_used' | 'disable',
    success: boolean,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    // This would integrate with the audit service
    // For now, we'll just log to console
    console.log(`TOTP Event: ${action} for user ${userId} - Success: ${success}`);
    
    if (ipAddress) {
      console.log(`IP Address: ${ipAddress}`);
    }
    
    if (userAgent) {
      console.log(`User Agent: ${userAgent}`);
    }
  }
}