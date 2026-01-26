"""
URL configuration for inventory_project project.
"""
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.static import serve
from inventory_app import views
from django.http import HttpResponse
import os

def sys_check(request):
    if not request.user.is_staff:
        return HttpResponse("Access Denied", status=403)
    
    lines = []
    lines.append(f"BASE_DIR: {settings.BASE_DIR}")
    lines.append(f"MEDIA_ROOT: {settings.MEDIA_ROOT}")
    lines.append(f"MEDIA_URL: {settings.MEDIA_URL}")
    
    if os.path.exists(settings.MEDIA_ROOT):
        lines.append("MEDIA_ROOT exists: YES")
        try:
            files = os.listdir(settings.MEDIA_ROOT)
            lines.append(f"Files in MEDIA_ROOT: {files}")
            
            products_dir = os.path.join(settings.MEDIA_ROOT, 'products')
            if os.path.exists(products_dir):
                lines.append(f"products dir exists: YES")
                p_files = os.listdir(products_dir)
                lines.append(f"Files in products dir: {p_files}")
            else:
                lines.append("products dir exists: NO")
                
            # Test Write
            test_file = os.path.join(settings.MEDIA_ROOT, 'test_write.txt')
            with open(test_file, 'w') as f:
                f.write('test')
            lines.append("Write permission: OK")
            os.remove(test_file)
            
        except Exception as e:
            lines.append(f"Error accessing media: {e}")
    else:
        lines.append("MEDIA_ROOT exists: NO")
        
    return HttpResponse("<br>".join(lines))

urlpatterns = [
    # فحص النظام
    path('sys-check/', sys_check),

    # تسجيل الدخول والخروج - مخصص
    path('login/', views.custom_login, name='login'),
    path('logout/', views.custom_logout, name='logout'),
    path('', include('inventory_app.urls')),
    
    # تغيير مسار الميديا لتجاوز إعدادات Nginx القديمة التي قد تسبب مشاكل
    re_path(r'^uploads/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
]

# Serve static files in development (Whitenoise handles this in production)
if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

