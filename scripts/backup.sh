#!/bin/bash

# SentryVision Backup Script
# Performs automated backups of database and files

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.prod.yml"
ENV_FILE="$PROJECT_DIR/.env.production"

# Log functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Load environment variables
load_environment() {
    if [[ ! -f "$ENV_FILE" ]]; then
        log_error "Environment file not found: $ENV_FILE"
        exit 1
    fi
    
    source "$ENV_FILE"
    
    # Set defaults if not configured
    BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}
    AUTO_BACKUP_ENABLED=${AUTO_BACKUP_ENABLED:-true}
    BACKUP_ENCRYPTION_ENABLED=${BACKUP_ENCRYPTION_ENABLED:-true}
}

# Create backup directory
create_backup_dir() {
    local backup_dir="$PROJECT_DIR/backups/$(date +%Y/%m/%d)"
    mkdir -p "$backup_dir"
    echo "$backup_dir"
}

# Backup database
backup_database() {
    log_info "Starting database backup..."
    
    local backup_dir
    backup_dir=$(create_backup_dir)
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$backup_dir/sentryvision_db_$timestamp.sql"
    local compressed_file="$backup_file.gz"
    
    cd "$PROJECT_DIR"
    
    # Perform database backup
    if docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_dump -U "$DB_USER" "$DB_NAME" > "$backup_file"; then
        log_success "Database backup created: $backup_file"
    else
        log_error "Database backup failed"
        return 1
    fi
    
    # Compress backup
    if gzip "$backup_file"; then
        log_success "Database backup compressed: $compressed_file"
        local backup_size=$(stat -f%z "$compressed_file" 2>/dev/null || stat -c%s "$compressed_file" 2>/dev/null)
        log_info "Compressed backup size: $backup_size bytes"
    else
        log_error "Failed to compress database backup"
        return 1
    fi
    
    # Encrypt backup if enabled
    if [[ "$BACKUP_ENCRYPTION_ENABLED" == "true" ]]; then
        encrypt_backup "$compressed_file"
    fi
    
    # Cleanup old backups
    cleanup_old_database_backups "$backup_dir"
    
    echo "$compressed_file"
}

