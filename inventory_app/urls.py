from django.urls import path
from . import views

app_name = 'inventory_app'

urlpatterns = [
    path('', views.home, name='home'),
    path('api/search/', views.search_products, name='search_products'),
    path('api/analyze-image/', views.analyze_image_view, name='analyze_image'),
    path('api/confirm-products/', views.confirm_products, name='confirm_products'),
    path('api/products/', views.get_products_list, name='products_list'),
    path('api/get-stats/', views.get_stats, name='get_stats'),
    
    # البحث السريع
    path('api/search-products/', views.quick_search_products, name='quick_search_products'),
    path('api/search-locations/', views.quick_search_locations, name='quick_search_locations'),
    
    # إدارة المستودع
    path('manage/', views.manage_warehouse, name='manage_warehouse'),
    path('api/grid/', views.get_warehouse_grid, name='get_grid'),
    path('api/add-row/', views.add_row, name='add_row'),
    path('api/add-column/', views.add_column, name='add_column'),
    path('api/delete-row/', views.delete_row, name='delete_row'),
    path('api/delete-column/', views.delete_column, name='delete_column'),
    path('api/compact-row/', views.compact_row, name='compact_row'),
    path('api/compact-column/', views.compact_column, name='compact_column'),
    path('api/revert-compaction/', views.revert_compaction, name='revert_compaction'),
    
    # لوحة التحكم
    path('dashboard/', views.warehouse_dashboard, name='dashboard'),
    
    # إدارة المنتجات الكاملة
    path('products/', views.products_list, name='products_list'),
    path('products/add/', views.product_add, name='product_add'),
    path('products/<int:product_id>/', views.product_detail, name='product_detail'),
    path('products/<int:product_id>/edit/', views.product_edit, name='product_edit'),
    path('products/<int:product_id>/delete/', views.product_delete, name='product_delete'),
    path('products/<int:product_id>/assign/', views.assign_location_to_product, name='assign_location'),
    path('products/<int:product_id>/move/', views.move_product_with_shift, name='move_product_with_shift'),
    path('api/delete-products-bulk/', views.delete_products_bulk, name='delete_products_bulk'),

    
    # تصدير البيانات
    path('export/products/excel/', views.export_products_excel, name='export_products_excel'),
    path('export/products/pdf/', views.export_products_pdf, name='export_products_pdf'),
    path('export/order/<int:order_id>/pdf/', views.export_order_pdf, name='export_order_pdf'),
    
    # استيراد المنتجات من Excel
    path('products/import-excel/', views.import_products_excel, name='import_products_excel'),
    path('api/upload-excel/', views.upload_excel_file, name='upload_excel_file'),
    path('api/preview-excel/', views.preview_excel_data, name='preview_excel_data'),
    path('api/process-excel/', views.process_excel_data, name='process_excel_data'),
    
    # إدارة المستودعات
    path('warehouses/', views.warehouses_list, name='warehouses_list'),
    path('warehouses/<int:warehouse_id>/', views.warehouse_detail, name='warehouse_detail'),
    
    # إدارة الأماكن
    path('locations/', views.locations_list, name='locations_list'),
    path('api/update-location-notes/', views.update_location_notes, name='update_location_notes'),
    
    # سجلات العمليات
    path('audit-logs/', views.audit_logs, name='audit_logs'),
    path('audit-logs/restore/<int:log_id>/', views.restore_product, name='restore_product'),
    
    # النسخ الاحتياطي والاستعادة
    path('backup-restore/', views.backup_restore_page, name='backup_restore'),
    path('api/export-backup/', views.export_backup, name='export_backup'),
    path('api/inspect-backup/', views.inspect_backup, name='inspect_backup'),
    path('api/import-backup/', views.import_backup, name='import_backup'),
    path('api/reset-environment/', views.reset_environment, name='reset_environment'),
    path('api/low-stock/', views.low_stock_products_api, name='low_stock_products_api'),
    
    # دمج ملفات المنتجات (Excel/JSON)
    path('merge-files/', views.merge_files_page, name='merge_files_page'),
    path('api/merge-files/upload/', views.merge_files_upload, name='merge_files_upload'),
    path('api/merge-files/process/', views.merge_files_process, name='merge_files_process'),
    path('api/merge-files/export/', views.merge_files_export, name='merge_files_export'),
    
    # حذف البيانات
    path('data-deletion/', views.data_deletion_page, name='data_deletion'),
    path('api/delete-data/', views.delete_data, name='delete_data'),
    
    # جودة البيانات وتوصيات المخزون
    # (Removed duplicates)
    
    # إدارة الطلبات المسحوبة
    path('orders/', views.orders_list, name='orders_list'),
    path('orders/<int:order_id>/', views.order_detail, name='order_detail'),
    path('api/delete-order/<int:order_id>/', views.delete_order, name='delete_order'),
    path('api/search-order-history/', views.search_order_history, name='search_order_history'),
    path('api/recipients-stats/', views.get_all_recipients_stats, name='get_all_recipients_stats'),
    
    # المرتجعات
    path('returns/', views.returns_list, name='returns_list'),
    path('returns/add/', views.add_return, name='add_return'),
    path('returns/<int:return_id>/', views.return_detail, name='return_detail'),
    path('api/process-return/', views.process_return, name='process_return'),
    
    # نظام المستخدمين
    path('register/', views.register_staff, name='register_staff'),
    path('admin-dashboard/', views.admin_dashboard, name='admin_dashboard'),
    path('staff-dashboard/', views.staff_dashboard, name='staff_dashboard'),
    path('profile/', views.user_profile, name='user_profile'),
    
    # إدارة الموظفين (للمسؤول فقط)
    path('staff/<int:user_id>/view/', views.view_staff, name='view_staff'),
    path('staff/<int:user_id>/edit/', views.edit_staff, name='edit_staff'),
    path('api/toggle-staff-active/<int:user_id>/', views.toggle_staff_active, name='toggle_staff_active'),
    path('api/delete-staff/<int:user_id>/', views.delete_staff, name='delete_staff'),
    
    # إدارة الحاويات
    path('containers/', views.container_list, name='container_list'),
    path('api/container/add/', views.container_add, name='container_add'),
    path('api/container/<int:container_id>/delete/', views.container_delete, name='container_delete'),
    path('api/assign-products-to-container/', views.assign_products_to_container, name='assign_products_to_container'),

    # النسخ الاحتياطي الآمن (الصندوق الأسود)
    path('secure-backup/login/', views.secure_backup_login, name='secure_backup_login'),
    path('secure-backup/', views.secure_backup_dashboard, name='secure_backup_dashboard'),
    path('api/secure-backup/export/', views.export_secure_backup, name='export_secure_backup'),
    path('api/secure-backup/<int:backup_id>/', views.get_secure_backup_detail, name='get_secure_backup_detail'),

    # أدوات الجودة والتحليل
    path('data-quality/', views.data_quality, name='data_quality'),
    path('inventory-insights/', views.inventory_insights, name='inventory_insights'),

]
