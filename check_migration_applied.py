#!/usr/bin/env python
"""Проверка применения миграции."""
import psycopg

try:
    # Подключение к БД
    conn = psycopg.connect(
        dbname='office_suite',
        user='postgres',
        password='12345',
        host='127.0.0.1',
        port='5432'
    )
    cursor = conn.cursor()
    
    print("=" * 80)
    print("ПРОВЕРКА МИГРАЦИИ")
    print("=" * 80)
    
    # Проверка поля logo в таблице projects
    print("\n1. Проверка поля 'logo' в таблице 'projects':")
    cursor.execute("""
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'projects' AND column_name = 'logo'
    """)
    result = cursor.fetchone()
    
    if result:
        print(f"   ✓ Поле 'logo' СУЩЕСТВУЕТ")
        print(f"     Тип: {result[1]}, Nullable: {result[2]}")
    else:
        print(f"   ✗ Поле 'logo' НЕ СУЩЕСТВУЕТ")
        print("\n   Применяю миграцию...")
        
        # Применение миграции вручную
        cursor.execute("""
            ALTER TABLE projects 
            ADD COLUMN logo VARCHAR(100) NULL
        """)
        conn.commit()
        print("   ✓ Поле 'logo' добавлено")
    
    # Проверка записи в django_migrations
    print("\n2. Проверка записи миграции в django_migrations:")
    cursor.execute("""
        SELECT name, applied
        FROM django_migrations
        WHERE app = 'todo' AND name = '0003_add_project_logo'
    """)
    migration_record = cursor.fetchone()
    
    if migration_record:
        print(f"   ✓ Миграция записана: {migration_record[0]}")
        print(f"     Применена: {migration_record[1]}")
    else:
        print(f"   ✗ Запись о миграции НЕ НАЙДЕНА")
        print("   Добавляю запись...")
        
        from datetime import datetime
        cursor.execute("""
            INSERT INTO django_migrations (app, name, applied)
            VALUES ('todo', '0003_add_project_logo', %s)
        """, [datetime.now()])
        conn.commit()
        print("   ✓ Запись добавлена")
    
    # Проверка данных
    print("\n3. Проверка данных в таблице projects:")
    cursor.execute("SELECT COUNT(*) FROM projects")
    count = cursor.fetchone()[0]
    print(f"   Проектов в БД: {count}")
    
    if count > 0:
        cursor.execute("SELECT id, name, logo FROM projects LIMIT 5")
        projects = cursor.fetchall()
        print("\n   Первые 5 проектов:")
        for proj in projects:
            print(f"     - ID: {proj[0]}, Name: {proj[1]}, Logo: {proj[2] or 'нет'}")
    
    cursor.close()
    conn.close()
    
    print("\n" + "=" * 80)
    print("ПРОВЕРКА ЗАВЕРШЕНА")
    print("=" * 80)
    print("\nМиграция применена успешно! Можно запускать сервер.")
    
except Exception as e:
    print(f"\nОШИБКА: {e}")
    import traceback
    traceback.print_exc()
