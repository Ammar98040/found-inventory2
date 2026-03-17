# دليل النشر على VPS (Dokploy)

## الخطوات

### 1. إنشاء ملف ZIP للنشر
- تأكد أن ملف `.env.deploy` موجود في المشروع
- اضغط مجلد المشروع كاملاً بصيغة ZIP
- أو استخدم Git: `git archive -o deploy.zip HEAD`

### 2. رفع على Dokploy
- ارفع ملف ZIP
- تأكد أن **Port** مضبوط على **8000**
- أضف النطاق: `inventory.qrtably.com`
- تأكد أن النطاق يشير إلى IP السيرفر (31.97.197.188)

### 3. إنشاء مدير النظام (بعد أول تشغيل)
اتصل بالحاوية أو استخدم Terminal في Dokploy:
```bash
python manage.py createsuperuser
```

### 4. إعدادات .env.deploy الحالية
- DEBUG=False
- USE_FILE_LOGGING=False (لتقليل أخطاء "Too many open files")
- SQLite مفعّل
- النطاقات: inventory.qrtably.com + IP السيرفر

### 5. إذا ظهر خطأ "Too many open files"
نفّذ على السيرفر عبر SSH:
```bash
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
echo fs.inotify.max_user_instances=512 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```
