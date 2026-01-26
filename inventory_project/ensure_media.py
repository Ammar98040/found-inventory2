
import os
import sys

# التأكد من وجود مجلد الميديا عند بدء التشغيل
# هذا السكريبت سيتم تشغيله مع settings.py
def ensure_media_root_exists(media_root):
    try:
        if not os.path.exists(media_root):
            os.makedirs(media_root)
            print(f"Created MEDIA_ROOT at {media_root}")
        
        # التأكد من وجود مجلد products
        products_dir = os.path.join(media_root, 'products')
        if not os.path.exists(products_dir):
            os.makedirs(products_dir)
            print(f"Created products dir at {products_dir}")
    except Exception as e:
        print(f"Error creating media dirs: {e}")
