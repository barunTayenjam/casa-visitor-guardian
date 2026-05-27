#!/bin/bash

# SentryVision Health Check Script
# Monitors service health and sends alerts

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
LOG_FILE="$PROJECT_DIR/logs/health-check.log"

# Health check thresholds
MAX_CPU_USAGE=80
MAX_MEMORY_USAGE=80
MAX_DISK_USAGE=85
MAX_RESPONSE_TIME=5000  # milliseconds
HEALTH_CHECK_TIMEOUT=10

# Log functions
log_info() {
    local message="[$(date '+%Y-%m-%d %H:%M:%S')] [INFO] $1"
    echo -e "${BLUE}[INFO]${NC} $1"
    echo "$message" >> "$LOG_FILE"
}

log_success() {
    local message="[$(date '+%Y-%m-%d %H:%M:%S')] [SUCCESS] $1"
    echo -e "${GREEN}[SUCCESS]${NC} $1"
    echo "$message" >> "$LOG_FILE"
}

log_warning() {
    local message="[$(date '+%Y-%m-%d %H:%M:%S')] [WARNING] $1"
    echo -e "${YELLOW}[WARNING]${NC} $1"
    echo "$message" >> "$LOG_FILE"
}

log_error() {
    local message="[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] $1"
    echo -e "${RED}[ERROR]${NC} $1"
    echo "$message" >> "$LOG_FILE"
}

# Send alert
send_alert() {
    local severity="$1"
    local message="$2"
    
    log_warning "ALERT: $message"
    
    # Send webhook if configured
    if [[ -n "${WEBHOOK_URL:-}" ]]; then
        curl -s -X POST "$WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{
                \"severity\": \"$severity\",
                \"message\": \"$message\",
                \"timestamp\": \"$(date -Iseconds)\",
                \"service\": \"sentryvision\"
            }" || log_error "Failed to send webhook alert"
    fi
    
    # Send Slack notification if configured
    if [[ -n "${SLACK_WEBHOOK:-}" ]]; then
        curl -s -X POST "$SLACK_WEBHOOK" \
            -H "Content-Type: application/json" \
            -d "{
                \"text\": \"SentryVision Alert [$severity]: $message\",
                \"color\": \"$([ \"$severity\" = \"critical\" ] && echo \"danger\" || echo \"warning\")\"
            }" || log_error "Failed to send Slack alert"
    fi
}

# Load environment variables
load_environment() {
    if [[ ! -f "$ENV_FILE" ]]; then
        log_error "Environment file not found: $ENV_FILE"
        exit 1
    fi
    
    source "$ENV_FILE"
}

