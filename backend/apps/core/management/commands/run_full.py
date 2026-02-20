"""
Команда run_full: запускает фронтенд (Vite) и бекенд через Daphne (ASGI).
Гарантированно используется Daphne — работают WebSocket (/ws/dashboard/ и др.).
Один Ctrl+C в терминале останавливает оба процесса.
Использование: python manage.py run_full [порт]
"""
import atexit
import signal
import subprocess
import sys
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Запуск бекенда (Daphne, ASGI) и фронтенда (Vite). WebSocket работает. Ctrl+C останавливает оба процесса."

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._vite_process = None
        self._daphne_process = None
        self._sigint_received = False

    def add_arguments(self, parser):
        parser.add_argument(
            "addrport",
            nargs="?",
            default="8000",
            help="Порт или host:port (по умолчанию 8000).",
        )
        parser.add_argument(
            "--backend-only",
            action="store_true",
            help="Запустить только Daphne, без фронтенда.",
        )

    def _get_frontend_dir(self):
        backend_dir = Path(settings.BASE_DIR)
        return backend_dir.parent / "frontend"

    def _start_vite(self):
        frontend_dir = self._get_frontend_dir()
        if not frontend_dir.is_dir() or not (frontend_dir / "package.json").exists():
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
            self.stdout.write(self.style.SUCCESS(f"Фронтенд: http://localhost:3000 (PID {self._vite_process.pid})"))
        except FileNotFoundError:
            self.stderr.write(self.style.WARNING("npm не найден. Запускается только бекенд."))
        except Exception as e:
            self.stderr.write(self.style.ERROR(f"Ошибка Vite: {e}"))

    def _stop_vite(self):
        if self._vite_process is None:
            return
        try:
            self._vite_process.terminate()
            self._vite_process.wait(timeout=5)
        except Exception:
            try:
                self._vite_process.kill()
            except Exception:
                pass
        self._vite_process = None

    def _stop_daphne(self):
        if self._daphne_process is None:
            return
        try:
            self._daphne_process.terminate()
            self._daphne_process.wait(timeout=5)
        except Exception:
            try:
                self._daphne_process.kill()
            except Exception:
                pass
        self._daphne_process = None

    def _stop_all(self):
        """Остановить оба процесса (Vite и Daphne). Вызывается по Ctrl+C и при выходе."""
        self._stop_daphne()
        self._stop_vite()

    def _sigint_handler(self, signum, frame):
        """По Ctrl+C — остановить оба процесса и выйти."""
        if self._sigint_received:
            raise KeyboardInterrupt()
        self._sigint_received = True
        self.stdout.write(self.style.WARNING("\nОстановка бекенда и фронтенда (Ctrl+C)..."))
        self._stop_all()
        raise KeyboardInterrupt()

    def _parse_addrport(self, addrport):
        if ":" in addrport:
            host, port = addrport.rsplit(":", 1)
            return host.strip() or "127.0.0.1", port.strip()
        return "127.0.0.1", addrport

    def handle(self, addrport="8000", backend_only=False, **options):
        host, port = self._parse_addrport(addrport)
        self.stdout.write(
            self.style.NOTICE("=== Office Suite 360: run_full (Daphne + WebSocket) ===")
        )
        if not backend_only:
            self._start_vite()
            atexit.register(self._stop_all)
        self.stdout.write(
            self.style.SUCCESS(
                f"Бекенд (Daphne, ASGI): http://{host}:{port} — API и WebSocket /ws/... работают."
            )
        )
        self.stdout.write(self.style.NOTICE("Остановка: Ctrl+C (останавливает оба процесса)."))
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
            self._daphne_process = subprocess.Popen(
                cmd,
                cwd=str(settings.BASE_DIR),
            )
        except FileNotFoundError:
            self.stderr.write(
                self.style.ERROR(
                    "Daphne не найден. Установите: pip install daphne (есть в requirements.txt)."
                )
            )
            self._stop_vite()
            raise SystemExit(1)
        try:
            # Один Ctrl+C в этом терминале останавливает и Daphne, и Vite
            old_sigint = signal.signal(signal.SIGINT, self._sigint_handler)
            try:
                result = self._daphne_process.wait()
                if result != 0:
                    raise SystemExit(result)
            finally:
                signal.signal(signal.SIGINT, old_sigint)
        except KeyboardInterrupt:
            self.stdout.write(self.style.WARNING("Завершение."))
            raise SystemExit(0)
        finally:
            self._stop_all()
            try:
                atexit.unregister(self._stop_all)
            except Exception:
                pass
