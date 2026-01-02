import fs from 'node:fs/promises';
import path from 'node:path';
import { Stats } from 'node:fs';

export interface FileMetadata {
  name: string;
  fullPath: string;
  stats: Stats;
  size: number;
  lastModified: Date;
  extension: string;
  isDirectory: boolean;
  isFile: boolean;
}

export interface DirectoryListingOptions {
  recursive?: boolean;
  includeHidden?: boolean;
  filter?: RegExp;
  sortBy?: 'name' | 'size' | 'lastModified';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
}

export class AsyncFileManager {
  private static instance: AsyncFileManager;
  private fileCache = new Map<string, { data: any; timestamp: number; metadata?: any }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 1000; // Maximum number of cached items

  static getInstance(): AsyncFileManager {
    if (!AsyncFileManager.instance) {
      AsyncFileManager.instance = new AsyncFileManager();
    }
    return AsyncFileManager.instance;
  }

  private constructor() {
    // Setup cache cleanup interval
    setInterval(() => this.cleanupCache(), 60 * 1000); // Clean up every minute
  }

  async readDirectory(dirPath: string, options: DirectoryListingOptions = {}): Promise<FileMetadata[]> {
    try {
      const files: FileMetadata[] = [];
      
      if (options.recursive) {
        await this.readDirectoryRecursive(dirPath, files, options);
      } else {
        await this.readDirectorySingle(dirPath, files, options);
      }

      // Sort results
      const sortBy = options.sortBy || 'name';
      const sortOrder = options.sortOrder || 'asc';
      
      files.sort((a, b) => {
        let comparison = 0;
        
        switch (sortBy) {
          case 'name':
            comparison = a.name.localeCompare(b.name);
            break;
          case 'size':
            comparison = a.size - b.size;
            break;
          case 'lastModified':
            comparison = a.lastModified.getTime() - b.lastModified.getTime();
            break;
        }
        
        return sortOrder === 'desc' ? -comparison : comparison;
      });

      // Apply limit
      if (options.limit && options.limit > 0) {
        files.splice(options.limit);
      }

      return files;
    } catch (error) {
      console.error(`Failed to read directory ${dirPath}:`, error);
      return [];
    }
  }

  private async readDirectorySingle(
    dirPath: string, 
    files: FileMetadata[], 
    options: DirectoryListingOptions
  ): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        // Skip hidden files unless explicitly requested
        if (!options.includeHidden && entry.name.startsWith('.')) {
          continue;
        }

        // Apply regex filter if provided
        if (options.filter && !options.filter.test(entry.name)) {
          continue;
        }

        const fullPath = path.join(dirPath, entry.name);
        const stats = await fs.stat(fullPath);

        const metadata: FileMetadata = {
          name: entry.name,
          fullPath,
          stats,
          size: stats.size,
          lastModified: stats.mtime,
          extension: path.extname(entry.name).toLowerCase(),
          isDirectory: stats.isDirectory(),
          isFile: stats.isFile()
        };

