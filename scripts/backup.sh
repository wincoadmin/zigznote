#!/bin/bash
# Database backup script for ZigZNote
# Usage: ./scripts/backup.sh [full|manual|pre_migration]

set -euo pipefail

# Configuration
BACKUP_TYPE="${1:-manual}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="zigznote-backup-${BACKUP_TYPE}-${TIMESTAMP}.sql.gz"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check required environment variables
check_environment() {
    if [[ -z "${DATABASE_URL:-}" ]]; then
        log_error "DATABASE_URL environment variable is not set"
        exit 1
    fi
}

# Parse DATABASE_URL
parse_database_url() {
    # Extract components from postgresql://user:pass@host:port/dbname
    local url="${DATABASE_URL#postgresql://}"

    # Extract user:pass
    local userpass="${url%%@*}"
    DB_USER="${userpass%%:*}"
    DB_PASS="${userpass#*:}"

    # Extract host:port/dbname
    local hostportdb="${url#*@}"
    local hostport="${hostportdb%%/*}"
    DB_NAME="${hostportdb#*/}"
    DB_NAME="${DB_NAME%%\?*}" # Remove query params

    DB_HOST="${hostport%%:*}"
    DB_PORT="${hostport#*:}"

    # Default port if not specified
    if [[ "$DB_PORT" == "$DB_HOST" ]]; then
        DB_PORT="5432"
    fi
}

# Create backup directory if it doesn't exist
setup_backup_dir() {
    if [[ ! -d "$BACKUP_DIR" ]]; then
        log_info "Creating backup directory: $BACKUP_DIR"
        mkdir -p "$BACKUP_DIR"
    fi
}

# Create the backup
create_backup() {
    local backup_path="${BACKUP_DIR}/${BACKUP_FILE}"

    log_info "Starting ${BACKUP_TYPE} backup..."
    log_info "Database: ${DB_NAME}@${DB_HOST}:${DB_PORT}"
    log_info "Output: ${backup_path}"

    # Run pg_dump with compression
    PGPASSWORD="${DB_PASS}" pg_dump \
        -h "${DB_HOST}" \
        -p "${DB_PORT}" \
        -U "${DB_USER}" \
        -d "${DB_NAME}" \
        --format=plain \
        --no-owner \
        --no-acl \
        --clean \
        --if-exists | gzip -9 > "${backup_path}"

    # Verify backup was created
    if [[ -f "${backup_path}" ]]; then
        local size=$(du -h "${backup_path}" | cut -f1)
        log_info "Backup created successfully: ${size}"

        # Generate checksum
        local checksum=$(sha256sum "${backup_path}" | cut -d' ' -f1)
        echo "${checksum}" > "${backup_path}.sha256"
        log_info "Checksum: ${checksum}"

        echo ""
        echo "Backup file: ${backup_path}"
        echo "Checksum file: ${backup_path}.sha256"
    else
        log_error "Backup file was not created"
        exit 1
    fi
}

# Cleanup old backups (keep last N)
cleanup_old_backups() {
    local keep_count="${BACKUP_KEEP_COUNT:-10}"
    local backup_count=$(ls -1 "${BACKUP_DIR}"/zigznote-backup-*.sql.gz 2>/dev/null | wc -l)

    if [[ $backup_count -gt $keep_count ]]; then
        local to_delete=$((backup_count - keep_count))
        log_info "Cleaning up ${to_delete} old backup(s)..."

        ls -1t "${BACKUP_DIR}"/zigznote-backup-*.sql.gz | tail -n "${to_delete}" | while read file; do
            log_info "Removing: ${file}"
            rm -f "${file}" "${file}.sha256"
        done
    fi
}

# Main
main() {
    log_info "ZigZNote Database Backup"
    log_info "========================"

    check_environment
    parse_database_url
    setup_backup_dir
    create_backup
    cleanup_old_backups

    log_info "Backup completed successfully!"
}

main "$@"
