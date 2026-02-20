@echo off
chcp 65001 >nul
cd backend
echo Применение миграций...
python manage.py migrate todo
echo.
echo Проверка статуса миграций...
python manage.py showmigrations todo
echo.
pause