# Backup files
backup_files() {
    log_info "Starting file backup..."
    
    local backup_dir
    backup_dir=$(create_backup_dir)
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$backup_dir/sentryvision_files_$timestamp.tar.gz"
    
    # Create temporary file list
    local temp_filelist=$(mktemp)
    cat > "$temp_filelist" << EOF
data/uploads
data/snapshots
data/events
logs/nginx
logs/backend
logs/postgres
logs/redis
docker
.env.production
EOF
    
    cd "$PROJECT_DIR"
    
    # Create tar backup
    if tar -czf "$backup_file" --files-from="$temp_filelist"; then
        log_success "File backup created: $backup_file"
        local backup_size=$(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file" 2>/dev/null)
        log_info "File backup size: $backup_size bytes"
    else
        log_error "File backup failed"
        rm -f "$temp_filelist"
        return 1
    fi
    
    rm -f "$temp_filelist"
    
    # Encrypt backup if enabled
    if [[ "$BACKUP_ENCRYPTION_ENABLED" == "true" ]]; then
        encrypt_backup "$backup_file"
    fi
    
    # Cleanup old file backups
    cleanup_old_file_backups "$backup_dir"
    
    echo "$backup_file"
}

# Encrypt backup file
encrypt_backup() {
    local file="$1"
    local encrypted_file="$file.enc"
    
    log_info "Encrypting backup: $file"
    
    # Generate encryption key from environment
    local encryption_key="${BACKUP_ENCRYPTION_KEY:-$DB_PASSWORD}"
    
    # Encrypt with OpenSSL
    if openssl enc -aes-256-cbc -salt -in "$file" -out "$encrypted_file" -pass pass:"$encryption_key"; then
        log_success "Backup encrypted: $encrypted_file"
        rm -f "$file"
        echo "$encrypted_file"
    else
        log_error "Failed to encrypt backup"
        return 1
    fi
}

# Decrypt backup file
decrypt_backup() {
    local encrypted_file="$1"
    local output_file="$2"
    
    local encryption_key="${BACKUP_ENCRYPTION_KEY:-$DB_PASSWORD}"
    
    if openssl enc -aes-256-cbc -d -in "$encrypted_file" -out "$output_file" -pass pass:"$encryption_key"; then
        log_success "Backup decrypted: $output_file"
        return 0
    else
        log_error "Failed to decrypt backup"
        return 1
    fi
}

# Cleanup old database backups
cleanup_old_database_backups() {
    local backup_dir="$1"
    
    log_info "Cleaning up old database backups (older than $BACKUP_RETENTION_DAYS days)..."
    
    local deleted_count=0
    while IFS= read -r -d '' file; do
        rm -f "$file"
        ((deleted_count++))
    done < <(find "$backup_dir" -name "*.sql.gz*" -type f -mtime +$BACKUP_RETENTION_DAYS -print0 2>/dev/null)
    
    if [[ $deleted_count -gt 0 ]]; then
        log_success "Deleted $deleted_count old database backup(s)"
    else
        log_info "No old database backups to delete"
    fi
}

# Cleanup old file backups
cleanup_old_file_backups() {
    local backup_dir="$1"
    
    # File backups are kept for shorter period (7 days)
    local file_backup_retention_days=7
    
    log_info "Cleaning up old file backups (older than $file_backup_retention_days days)..."
    
    local deleted_count=0
    while IFS= read -r -d '' file; do
        rm -f "$file"
        ((deleted_count++))
    done < <(find "$backup_dir" -name "*files_*.tar.gz*" -type f -mtime +$file_backup_retention_days -print0 2>/dev/null)
    
    if [[ $deleted_count -gt 0 ]]; then
        log_success "Deleted $deleted_count old file backup(s)"
    else
        log_info "No old file backups to delete"
    fi
}

# Verify backup integrity
verify_backup() {
    local backup_file="$1"
    
    log_info "Verifying backup integrity: $backup_file"
    
    if [[ "$backup_file" == *.gz ]]; then
        # Verify gzip integrity
        if gzip -t "$backup_file" 2>/dev/null; then
            log_success "Backup integrity verified"
            return 0
        else
            log_error "Backup integrity check failed"
            return 1
        fi
    elif [[ "$backup_file" == *.tar.gz ]]; then
        # Verify tar.gz integrity
        if tar -tzf "$backup_file" >/dev/null 2>&1; then
            log_success "Backup integrity verified"
            return 0
        else
            log_error "Backup integrity check failed"
            return 1
        fi
    else
        log_warning "Cannot verify backup type: $backup_file"
        return 0
    fi
}

# List backups
list_backups() {
    log_info "Available backups:"
    
    local backup_dir="$PROJECT_DIR/backups"
    
    if [[ ! -d "$backup_dir" ]]; then
        log_warning "No backup directory found"
        return
    fi
    
    echo
    echo "Database Backups:"
    find "$backup_dir" -name "*db_*.sql.gz*" -type f -exec ls -lh {} \; 2>/dev/null || echo "  No database backups found"
    
    echo
    echo "File Backups:"
    find "$backup_dir" -name "*files_*.tar.gz*" -type f -exec ls -lh {} \; 2>/dev/null || echo "  No file backups found"
    echo
}

# Restore database
restore_database() {
    local backup_file="$1"
    
    if [[ ! -f "$backup_file" ]]; then
        log_error "Backup file not found: $backup_file"
        return 1
    fi
    
    log_warning "This will restore the database from: $backup_file"
    log_warning "All current data will be lost!"
    
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Database restore cancelled"
        return 0
    fi
    
    log_info "Starting database restore..."
    
    cd "$PROJECT_DIR"
    
    # Stop backend to prevent conflicts
    log_info "Stopping backend service..."
    docker-compose -f "$COMPOSE_FILE" stop backend
    
    # Decrypt if needed
    local temp_restore_file="$backup_file"
    if [[ "$backup_file" == *.enc ]]; then
        temp_restore_file="${backup_file%.enc}"
        log_info "Decrypting backup..."
        if ! decrypt_backup "$backup_file" "$temp_restore_file"; then
            log_error "Failed to decrypt backup"
            return 1
        fi
    fi
    
    # Drop and recreate database
    log_info "Recreating database..."
    docker-compose -f "$COMPOSE_FILE" exec -T postgres psql -U "$DB_USER" -c "DROP DATABASE IF EXISTS $DB_NAME;"
    docker-compose -f "$COMPOSE_FILE" exec -T postgres psql -U "$DB_USER" -c "CREATE DATABASE $DB_NAME;"
    
    # Restore database
    if [[ "$temp_restore_file" == *.gz ]]; then
        if gunzip -c "$temp_restore_file" | docker-compose -f "$COMPOSE_FILE" exec -T postgres psql -U "$DB_USER" "$DB_NAME"; then
            log_success "Database restore completed"
        else
            log_error "Database restore failed"
            return 1
        fi
    else
        if docker-compose -f "$COMPOSE_FILE" exec -T postgres psql -U "$DB_USER" "$DB_NAME" < "$temp_restore_file"; then
            log_success "Database restore completed"
        else
            log_error "Database restore failed"
            return 1
        fi
    fi
    
    # Cleanup decrypted file
    if [[ "$temp_restore_file" != "$backup_file" ]]; then
        rm -f "$temp_restore_file"
    fi
    
    # Start backend
    log_info "Starting backend service..."
    docker-compose -f "$COMPOSE_FILE" start backend
    
    log_success "Database restore completed successfully"
}

# Show backup statistics
show_statistics() {
    log_info "Backup Statistics:"
    
    local backup_dir="$PROJECT_DIR/backups"
    
    if [[ ! -d "$backup_dir" ]]; then
        log_warning "No backup directory found"
        return
    fi
    
    echo
    echo "Total Backup Size:"
    du -sh "$backup_dir" 2>/dev/null || echo "  Unable to calculate"
    
    echo
    echo "Database Backups:"
    local db_count=$(find "$backup_dir" -name "*db_*.sql.gz*" -type f | wc -l)
    local db_size=$(find "$backup_dir" -name "*db_*.sql.gz*" -type f -exec du -ch {} + 2>/dev/null | tail -1 | cut -f1)
    echo "  Count: $db_count"
    echo "  Size: $db_size"
    
    echo
    echo "File Backups:"
    local file_count=$(find "$backup_dir" -name "*files_*.tar.gz*" -type f | wc -l)
    local file_size=$(find "$backup_dir" -name "*files_*.tar.gz*" -type f -exec du -ch {} + 2>/dev/null | tail -1 | cut -f1)
    echo "  Count: $file_count"
    echo "  Size: $file_size"
    echo
}

# Main function
main() {
    case "${1:-help}" in
        database)
            load_environment
            backup_database
            ;;
        files)
            load_environment
            backup_files
            ;;
        all)
            load_environment
            backup_database
            backup_files
            ;;
        list)
            list_backups
            ;;
        restore)
            if [[ -z "${2:-}" ]]; then
                log_error "Please specify backup file to restore"
                exit 1
            fi
            load_environment
            restore_database "$2"
            ;;
        verify)
            if [[ -z "${2:-}" ]]; then
                log_error "Please specify backup file to verify"
                exit 1
            fi
            verify_backup "$2"
            ;;
        stats)
            show_statistics
            ;;
        help|--help|-h)
            cat << EOF
SentryVision Backup Script

Usage: $0 [COMMAND] [OPTIONS]

Commands:
    database       Backup database only
    files          Backup application files only
    all            Backup both database and files (default)
    list           List all available backups
    restore FILE   Restore database from backup file
    verify FILE    Verify backup file integrity
    stats          Show backup statistics
    help           Show this help message

Examples:
    $0 database                    # Backup database only
    $0 all                         # Backup database and files
    $0 list                        # List all backups
    $0 restore /path/to/backup.sql.gz  # Restore from backup
    $0 verify /path/to/backup.sql.gz    # Verify backup integrity

Environment:
    Backup settings are configured in .env.production:
    - BACKUP_RETENTION_DAYS: Number of days to keep backups
    - BACKUP_ENCRYPTION_ENABLED: Enable backup encryption
    - BACKUP_ENCRYPTION_KEY: Key for backup encryption
EOF
            ;;
        *)
            load_environment
            backup_database
            backup_files
            ;;
    esac
}

# Run main function with all arguments
main "$@"