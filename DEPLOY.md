# نشر المشروع على Dokploy

## المتطلبات
- حساب Dokploy على VPS
- قاعدة بيانات PostgreSQL (من Dokploy أو خارجية)

## خطوات النشر

### 1. إنشاء قاعدة بيانات PostgreSQL
في Dokploy: Applications > Add Database > PostgreSQL

### 2. إضافة التطبيق
- Applications > Add Application > Docker Compose أو Dockerfile
- ربط المستودع: `https://github.com/Ammar98040/found-inventory2`

### 3. متغيرات البيئة (Environment Variables)
```
SECRET_KEY=your-secret-key
DEBUG=False
ALLOWED_HOSTS=your-domain.com,www.your-domain.com
USE_SQLITE=False
DB_NAME=inventory_db
DB_USER=inventory_user
DB_PASSWORD=your-password
DB_HOST=postgres
DB_PORT=5432
CSRF_TRUSTED_ORIGINS=https://your-domain.com,https://www.your-domain.com
```

### 4. استعادة البيانات
بعد النشر، استورد النسخة الاحتياطية:
```bash
psql -U inventory_user -d inventory_db -h postgres -f full_db_backup.sql
```

### 5. رفع الصور
انسخ مجلد `media/products/` إلى السيرفر أو استخدم النسخة الاحتياطية ZIP من النظام.
