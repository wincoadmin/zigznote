#!/bin/bash
# Database restore script for ZigZNote
# Usage: ./scripts/restore.sh <backup_file.sql.gz> [--dry-run]

set -euo pipefail

# Configuration
BACKUP_FILE="${1:-}"
DRY_RUN=false

# Parse arguments
for arg in "$@"; do
    case $arg in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
    esac
done

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

# Show usage
usage() {
    echo "Usage: $0 <backup_file.sql.gz> [--dry-run]"
    echo ""
    echo "Arguments:"
    echo "  backup_file.sql.gz  Path to the backup file to restore"
    echo "  --dry-run           Verify backup without restoring"
    echo ""
    echo "Examples:"
    echo "  $0 ./backups/zigznote-backup-manual-20240115_120000.sql.gz"
    echo "  $0 ./backups/zigznote-backup-manual-20240115_120000.sql.gz --dry-run"
    exit 1
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
    local url="${DATABASE_URL#postgresql://}"

    local userpass="${url%%@*}"
    DB_USER="${userpass%%:*}"
    DB_PASS="${userpass#*:}"

    local hostportdb="${url#*@}"
    local hostport="${hostportdb%%/*}"
    DB_NAME="${hostportdb#*/}"
    DB_NAME="${DB_NAME%%\?*}"

    DB_HOST="${hostport%%:*}"
    DB_PORT="${hostport#*:}"

    if [[ "$DB_PORT" == "$DB_HOST" ]]; then
        DB_PORT="5432"
    fi
}

# Verify backup file
verify_backup() {
    log_info "Verifying backup file..."

    # Check if file exists
    if [[ ! -f "${BACKUP_FILE}" ]]; then
        log_error "Backup file not found: ${BACKUP_FILE}"
        exit 1
    fi

    # Verify checksum if available
    local checksum_file="${BACKUP_FILE}.sha256"
    if [[ -f "${checksum_file}" ]]; then
        log_info "Verifying checksum..."
        local expected_checksum=$(cat "${checksum_file}")
        local actual_checksum=$(sha256sum "${BACKUP_FILE}" | cut -d' ' -f1)

        if [[ "${expected_checksum}" != "${actual_checksum}" ]]; then
            log_error "Checksum verification failed!"
            log_error "Expected: ${expected_checksum}"
            log_error "Actual:   ${actual_checksum}"
            exit 1
        fi
        log_info "Checksum verified successfully"
    else
        log_warn "No checksum file found, skipping verification"
    fi

    # Verify backup format
    log_info "Checking backup format..."
    local header=$(gunzip -c "${BACKUP_FILE}" | head -20)

    if echo "${header}" | grep -qE "(PostgreSQL database dump|SET statement_timeout)"; then
        log_info "Backup format verified: valid PostgreSQL dump"
    else
        log_error "Invalid backup format - does not appear to be a PostgreSQL dump"
        exit 1
    fi

    # Show backup info
    local size=$(du -h "${BACKUP_FILE}" | cut -f1)
    log_info "Backup file size: ${size}"
}

# Create pre-restore backup
create_pre_restore_backup() {
    log_info "Creating pre-restore backup..."

    local timestamp=$(date +%Y%m%d_%H%M%S)
    local pre_restore_file="./backups/zigznote-pre-restore-${timestamp}.sql.gz"

    mkdir -p ./backups

    PGPASSWORD="${DB_PASS}" pg_dump \
        -h "${DB_HOST}" \
        -p "${DB_PORT}" \
        -U "${DB_USER}" \
        -d "${DB_NAME}" \
        --format=plain \
        --no-owner \
        --no-acl | gzip -9 > "${pre_restore_file}"

    log_info "Pre-restore backup saved: ${pre_restore_file}"
}

# Restore the database
restore_database() {
    log_info "Starting database restore..."
    log_warn "This will OVERWRITE the current database!"

    if [[ "${DRY_RUN}" == "true" ]]; then
        log_info "DRY RUN MODE - Skipping actual restore"
        log_info "Backup verification completed successfully"
        return
    fi

    # Confirm with user
    echo ""
    read -p "Are you sure you want to restore? (yes/no): " confirm
    if [[ "${confirm}" != "yes" ]]; then
        log_info "Restore cancelled by user"
        exit 0
    fi

    # Create pre-restore backup
    create_pre_restore_backup

    log_info "Restoring database..."

    # Restore from backup
    gunzip -c "${BACKUP_FILE}" | PGPASSWORD="${DB_PASS}" psql \
        -h "${DB_HOST}" \
        -p "${DB_PORT}" \
        -U "${DB_USER}" \
        -d "${DB_NAME}" \
        -v ON_ERROR_STOP=1

    log_info "Database restore completed successfully!"
}

# Main
main() {
    log_info "ZigZNote Database Restore"
    log_info "========================="

    if [[ -z "${BACKUP_FILE}" ]]; then
        usage
    fi

    check_environment
    parse_database_url
    verify_backup

    echo ""
    log_info "Target database: ${DB_NAME}@${DB_HOST}:${DB_PORT}"

    restore_database

    if [[ "${DRY_RUN}" == "false" ]]; then
        log_info "Restore operation completed!"
        log_warn "Please verify your application is working correctly"
    fi
}

main "$@"
