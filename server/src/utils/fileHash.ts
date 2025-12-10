import crypto from 'crypto';
import fs from 'fs';

export class FileHashUtil {
  /**
   * Generate MD5 hash for a file
   * @param filePath Path to the file
   * @returns MD5 hash string
   */
  static async generateFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('md5');
      const stream = fs.createReadStream(filePath);
      
      stream.on('data', (data) => {
        hash.update(data);
      });
      
      stream.on('end', () => {
        resolve(hash.digest('hex'));
      });
      
      stream.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Generate hash from file metadata (filename, size, timestamp)
   * Useful when you can't read the full file content
   * @param filename Name of the file
   * @param fileSize Size in bytes
   * @param timestamp ISO timestamp
   * @returns Hash string
   */
  static generateMetadataHash(filename: string, fileSize: number, timestamp: string): string {
    const data = `${filename}|${fileSize}|${timestamp}`;
    return crypto.createHash('md5').update(data).digest('hex');
  }

  /**
   * Quick hash based on filename and timestamp (faster but less accurate)
   * @param filename Name of the file
   * @param timestamp ISO timestamp
   * @returns Hash string
   */
  static generateQuickHash(filename: string, timestamp: string): string {
    const data = `${filename}|${timestamp}`;
    return crypto.createHash('md5').update(data).digest('hex');
  }
}

export default FileHashUtil;