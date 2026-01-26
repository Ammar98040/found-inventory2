"""
URL configuration for inventory_project project.
"""
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.static import serve
from inventory_app import views

urlpatterns = [
    # تسجيل الدخول والخروج - مخصص
    path('login/', views.custom_login, name='login'),
    path('logout/', views.custom_logout, name='logout'),
    path('', include('inventory_app.urls')),
    
    # تقديم ملفات الميديا دائماً (حتى في الإنتاج) لأننا لا نتحكم في إعدادات Nginx
    re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
]

# Serve static files in development (Whitenoise handles this in production)
if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

