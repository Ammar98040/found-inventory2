from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone

class Warehouse(models.Model):
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    rows_count = models.IntegerField(default=0)
    columns_count = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    def __str__(self):
        return self.name

class Location(models.Model):
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE)
    row = models.IntegerField()
    column = models.IntegerField()
    notes = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = (('warehouse', 'row', 'column'),)

    def __str__(self):
        return f"R{self.row}C{self.column}"

    def get_grid_position(self):
        return {'x': self.column, 'y': self.row}

    @property
    def full_location(self):
        return f"R{self.row}C{self.column}"

class Container(models.Model):
    name = models.CharField(unique=True, max_length=100)
    description = models.TextField(blank=True, null=True)
    color = models.CharField(max_length=7, default="#FFFFFF")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class Product(models.Model):
    product_number = models.CharField(unique=True, max_length=100)
    name = models.CharField(max_length=200)
    category = models.CharField(max_length=100, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    quantity = models.IntegerField(default=0)
    location = models.ForeignKey(Location, on_delete=models.SET_NULL, blank=True, null=True, related_name='products')

    image = models.ImageField(upload_to='products/', blank=True, null=True)
    container = models.ForeignKey(Container, on_delete=models.SET_NULL, blank=True, null=True, related_name='products')
    barcode = models.CharField(max_length=100, blank=True, null=True)
    image_url = models.CharField(max_length=500, blank=True, null=True)
    min_stock_threshold = models.IntegerField(default=0)
    price = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    store_quantity = models.IntegerField(default=0)
    warehouse_quantity = models.IntegerField(default=0)
    colors = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.product_number} - {self.name}"



class Order(models.Model):
    order_number = models.CharField(unique=True, max_length=50)
    products_data = models.JSONField(default=dict)
    total_products = models.IntegerField(default=0)
    total_quantities = models.IntegerField(default=0)
    notes = models.TextField(blank=True, null=True)
    user = models.CharField(max_length=100)
    recipient_name = models.CharField(max_length=200, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.order_number

class ProductReturn(models.Model):
    return_number = models.CharField(unique=True, max_length=50)
    products_data = models.JSONField(default=dict)
    total_products = models.IntegerField(default=0)
    total_quantities = models.IntegerField(default=0)
    return_reason = models.CharField(max_length=200, blank=True, null=True)
    returned_by = models.CharField(max_length=200, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    user = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.return_number

class AuditLog(models.Model):
    ACTION_CHOICES = (
        ('quantity_taken', 'سحب كمية'),
        ('added', 'إضافة منتج'),
        ('updated', 'تحديث منتج'),
        ('deleted', 'حذف منتج'),
        ('location_assigned', 'تعيين موقع'),
        ('location_removed', 'إزالة موقع'),
        ('quantity_added', 'إضافة كمية'),
        ('order_created', 'إنشاء طلب'),
    )
    action = models.CharField(max_length=20)
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, blank=True, null=True, related_name='audit_logs')
    product_number = models.CharField(max_length=50)
    quantity_before = models.IntegerField(blank=True, null=True)
    quantity_after = models.IntegerField(blank=True, null=True)
    quantity_change = models.IntegerField()
    notes = models.TextField()
    user = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)
    product_snapshot = models.JSONField(blank=True, null=True)

    def __str__(self):
        return f"{self.action} - {self.product_number}"

class UserProfile(models.Model):
    USER_TYPES = (
        ('admin', 'مسؤول'),
        ('staff', 'موظف'),
        ('viewer', 'مشاهد'),
    )
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='user_profile')
    user_type = models.CharField(max_length=10, choices=USER_TYPES)
    phone = models.CharField(max_length=20, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_activity = models.DateTimeField(blank=True, null=True)
    last_login_ip = models.GenericIPAddressField(blank=True, null=True)

    def is_admin(self):
        return self.user_type == 'admin' or self.user.is_superuser

    def can_access_maintenance(self):
        return self.is_admin()

    def can_access_admin_dashboard(self):
        return self.is_admin()

    def __str__(self):
        return self.user.username

class SecureBackup(models.Model):
    """
    نموذج النسخ الاحتياطي الآمن (الصندوق الأسود).
    يقوم بتخزين نسخة كاملة من أي سجل يتم إنشاؤه أو تعديله في النظام.
    لا يتم عرض هذه البيانات في الواجهة العادية وتستخدم فقط للاسترجاع في حالات الطوارئ.
    """
    ACTION_CHOICES = (
        ('create', 'إنشاء'),
        ('update', 'تحديث'),
        ('delete', 'حذف'),
    )
    
    table_name = models.CharField(max_length=100)
    record_id = models.IntegerField()
    backup_data = models.JSONField(default=dict)  # نسخة كاملة من البيانات
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    timestamp = models.DateTimeField(auto_now_add=True)
    hash_signature = models.CharField(max_length=64, blank=True, null=True)  # توقيع رقمي لضمان عدم التلاعب

    class Meta:
        indexes = [
            models.Index(fields=['table_name', 'record_id']),
            models.Index(fields=['timestamp']),
        ]
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.table_name} #{self.record_id} ({self.action})"

class UserActivityLog(models.Model):
    ACTION_TYPES = (
        ('login', 'تسجيل دخول'),
        ('logout', 'تسجيل خروج'),
        ('page_viewed', 'عرض صفحة'),
        ('user_created', 'إنشاء موظف'),
        ('user_updated', 'تحديث موظف'),
        ('user_deleted', 'حذف موظف'),
        ('user_viewed', 'عرض موظف'),
        ('order_created', 'إنشاء طلب'),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE)
    action = models.CharField(max_length=50)
    description = models.CharField(max_length=500)
    object_type = models.CharField(max_length=100, blank=True, null=True)
    object_id = models.IntegerField(blank=True, null=True)
    object_name = models.CharField(max_length=200, blank=True, null=True)
    details = models.JSONField(default=dict)
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    user_agent = models.TextField(blank=True, null=True)
    location = models.CharField(max_length=100, blank=True, null=True)
    url = models.CharField(max_length=500, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @classmethod
    def log_activity(cls, user, action, description, request=None, **kwargs):
        try:
            ip_address = None
            user_agent = None
            url = None
            
            if request:
                x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
                if x_forwarded_for:
                    ip_address = x_forwarded_for.split(',')[0]
                else:
                    ip_address = request.META.get('REMOTE_ADDR')
                
                user_agent = request.META.get('HTTP_USER_AGENT')
                url = request.path
            
            cls.objects.create(
                user=user,
                action=action,
                description=description,
                ip_address=ip_address,
                user_agent=user_agent,
                url=url,
                **kwargs
            )
        except Exception:
            pass

    def __str__(self):
        return f"{self.user.username} - {self.action}"


