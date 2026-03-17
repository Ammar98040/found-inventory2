#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
تصدير قاعدة بيانات SQLite إلى ملف SQL متوافق مع PostgreSQL
للاستخدام عند النشر على منصة تستخدم PostgreSQL
"""
import sqlite3
import sys
import io
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
import sys
from pathlib import Path

# إعداد المسار
BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / 'db.sqlite3'
OUTPUT_PATH = BASE_DIR / 'full_db_backup.sql'

# تحويل أنواع SQLite إلى PostgreSQL
SQLITE_TO_PG = {
    'INTEGER': 'BIGINT',
    'TEXT': 'TEXT',
    'REAL': 'DOUBLE PRECISION',
    'BLOB': 'BYTEA',
    'NUMERIC': 'NUMERIC',
    'DECIMAL': 'NUMERIC',
    'BOOLEAN': 'BOOLEAN',
    'BOOL': 'BOOLEAN',
    'DATETIME': 'TIMESTAMP WITH TIME ZONE',
    'DATE': 'DATE',
    'VARCHAR': 'VARCHAR',
    'CHAR': 'CHAR',
}


def get_pg_type(sqlite_type):
    """تحويل نوع SQLite إلى PostgreSQL"""
    if not sqlite_type:
        return 'TEXT'
    t = sqlite_type.upper().split('(')[0]
    return SQLITE_TO_PG.get(t, 'TEXT')


def escape_pg(value):
    """تهريب القيم لـ PostgreSQL"""
    if value is None:
        return 'NULL'
    if isinstance(value, bool):
        return 'TRUE' if value else 'FALSE'
    if isinstance(value, (int, float)):
        return str(value)
    s = str(value).replace('\\', '\\\\').replace("'", "''")
    return f"'{s}'"


def export_to_postgres():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # الحصول على قائمة الجداول
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    )
    tables = [r[0] for r in cursor.fetchall()]

    lines = []
    lines.append("-- ============================================")
    lines.append("-- Full Database Backup - SQLite to PostgreSQL")
    lines.append("-- Inventory Management System")
    lines.append("--")
    lines.append("-- Restore: psql -U USER -d DB_NAME -f full_db_backup.sql")
    lines.append("-- ============================================")
    lines.append("")
    lines.append("-- تعطيل التحقق من المفاتيح الخارجية مؤقتاً")
    lines.append("SET session_replication_role = 'replica';")
    lines.append("")

    for table in tables:
        # الحصول على بنية الجدول
        cursor.execute(f"PRAGMA table_info('{table}')")
        columns = cursor.fetchall()
        col_names = [c[1] for c in columns]
        col_types = {c[1]: get_pg_type(c[2]) for c in columns}
        pk_col = next((c[1] for c in columns if c[5]), None)

        # إنشاء الجدول
        lines.append(f"-- جدول: {table}")
        lines.append(f"DROP TABLE IF EXISTS \"{table}\" CASCADE;")
        col_defs = []
        for c in columns:
            cname, ctype, notnull, default, pk = c[1], get_pg_type(c[2]), c[3], c[4], c[5]
            part = f'    "{cname}" {ctype}'
            if notnull:
                part += ' NOT NULL'
            if default:
                part += f' DEFAULT {default}'
            if pk:
                part += ' PRIMARY KEY'
            col_defs.append(part)
        lines.append(f"CREATE TABLE \"{table}\" (")
        lines.append(",\n".join(col_defs))
        lines.append(");")
        lines.append("")

        # إدراج البيانات
        cursor.execute(f'SELECT * FROM "{table}"')
        rows = cursor.fetchall()
        if rows:
            for row in rows:
                vals = []
                for i, col in enumerate(col_names):
                    val = row[i]
                    vals.append(escape_pg(val))
                cols_str = ", ".join(f'"{c}"' for c in col_names)
                vals_str = ", ".join(vals)
                lines.append(f'INSERT INTO "{table}" ({cols_str}) VALUES ({vals_str});')
            lines.append("")

    # إعادة تعيين التسلسلات للمفاتيح التلقائية (لتوافق Django)
    lines.append("-- إعادة تعيين التسلسلات للمفاتيح التلقائية")
    for table in tables:
        cursor.execute(f"PRAGMA table_info('{table}')")
        cols = cursor.fetchall()
        pk_col = next((c[1] for c in cols if c[5]), None)
        if pk_col:
            lines.append(f"DO $$ BEGIN PERFORM setval(pg_get_serial_sequence('\"{table}\"', '{pk_col}'), COALESCE((SELECT MAX(\"{pk_col}\") FROM \"{table}\"), 1)); EXCEPTION WHEN undefined_object THEN NULL; END $$;")
    lines.append("")

    lines.append("-- إعادة تفعيل التحقق")
    lines.append("SET session_replication_role = 'origin';")
    lines.append("")

    conn.close()

    # كتابة الملف
    output = "\n".join(lines)
    OUTPUT_PATH.write_text(output, encoding='utf-8')
    print(f"OK - Backup created: {OUTPUT_PATH}")
    print(f"  حجم الملف: {len(output):,} حرف")
    return OUTPUT_PATH


if __name__ == '__main__':
    if not DB_PATH.exists():
        print(f"ERROR: File not found: {DB_PATH}")
        sys.exit(1)
    try:
        export_to_postgres()
    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)
