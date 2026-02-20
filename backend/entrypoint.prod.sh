#!/bin/bash
set -e

DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"

# Ожидание доступности БД (проверка порта)
echo "Waiting for database at $DB_HOST:$DB_PORT..."
while ! python -c "
import socket
import os
try:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(2)
    s.connect((os.environ.get('DB_HOST', 'db'), int(os.environ.get('DB_PORT', '5432'))))
    s.close()
except Exception:
    exit(1)
" 2>/dev/null; do
    echo "Database is unavailable - sleeping 2s"
    sleep 2
done
echo "Database is up."

python manage.py migrate --noinput
python manage.py collectstatic --noinput

exec gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 3
