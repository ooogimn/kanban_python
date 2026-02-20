"""
Кастомная команда runserver: запускает фронтенд (Vite) и бекенд (Django) одной командой.
Бекенд запускается через Daphne (ASGI), чтобы работали WebSocket (/ws/dashboard/ и др.).
Использование: python manage.py runserver
"""
import atexit
import subprocess
import sys
from pathlib import Path

from django.conf import settings
from django.core.management.commands.runserver import Command as BaseRunserverCommand


class Command(BaseRunserverCommand):
    help = "Запускает Django (через Daphne, с WebSocket) и фронтенд (Vite) одной командой. Флаг --backend-only — только бекенд."

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._vite_process = None

    def add_arguments(self, parser):
        super().add_arguments(parser)
        parser.add_argument(
            "--backend-only",
            action="store_true",
            dest="backend_only",
            help="Запустить только Django (Daphne), без фронтенда.",
        )

    def _get_frontend_dir(self):
        """Путь к папке frontend (родитель backend)."""
        backend_dir = Path(settings.BASE_DIR)
        return backend_dir.parent / "frontend"

    def _start_vite(self):
        """Запуск Vite dev server в фоновом процессе."""
        frontend_dir = self._get_frontend_dir()
        if not frontend_dir.is_dir():
            self.stderr.write(
                self.style.WARNING(
                    f"Папка frontend не найдена: {frontend_dir}. Запускается только Django."
                )
            )
            return

        package_json = frontend_dir / "package.json"
        if not package_json.exists():
            self.stderr.write(
                self.style.WARNING(
                    f"frontend/package.json не найден. Запускается только Django."
                )
            )
            return

        self.stdout.write(self.style.SUCCESS("Запуск фронтенда (Vite)..."))
        try:
            if sys.platform == "win32":
                self._vite_process = subprocess.Popen(
                    "npm run dev",
                    cwd=str(frontend_dir),
                    shell=True,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if hasattr(subprocess, "CREATE_NEW_PROCESS_GROUP") else 0,
                )
            else:
                self._vite_process = subprocess.Popen(
                    ["npm", "run", "dev"],
                    cwd=str(frontend_dir),
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    start_new_session=True,
                )
            self.stdout.write(
                self.style.SUCCESS(
                    f"Фронтенд запущен (PID {self._vite_process.pid}). "
                    "Откройте http://localhost:3000"
                )
            )
        except FileNotFoundError:
            self.stderr.write(
                self.style.WARNING(
                    "npm не найден в PATH. Установите Node.js. Запускается только Django."
                )
            )
        except Exception as e:
            self.stderr.write(self.style.ERROR(f"Ошибка запуска Vite: {e}"))

    def _stop_vite(self):
        """Остановка процесса Vite при выходе."""
        if self._vite_process is None:
            return
        try:
            self._vite_process.terminate()
            self._vite_process.wait(timeout=5)
        except (ProcessLookupError, AttributeError, OSError):
            try:
                self._vite_process.kill()
            except Exception:
                pass
        self._vite_process = None

    def _parse_addrport(self, addrport):
        """Парсит addrport (например '8000' или '0.0.0.0:8000') в (host, port)."""
        if ":" in addrport:
            host, port = addrport.rsplit(":", 1)
            return host.strip() or "127.0.0.1", port.strip()
        return "127.0.0.1", addrport

    def _run_daphne(self, addrport):
        """Запуск ASGI-сервера Daphne (HTTP + WebSocket)."""
        host, port = self._parse_addrport(addrport)
        self.stdout.write(
            self.style.SUCCESS(
                f"Запуск бекенда (Daphne, ASGI) на http://{host}:{port} — работают API и WebSocket."
            )
        )
        cmd = [
            sys.executable,
            "-m",
            "daphne",
            "-b",
            host,
            "-p",
            port,
            "config.asgi:application",
        ]
        try:
            return subprocess.run(cmd, cwd=str(settings.BASE_DIR))
        except FileNotFoundError:
            self.stderr.write(
                self.style.WARNING(
                    "Daphne не найден (pip install daphne). Запуск через WSGI runserver — WebSocket /ws/... работать не будет."
                )
            )
            return None

    def handle(self, *args, **options):
        self.stdout.write(
            self.style.NOTICE("=== Office Suite 360: runserver (Daphne + WebSocket) ===")
        )
        if not options.get("backend_only"):
            self._start_vite()
            atexit.register(self._stop_vite)
        addrport = options.get("addrport", "8000")
        try:
            # Daphne вместо WSGI runserver — чтобы работали WebSocket (/ws/dashboard/ и др.)
            exit_code = self._run_daphne(addrport)
            if exit_code is None:
                # Daphne не запустился — fallback на WSGI (WebSocket не будет работать)
                super().handle(*args, **options)
            elif exit_code != 0:
                raise SystemExit(exit_code)
        finally:
            self._stop_vite()
            try:
                atexit.unregister(self._stop_vite)
            except Exception:
                pass