# Check Docker services
check_docker_services() {
    log_info "Checking Docker services..."
    
    cd "$PROJECT_DIR"
    
    local unhealthy_services=()
    local stopped_services=()
    
    # Check if all services are running
    while IFS= read -r service; do
        if ! docker-compose -f "$COMPOSE_FILE" ps -q "$service" | grep -q .; then
            stopped_services+=("$service")
        fi
    done < <(docker-compose -f "$COMPOSE_FILE" config --services)
    
    # Check service health
    while IFS= read -r service; do
        local health=$(docker inspect --format='{{.State.Health.Status}}' "sentryvision-$service" 2>/dev/null || echo "none")
        if [[ "$health" == "unhealthy" ]]; then
            unhealthy_services+=("$service")
        fi
    done < <(docker-compose -f "$COMPOSE_FILE" config --services)
    
    # Report issues
    if [[ ${#unhealthy_services[@]} -gt 0 ]]; then
        log_error "Unhealthy services: ${unhealthy_services[*]}"
        send_alert "critical" "Unhealthy services: ${unhealthy_services[*]}"
        return 1
    fi
    
    if [[ ${#stopped_services[@]} -gt 0 ]]; then
        log_error "Stopped services: ${stopped_services[*]}"
        send_alert "critical" "Stopped services: ${stopped_services[*]}"
        return 1
    fi
    
    log_success "All Docker services are healthy"
    return 0
}

# Check application health
check_application_health() {
    log_info "Checking application health..."
    
    local url="https://${DOMAIN:-localhost}/health"
    local start_time=$(date +%s%N)
    
    # Check if application responds
    if ! curl -f -s --max-time "$HEALTH_CHECK_TIMEOUT" "$url" >/dev/null 2>&1; then
        log_error "Application health check failed"
        send_alert "critical" "Application health check failed"
        return 1
    fi
    
    # Calculate response time
    local end_time=$(date +%s%N)
    local response_time=$(( (end_time - start_time) / 1000000 ))
    
    if [[ $response_time -gt $MAX_RESPONSE_TIME ]]; then
        log_warning "Slow response time: ${response_time}ms (threshold: ${MAX_RESPONSE_TIME}ms)"
        send_alert "warning" "Slow response time: ${response_time}ms"
    else
        log_success "Application health check passed (${response_time}ms)"
    fi
    
    return 0
}

# Check database health
check_database_health() {
    log_info "Checking database health..."
    
    cd "$PROJECT_DIR"
    
    # Check database connection
    if ! docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
        log_error "Database health check failed"
        send_alert "critical" "Database health check failed"
        return 1
    fi
    
    # Check database connections
    local connection_count=$(docker-compose -f "$COMPOSE_FILE" exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT count(*) FROM pg_stat_activity;" 2>/dev/null || echo "0")
    
    log_success "Database is healthy (connections: $connection_count)"
    return 0
}

# Check Redis health
check_redis_health() {
    log_info "Checking Redis health..."
    
    cd "$PROJECT_DIR"
    
    # Check Redis connection
    if ! docker-compose -f "$COMPOSE_FILE" exec -T redis redis-cli --raw incr ping >/dev/null 2>&1; then
        log_error "Redis health check failed"
        send_alert "critical" "Redis health check failed"
        return 1
    fi
    
    # Check Redis memory usage
    local redis_memory=$(docker-compose -f "$COMPOSE_FILE" exec -T redis redis-cli info memory 2>/dev/null | grep used_memory_human | cut -d: -f2 | tr -d '\r')
    log_success "Redis is healthy (memory: $redis_memory)"
    return 0
}

# Check system resources
check_system_resources() {
    log_info "Checking system resources..."
    
    local issues=()
    
    # Check CPU usage
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}' | cut -d. -f1)
    if [[ $cpu_usage -gt $MAX_CPU_USAGE ]]; then
        issues+=("High CPU usage: ${cpu_usage}% (threshold: ${MAX_CPU_USAGE}%)")
    fi
    
    # Check memory usage
    local memory_usage=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
    if [[ $memory_usage -gt $MAX_MEMORY_USAGE ]]; then
        issues+=("High memory usage: ${memory_usage}% (threshold: ${MAX_MEMORY_USAGE}%)")
    fi
    
    # Check disk usage
    local disk_usage=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
    if [[ $disk_usage -gt $MAX_DISK_USAGE ]]; then
        issues+=("High disk usage: ${disk_usage}% (threshold: ${MAX_DISK_USAGE}%)")
    fi
    
    # Report issues
    if [[ ${#issues[@]} -gt 0 ]]; then
        for issue in "${issues[@]}"; do
            log_warning "$issue"
        done
        send_alert "warning" "System resource issues: ${issues[*]}"
        return 1
    fi
    
    log_success "System resources are normal"
    return 0
}

# Check SSL certificate
check_ssl_certificate() {
    log_info "Checking SSL certificate..."
    
    local domain="${DOMAIN:-localhost}"
    
    if [[ "$domain" == "localhost" ]]; then
        log_info "Skipping SSL certificate check for localhost"
        return 0
    fi
    
    # Check certificate expiration
    local expiration_date=$(echo | openssl s_client -servername "$domain" -connect "$domain:443" 2>/dev/null | openssl x509 -noout -dates | grep notAfter | cut -d= -f2)
    local expiration_timestamp=$(date -d "$expiration_date" +%s)
    local current_timestamp=$(date +%s)
    local days_until_expiration=$(( (expiration_timestamp - current_timestamp) / 86400 ))
    
    if [[ $days_until_expiration -lt 30 ]]; then
        log_warning "SSL certificate expires in $days_until_expiration days"
        send_alert "warning" "SSL certificate expires in $days_until_expiration days"
        return 1
    else
        log_success "SSL certificate is valid ($days_until_expiration days remaining)"
    fi
    
    return 0
}

# Check disk space for backups
check_backup_space() {
    log_info "Checking backup space..."
    
    local backup_dir="$PROJECT_DIR/backups"
    local backup_usage=0
    
    if [[ -d "$backup_dir" ]]; then
        backup_usage=$(du -sh "$backup_dir" 2>/dev/null | cut -f1)
    fi
    
    # Check if backup directory size is getting large (>10GB)
    local backup_size_gb=$(du -s "$backup_dir" 2>/dev/null | cut -f1)
    backup_size_gb=$(( backup_size_gb / 1024 / 1024 ))
    
    if [[ $backup_size_gb -gt 10 ]]; then
        log_warning "Large backup directory: ${backup_usage} (${backup_size_gb}GB)"
        send_alert "warning" "Large backup directory: ${backup_usage}"
        return 1
    else
        log_success "Backup directory size: ${backup_usage}"
    fi
    
    return 0
}

# Check log file sizes
check_log_files() {
    log_info "Checking log file sizes..."
    
    local logs_dir="$PROJECT_DIR/logs"
    local large_logs=()
    
    if [[ -d "$logs_dir" ]]; then
        while IFS= read -r -d '' log_file; do
            local size=$(stat -f%z "$log_file" 2>/dev/null || stat -c%s "$log_file" 2>/dev/null)
            local size_mb=$(( size / 1024 / 1024 ))
            
            if [[ $size_mb -gt 100 ]]; then
                large_logs+=("$(basename "$log_file"): ${size_mb}MB")
            fi
        done < <(find "$logs_dir" -type f -size +100M -print0 2>/dev/null)
    fi
    
    if [[ ${#large_logs[@]} -gt 0 ]]; then
        log_warning "Large log files: ${large_logs[*]}"
        send_alert "warning" "Large log files: ${large_logs[*]}"
        return 1
    else
        log_success "Log file sizes are normal"
    fi
    
    return 0
}

# Generate health report
generate_health_report() {
    local report_file="$PROJECT_DIR/logs/health-report-$(date +%Y%m%d_%H%M%S).json"
    
    log_info "Generating health report..."
    
    # Collect health metrics
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}')
    local memory_usage=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
    local disk_usage=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
    local uptime=$(uptime -p 2>/dev/null || uptime)
    
    # Generate JSON report
    cat > "$report_file" << EOF
{
    "timestamp": "$(date -Iseconds)",
    "system": {
        "cpu_usage": $cpu_usage,
        "memory_usage": $memory_usage,
        "disk_usage": $disk_usage,
        "uptime": "$uptime"
    },
    "services": {
        "docker": "$(check_docker_services >/dev/null 2>&1 && echo 'healthy' || echo 'unhealthy')",
        "application": "$(check_application_health >/dev/null 2>&1 && echo 'healthy' || echo 'unhealthy')",
        "database": "$(check_database_health >/dev/null 2>&1 && echo 'healthy' || echo 'unhealthy')",
        "redis": "$(check_redis_health >/dev/null 2>&1 && echo 'healthy' || echo 'unhealthy')"
    },
    "checks": {
        "ssl_certificate": "$(check_ssl_certificate >/dev/null 2>&1 && echo 'healthy' || echo 'unhealthy')",
        "backup_space": "$(check_backup_space >/dev/null 2>&1 && echo 'healthy' || echo 'unhealthy')",
        "log_files": "$(check_log_files >/dev/null 2>&1 && echo 'healthy' || echo 'unhealthy')"
    }
}
EOF
    
    log_success "Health report generated: $report_file"
    echo "$report_file"
}

# Main health check function
run_health_check() {
    log_info "Starting SentryVision health check..."
    
    local overall_status=0
    
    # Run all health checks
    if ! check_docker_services; then
        overall_status=1
    fi
    
    if ! check_application_health; then
        overall_status=1
    fi
    
    if ! check_database_health; then
        overall_status=1
    fi
    
    if ! check_redis_health; then
        overall_status=1
    fi
    
    if ! check_system_resources; then
        overall_status=1
    fi
    
    if ! check_ssl_certificate; then
        overall_status=1
    fi
    
    if ! check_backup_space; then
        overall_status=1
    fi
    
    if ! check_log_files; then
        overall_status=1
    fi
    
    # Generate report
    generate_health_report
    
    # Report overall status
    if [[ $overall_status -eq 0 ]]; then
        log_success "All health checks passed"
    else
        log_error "Some health checks failed"
    fi
    
    return $overall_status
}

# Setup cron job for health monitoring
setup_cron() {
    log_info "Setting up health monitoring cron job..."
    
    local cron_entry="*/5 * * * * $SCRIPT_DIR/health.sh check >> $PROJECT_DIR/logs/health-check.log 2>&1"
    
    # Add to crontab
    (crontab -l 2>/dev/null | grep -v "$SCRIPT_DIR/health.sh"; echo "$cron_entry") | crontab -
    
    log_success "Health monitoring cron job added (runs every 5 minutes)"
}

# Remove cron job
remove_cron() {
    log_info "Removing health monitoring cron job..."
    
    crontab -l 2>/dev/null | grep -v "$SCRIPT_DIR/health.sh" | crontab -
    
    log_success "Health monitoring cron job removed"
}

# Show help
show_help() {
    cat << EOF
SentryVision Health Check Script

Usage: $0 [COMMAND]

Commands:
    check          Run all health checks (default)
    docker         Check Docker services only
    application     Check application health only
    database       Check database health only
    redis          Check Redis health only
    system         Check system resources only
    ssl            Check SSL certificate only
    report         Generate health report only
    setup-cron     Setup cron job for monitoring
    remove-cron    Remove cron job for monitoring
    help           Show this help message

Examples:
    $0 check                # Run all health checks
    $0 docker               # Check Docker services only
    $0 setup-cron           # Setup automatic monitoring

Environment:
    Health check thresholds are configured at the top of this script.
    Alert configuration is in .env.production:
    - WEBHOOK_URL: Generic webhook URL
    - SLACK_WEBHOOK: Slack webhook URL
EOF
}

# Main function
main() {
    case "${1:-check}" in
        check)
            load_environment
            run_health_check
            ;;
        docker)
            load_environment
            check_docker_services
            ;;
        application)
            load_environment
            check_application_health
            ;;
        database)
            load_environment
            check_database_health
            ;;
        redis)
            load_environment
            check_redis_health
            ;;
        system)
            check_system_resources
            ;;
        ssl)
            load_environment
            check_ssl_certificate
            ;;
        report)
            load_environment
            generate_health_report
            ;;
        setup-cron)
            setup_cron
            ;;
        remove-cron)
            remove_cron
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "Unknown command: $1"
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"