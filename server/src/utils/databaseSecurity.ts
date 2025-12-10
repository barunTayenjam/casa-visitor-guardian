import { logger } from './logger.js';

// SQL injection prevention utilities
export class DatabaseSecurity {
  
  // Sanitize input for database queries
  static sanitizeInput(input: any): any {
    if (input === null || input === undefined) {
      return input;
    }
    
    if (typeof input === 'string') {
      return this.escapeSqlString(input);
    }
    
    if (Array.isArray(input)) {
      return input.map(item => this.sanitizeInput(item));
    }
    
    if (typeof input === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(input)) {
        sanitized[this.escapeIdentifier(key)] = this.sanitizeInput(value);
      }
      return sanitized;
    }
    
    return input;
  }
  
  // Escape SQL strings to prevent injection
  static escapeSqlString(str: string): string {
    // Basic SQL injection prevention
    return str
      .replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, char => {
        switch (char) {
          case '\0': return '\\0';
          case '\x08': return '\\b';
          case '\x09': return '\\t';
          case '\x1a': return '\\z';
          case '\n': return '\\n';
          case '\r': return '\\r';
          case '"':
          case "'":
          case '\\':
          case '%': return '\\' + char;
          default: return char;
        }
      });
  }
  
  // Escape SQL identifiers (table names, column names)
  static escapeIdentifier(identifier: string): string {
    // Only allow alphanumeric characters, underscores, and dashes
    if (!/^[a-zA-Z0-9_-]+$/.test(identifier)) {
      logger.warn(`Invalid SQL identifier: ${identifier}`, 'DatabaseSecurity');
      throw new Error(`Invalid SQL identifier: ${identifier}`);
    }
    return `\`${identifier}\``;
  }
  
  // Validate SQL query patterns
  static validateQuery(query: string): boolean {
    // List of dangerous SQL patterns
    const dangerousPatterns = [
      /\b(DROP|DELETE|UPDATE|INSERT|CREATE|ALTER|EXEC|UNION|SELECT)\b/i,
      /\b(OR|AND)\s+\d+\s*=\s*\d+/i,
      /\b(OR|AND)\s+['"]?\w+['"]?\s*=\s*['"]?\w+['"]?/i,
      /--/,
      /\/\*/,
      /\*\//,
      /;/,
      /xp_/i,
      /sp_/i
    ];
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(query)) {
        logger.warn(`Potentially dangerous SQL query detected: ${query}`, 'DatabaseSecurity');
        return false;
      }
    }
    
    return true;
  }
  
  // Parameterized query helper
  static createParameterizedQuery(template: string, params: any[]): { query: string; values: any[] } {
    if (!this.validateQuery(template)) {
      throw new Error('Invalid SQL query template');
    }
    
    // Replace ? with placeholders and validate parameter count
    const placeholderCount = (template.match(/\?/g) || []).length;
    if (placeholderCount !== params.length) {
      throw new Error(`Parameter count mismatch: expected ${placeholderCount}, got ${params.length}`);
    }
    
    return {
      query: template,
      values: params.map(param => this.sanitizeInput(param))
    };
  }
  
  // Validate table and column names
  static validateTableName(tableName: string): boolean {
    // Only allow alphanumeric characters, underscores, and dashes
    return /^[a-zA-Z0-9_-]+$/.test(tableName) && 
           !/^(DROP|DELETE|UPDATE|INSERT|CREATE|ALTER|EXEC|UNION|SELECT)$/i.test(tableName);
  }
  
  static validateColumnName(columnName: string): boolean {
    return this.validateTableName(columnName);
  }
  
  // Check for NoSQL injection patterns (for MongoDB/Mongoose)
  static sanitizeNoSQLQuery(query: any): any {
    if (query === null || query === undefined) {
      return query;
    }
    
    if (typeof query === 'object') {
      const sanitized: any = {};
      
      for (const [key, value] of Object.entries(query)) {
        // Check for dangerous NoSQL operators
        if (key.startsWith('$')) {
          const allowedOperators = ['$and', '$or', '$eq', '$ne', '$gt', '$gte', '$lt', '$lte', '$in', '$nin'];
          if (!allowedOperators.includes(key.toLowerCase())) {
            logger.warn(`Dangerous NoSQL operator detected: ${key}`, 'DatabaseSecurity');
            continue; // Skip this operator
          }
        }
        
        sanitized[key] = this.sanitizeNoSQLQuery(value);
      }
      
      return sanitized;
    }
    
    return query;
  }
  
  // Validate file paths to prevent directory traversal
  static validateFilePath(filePath: string): boolean {
    // Check for directory traversal patterns
    const dangerousPatterns = [
      /\.\./,
      /\/\//,
      /\\/,
      /^\/[a-zA-Z]:/, // Windows drive paths
      /^[a-zA-Z]:\//   // Windows drive paths
    ];
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(filePath)) {
        logger.warn(`Potentially dangerous file path: ${filePath}`, 'DatabaseSecurity');
        return false;
      }
    }
    
    return true;
  }
  
  // Sanitize file paths
  static sanitizeFilePath(filePath: string): string {
    // Remove dangerous characters and patterns
    return filePath
      .replace(/\.\./g, '')
      .replace(/[\/\\]/g, '_')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/^_+|_+$/g, '');
  }
  
  // Validate and sanitize sort parameters
  static sanitizeSortParams(sortBy: string, sortOrder: 'asc' | 'desc' = 'asc'): { sortBy: string; sortOrder: 'asc' | 'desc' } {
    if (!this.validateColumnName(sortBy)) {
      logger.warn(`Invalid sort column: ${sortBy}`, 'DatabaseSecurity');
      throw new Error(`Invalid sort column: ${sortBy}`);
    }
    
    if (!['asc', 'desc'].includes(sortOrder.toLowerCase())) {
      logger.warn(`Invalid sort order: ${sortOrder}`, 'DatabaseSecurity');
      throw new Error(`Invalid sort order: ${sortOrder}`);
    }
    
    return {
      sortBy: this.escapeIdentifier(sortBy),
      sortOrder: sortOrder.toLowerCase() as 'asc' | 'desc'
    };
  }
  
  // Validate pagination parameters
  static sanitizePaginationParams(page: number, pageSize: number): { page: number; pageSize: number; offset: number } {
    const sanitizedPage = Math.max(1, Math.floor(Number(page)) || 1);
    const sanitizedPageSize = Math.max(1, Math.min(1000, Math.floor(Number(pageSize)) || 10));
    const offset = (sanitizedPage - 1) * sanitizedPageSize;
    
    return {
      page: sanitizedPage,
      pageSize: sanitizedPageSize,
      offset
    };
  }
  
  // Create safe WHERE clause
  static createSafeWhereClause(conditions: Record<string, any>): { clause: string; values: any[] } {
    const clauses: string[] = [];
    const values: any[] = [];
    
    for (const [column, value] of Object.entries(conditions)) {
      if (!this.validateColumnName(column)) {
        logger.warn(`Invalid column name in WHERE clause: ${column}`, 'DatabaseSecurity');
        continue;
      }
      
      if (value === null || value === undefined) {
        clauses.push(`${this.escapeIdentifier(column)} IS NULL`);
      } else if (Array.isArray(value)) {
        const placeholders = value.map(() => '?').join(', ');
        clauses.push(`${this.escapeIdentifier(column)} IN (${placeholders})`);
        values.push(...value);
      } else if (typeof value === 'object' && value !== null) {
        // Handle operators like { $gt: 100, $lt: 200 }
        for (const [operator, operatorValue] of Object.entries(value)) {
          switch (operator) {
            case '$gt':
              clauses.push(`${this.escapeIdentifier(column)} > ?`);
              values.push(operatorValue);
              break;
            case '$gte':
              clauses.push(`${this.escapeIdentifier(column)} >= ?`);
              values.push(operatorValue);
              break;
            case '$lt':
              clauses.push(`${this.escapeIdentifier(column)} < ?`);
              values.push(operatorValue);
              break;
            case '$lte':
              clauses.push(`${this.escapeIdentifier(column)} <= ?`);
              values.push(operatorValue);
              break;
            case '$ne':
              clauses.push(`${this.escapeIdentifier(column)} != ?`);
              values.push(operatorValue);
              break;
            case '$like':
              clauses.push(`${this.escapeIdentifier(column)} LIKE ?`);
              values.push(operatorValue);
              break;
            default:
              logger.warn(`Unsupported operator in WHERE clause: ${operator}`, 'DatabaseSecurity');
          }
        }
      } else {
        clauses.push(`${this.escapeIdentifier(column)} = ?`);
        values.push(value);
      }
    }
    
    const clause = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    
    return { clause, values };
  }
}

export default DatabaseSecurity;