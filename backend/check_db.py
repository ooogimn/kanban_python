#!/usr/bin/env python
"""Проверка подключения к PostgreSQL. Запускайте в своём терминале: python check_db.py"""
import os
import sys

# .env в корне проекта (родитель backend)
_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_env = os.path.join(_root, ".env")
if os.path.exists(_env):
    with open(_env, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                k, _, v = line.partition("=")
                k, v = k.strip(), v.strip().strip('"').strip("'")
                os.environ.setdefault(k, v)

host = os.environ.get("DB_HOST", "127.0.0.1")
port = os.environ.get("DB_PORT", "5432")
name = os.environ.get("DB_NAME", "office_suite")
user = os.environ.get("DB_USER", "postgres")
password = os.environ.get("DB_PASSWORD", "postgres")

print(f"Подключение: host={host} port={port} db={name} user={user}")

try:
    import psycopg
    conn = psycopg.connect(
        host=host,
        port=int(port),
        dbname=name,
        user=user,
        password=password,
        connect_timeout=5,
    )
    cur = conn.cursor()
    cur.execute("SELECT 1")
    cur.fetchone()
    cur.execute("SELECT version();")
    version = cur.fetchone()[0]
    cur.close()
    conn.close()
    print("OK: подключение к PostgreSQL успешно.")
    print("Версия:", version[:80] + "..." if len(version) > 80 else version)
    sys.exit(0)
except Exception as e:
    print("ОШИБКА:", e)
    sys.exit(1)