        files.push(metadata);
      }
    } catch (error) {
      console.error(`Error reading directory ${dirPath}:`, error);
    }
  }

  private async readDirectoryRecursive(
    dirPath: string, 
    files: FileMetadata[], 
    options: DirectoryListingOptions
  ): Promise<void> {
    await this.readDirectorySingle(dirPath, files, options);
    
    // Process subdirectories
    const subdirectories = files.filter(f => f.isDirectory);
    
    for (const subdir of subdirectories) {
      await this.readDirectoryRecursive(subdir.fullPath, files, options);
    }
  }

  async getFileStats(filePath: string): Promise<Stats | null> {
    try {
      return await fs.stat(filePath);
    } catch (error) {
      console.error(`Failed to get stats for ${filePath}:`, error);
      return null;
    }
  }

  async getFilesWithMetadata(
    dirPath: string, 
    options: DirectoryListingOptions = {}
  ): Promise<FileMetadata[]> {
    const files = await this.readDirectory(dirPath, options);
    
    // Filter to only include files (not directories)
    return files.filter(file => file.isFile);
  }

  async readFileCached(filePath: string, metadata?: any): Promise<Buffer | null> {
    const cacheKey = path.resolve(filePath);
    const cached = this.fileCache.get(cacheKey);

    // Check cache validity
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      // Update metadata if provided
      if (metadata) {
        cached.metadata = metadata;
      }
      return cached.data;
    }

    try {
      const data = await fs.readFile(filePath);
      
      // Add to cache
      this.addToCache(cacheKey, data, metadata);
      
      return data;
    } catch (error) {
      console.error(`Failed to read file ${filePath}:`, error);
      return null;
    }
  }

  async writeFile(
    filePath: string, 
    data: Buffer | string, 
    metadata?: any
  ): Promise<boolean> {
    try {
      await fs.writeFile(filePath, data);
      
      // Add to cache
      if (Buffer.isBuffer(data)) {
        this.addToCache(path.resolve(filePath), data, metadata);
      } else {
        this.addToCache(path.resolve(filePath), Buffer.from(data), metadata);
      }
      
      return true;
    } catch (error) {
      console.error(`Failed to write file ${filePath}:`, error);
      return false;
    }
  }

  async appendFile(
    filePath: string, 
    data: Buffer | string
  ): Promise<boolean> {
    try {
      await fs.appendFile(filePath, data);
      
      // Invalidate cache since file has changed
      const cacheKey = path.resolve(filePath);
      this.fileCache.delete(cacheKey);
      
      return true;
    } catch (error) {
      console.error(`Failed to append to file ${filePath}:`, error);
      return false;
    }
  }

  async deleteFile(filePath: string): Promise<boolean> {
    try {
      await fs.unlink(filePath);
      
      // Remove from cache
      const cacheKey = path.resolve(filePath);
      this.fileCache.delete(cacheKey);
      
      return true;
    } catch (error) {
      console.error(`Failed to delete file ${filePath}:`, error);
      return false;
    }
  }

  async copyFile(sourcePath: string, destPath: string): Promise<boolean> {
    try {
      await fs.copyFile(sourcePath, destPath);
      
      // Copy cache entry if exists
      const sourceCacheKey = path.resolve(sourcePath);
      const cached = this.fileCache.get(sourceCacheKey);
      
      if (cached) {
        this.addToCache(path.resolve(destPath), cached.data, cached.metadata);
      }
      
      return true;
    } catch (error) {
      console.error(`Failed to copy file from ${sourcePath} to ${destPath}:`, error);
      return false;
    }
  }

  async moveFile(sourcePath: string, destPath: string): Promise<boolean> {
    try {
      await fs.rename(sourcePath, destPath);
      
      // Update cache entry
      const sourceCacheKey = path.resolve(sourcePath);
      const cached = this.fileCache.get(sourceCacheKey);
      
      if (cached) {
        this.fileCache.delete(sourceCacheKey);
        this.addToCache(path.resolve(destPath), cached.data, cached.metadata);
      }
      
      return true;
    } catch (error) {
      console.error(`Failed to move file from ${sourcePath} to ${destPath}:`, error);
      return false;
    }
  }

  async ensureDirectory(dirPath: string): Promise<boolean> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
      return true;
    } catch (error) {
      console.error(`Failed to create directory ${dirPath}:`, error);
      return false;
    }
  }

  async getDirectorySize(dirPath: string): Promise<number> {
    try {
      let totalSize = 0;
      const files = await this.readDirectory(dirPath, { recursive: true });
      
      for (const file of files) {
        if (file.isFile) {
          totalSize += file.size;
        }
      }
      
      return totalSize;
    } catch (error) {
      console.error(`Failed to calculate directory size for ${dirPath}:`, error);
      return 0;
    }
  }

  async cleanupOldFiles(
    dirPath: string, 
    maxAge: number, 
    pattern?: RegExp
  ): Promise<number> {
    try {
      let deletedCount = 0;
      const files = await this.readDirectory(dirPath, { recursive: false });
      const now = Date.now();
      
      for (const file of files) {
        if (!file.isFile) continue;
        
        // Apply pattern filter if provided
        if (pattern && !pattern.test(file.name)) {
          continue;
        }
        
        // Check file age
        const fileAge = now - file.lastModified.getTime();
        if (fileAge > maxAge) {
          if (await this.deleteFile(file.fullPath)) {
            deletedCount++;
          }
        }
      }
      
      return deletedCount;
    } catch (error) {
      console.error(`Failed to cleanup old files in ${dirPath}:`, error);
      return 0;
    }
  }

  private addToCache(key: string, data: Buffer, metadata?: any): void {
    // Implement LRU eviction if cache is full
    if (this.fileCache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.fileCache.keys().next().value;
      if (firstKey) {
        this.fileCache.delete(firstKey);
      }
    }
    
    this.fileCache.set(key, {
      data,
      timestamp: Date.now(),
      metadata
    });
  }

  private cleanupCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    for (const [key, cached] of this.fileCache) {
      if (now - cached.timestamp > this.CACHE_TTL) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.fileCache.delete(key);
    }
    
    if (keysToDelete.length > 0) {
      console.debug(`Cleaned up ${keysToDelete.length} expired cache entries`);
    }
  }

  clearCache(): void {
    this.fileCache.clear();
  }

  getCacheStats(): {
    size: number;
    maxSize: number;
    ttl: number;
  } {
    return {
      size: this.fileCache.size,
      maxSize: this.MAX_CACHE_SIZE,
      ttl: this.CACHE_TTL
    };
  }

  // Utility methods for common operations
  async readJsonFile<T = any>(filePath: string): Promise<T | null> {
    const data = await this.readFileCached(filePath);
    if (!data) return null;
    
    try {
      return JSON.parse(data.toString());
    } catch (error) {
      console.error(`Failed to parse JSON file ${filePath}:`, error);
      return null;
    }
  }

  async writeJsonFile(filePath: string, data: any): Promise<boolean> {
    try {
      const jsonString = JSON.stringify(data, null, 2);
      return await this.writeFile(filePath, jsonString, { type: 'json' });
    } catch (error) {
      console.error(`Failed to write JSON file ${filePath}:`, error);
      return false;
    }
  }

  async findFiles(
    dirPath: string, 
    pattern: RegExp, 
    options: DirectoryListingOptions = {}
  ): Promise<FileMetadata[]> {
    const files = await this.readDirectory(dirPath, {
      ...options,
      filter: pattern
    });
    
    return files.filter(file => file.isFile);
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

export default AsyncFileManager;