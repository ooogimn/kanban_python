"""
Кастомный Database Backend для обхода проблем с кодировкой на Windows.
"""
import os
import sys
import urllib.parse

# Устанавливаем кодировку UTF-8 ДО любых импортов psycopg2
if sys.platform == 'win32':
    os.environ.setdefault('PYTHONIOENCODING', 'utf-8')
    # Также устанавливаем для текущего процесса
    if hasattr(sys.stdout, 'reconfigure'):
        try:
            sys.stdout.reconfigure(encoding='utf-8')
        except:
            pass
    if hasattr(sys.stderr, 'reconfigure'):
        try:
            sys.stderr.reconfigure(encoding='utf-8')
        except:
            pass

from django.db.backends.postgresql.base import DatabaseWrapper as PostgreSQLDatabaseWrapper

# psycopg3 лучше работает с кодировками, патч не требуется
# Но оставляем очистку переменных окружения для безопасности


class DatabaseWrapper(PostgreSQLDatabaseWrapper):
    """
    Обёртка для PostgreSQL backend, которая очищает проблемные переменные окружения
    перед подключением к базе данных.
    """
    
    def safe_decode_value(self, value):
        """Безопасно декодирует значение, обрабатывая проблемы с кодировкой."""
        if value is None:
            return None
        if isinstance(value, bytes):
            try:
                return value.decode('utf-8')
            except UnicodeDecodeError:
                try:
                    return value.decode('latin-1')
                except UnicodeDecodeError:
                    return value.decode('cp1251', errors='ignore')
        if isinstance(value, str):
            try:
                # Проверяем, что строка может быть закодирована в UTF-8
                value.encode('utf-8')
                return value
            except UnicodeEncodeError:
                # Если не может, пытаемся исправить
                try:
                    return value.encode('latin-1').decode('utf-8', errors='ignore')
                except:
                    return value.encode('utf-8', errors='ignore').decode('utf-8', errors='ignore')
        return value
    
    def get_new_connection(self, conn_params):
        """
        Переопределяем метод подключения, чтобы очистить переменные окружения
        и декодировать параметры подключения перед созданием соединения.
        """
        # Сохраняем оригинальные переменные окружения
        original_env = {}
        pg_vars_to_backup = []
        
        if sys.platform == 'win32':
            # Список всех переменных PostgreSQL, которые psycopg2 может читать
            pg_vars = [
                'PGPASSWORD', 'PGDATABASE', 'PGUSER', 'PGHOST', 'PGPORT',
                'PGPASSFILE', 'PGSERVICE', 'PGSERVICEFILE', 'PGREALM',
                'PGOPTIONS', 'PGAPPNAME', 'PGSSLMODE', 'PGSSLROOTCERT',
                'PGSSLCERT', 'PGSSLKEY', 'PGSSLCRL', 'PGSSLCOMPRESSION',
                'PGREQUIRESSL', 'PGKRBSRVNAME', 'PGGSSLIB', 'PGCONNECT_TIMEOUT'
            ]
            
            # Сохраняем и удаляем все PG* переменные
            for var in pg_vars:
                if var in os.environ:
                    original_env[var] = os.environ[var]
                    pg_vars_to_backup.append(var)
                    del os.environ[var]
            
            # Также проверяем все переменные, начинающиеся с PG
            for key in list(os.environ.keys()):
                if key.startswith('PG') and key not in pg_vars:
                    try:
                        # Проверяем, можно ли закодировать значение
                        val = os.environ[key]
                        if isinstance(val, str):
                            val.encode('utf-8')
                    except (UnicodeEncodeError, UnicodeDecodeError, AttributeError):
                        # Если есть проблемы с кодировкой, удаляем
                        original_env[key] = os.environ[key]
                        pg_vars_to_backup.append(key)
                        del os.environ[key]
        
        # Декодируем все строковые значения в conn_params
        safe_conn_params = {}
        for key, value in conn_params.items():
            if isinstance(value, (str, bytes)):
                safe_conn_params[key] = self.safe_decode_value(value)
            elif isinstance(value, dict):
                # Если значение - словарь (например, options), декодируем его рекурсивно
                safe_dict = {}
                for k, v in value.items():
                    if isinstance(v, (str, bytes)):
                        safe_dict[k] = self.safe_decode_value(v)
                    else:
                        safe_dict[k] = v
                safe_conn_params[key] = safe_dict
            else:
                safe_conn_params[key] = value
        
        try:
            # psycopg3 лучше работает с кодировками, используем стандартный метод
            # Django автоматически использует psycopg3, если он установлен
            connection = super().get_new_connection(safe_conn_params)
            return connection
        finally:
            # Восстанавливаем переменные окружения (если нужно)
            # Обычно это не требуется, но на всякий случай
            if sys.platform == 'win32':
                for var in pg_vars_to_backup:
                    if var in original_env:
                        os.environ[var] = original_env[var]
