#!/usr/bin/env bash
set -e

echo "⏳  Waiting for MySQL (${MYSQL_HOST:-db}:3306)…"
until mysqladmin ping -h"${MYSQL_HOST:-db}" -P"${MYSQL_PORT:-3306}" --silent; do
    sleep 1
done
echo "✅  MySQL is up – running migrations"

python manage.py migrate --noinput
exec daphne -b 0.0.0.0 -p 8000 vault.asgi:application
