#!/bin/bash
set -e

# تشغيل migrations
echo "Running database migrations..."
python manage.py migrate --noinput

# جمع الملفات الثابتة (إن لم تكن موجودة)
python manage.py collectstatic --noinput --clear 2>/dev/null || true

# تشغيل التطبيق
exec gunicorn --bind 0.0.0.0:8000 inventory_project.wsgi:application
