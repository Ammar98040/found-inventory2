#!/bin/bash
set -e

# استخدام إعدادات النشر إذا لم يكن .env موجوداً (اختياري)
[ ! -f .env ] && [ -f .env.deploy ] && cp .env.deploy .env || true

# تشغيل migrations
echo "Running database migrations..."
python manage.py migrate --noinput

# جمع الملفات الثابتة (إن لم تكن موجودة)
python manage.py collectstatic --noinput --clear 2>/dev/null || true

# تشغيل التطبيق (إعدادات الإنتاج)
exec gunicorn --bind 0.0.0.0:8000 \
  --workers 2 \
  --threads 4 \
  --timeout 120 \
  --access-logfile - \
  --error-logfile - \
  inventory_project.wsgi:application

