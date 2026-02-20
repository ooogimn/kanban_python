Lsy
http://localhost:5173/login

Достаточно: правки → git add . → git commit -m "..." → git push origin main.

1. git add, git commit, git push
git push -u origin main --force                   # --force перезапишет ветку main на GitHub вашей локальной историей  
git log main -1 --stat                            # Посмотреть, какие файлы в последнем коммите
git add .                                           # Добавить все файлы в текущую директорию
git commit -m "message"                             # Создать коммит с сообщением
git push                                           # Запушить коммиты на GitHub  
git status                                        # Посмотреть статус git
2. сделать у себя в терминале (в папке проекта):
Посмотреть, какие файлы в последнем коммите:
   git log main -1 --stat
Если в списке только 2 файла — значит на GitHub именно то, что в коммите.
Добавить всё остальное и сделать новый коммит, затем отправить:
   git add .   git status
Проверьте по
   git status 
что добавляются нужные папки (backend, frontend и т.д.). Если что-то лишнее попало (venv, pycache, .env) —
поправьте .gitignore, затем снова 
   git add ..
Потом:
   git commit -m "Add all project files"   
   git push origin main
После этого на GitHub должна появиться полная версия проекта. Если пришлёте вывод 
   git log main -1 --stat 
и (по желанию) 
   git status 
после 
   git add .
, можно точечно подсказать, что ещё поправить.

```bash cd ..
cd ..
python -m venv .venv --clear
source .venv/Scripts/activate
```

```bash backend
cd backend
pip install -r requirements.txt
python manage.py makemigrations
python manage.py migrate
python manage.py check
python manage.py runserver
```

```bash   frontend
cd frontend
npm install
npm run build
npm run preview
npm run dev
npm run desktop
```

6. Тестовый запуск:
Bash
docker-compose down  # Остановите Dev
docker-compose -f docker-compose.prod.yml up --build
Проверка: Откройте http://localhost/admin (без порта 8000). Если видите админку со стилями — победа.
Возврат в Dev:
Bash
docker-compose -f docker-compose.prod.yml down
docker-compose up -d  # Возвращаемся к нормальной работе
Для локального запуска продакшен-стека текущего .env.prod достаточно. Запуск:
docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d
Если нужно, могу подсказать, как проверить, что контейнеры поднялись и бэкенд отвечает.
как
Как проверить, что продакшен-стек поднялся и бэкенд отвечает:
1. Запустить стек
docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d
2. Проверить контейнеры
docker-compose -f docker-compose.prod.yml ps
Все сервисы (db, redis, backend, nginx) должны быть в статусе Up.
3. Логи бэкенда (если что-то не работает)

===================================================================================================

# Office Suite 360

Офисная система управления проектами "всё-в-одном": Calendar + Schedule + To-Do + Kanban + Gantt + отчёты.

## Технологический стек

- **Backend**: Python 3.12, Django 5, Django REST Framework
- **Frontend**: React 18 + TypeScript + Vite
- **Database**: PostgreSQL 15
- **Cache/Queue**: Redis 7
- **Async Tasks**: Celery
- **Real-time**: Django Channels (WebSocket)

## Быстрый старт

### Требования

- Python 3.12+
- Node.js 18+ (для frontend)
- PostgreSQL 15+
- Redis 7+ (опционально)
- Docker и Docker Compose (опционально)

### Установка

1. Клонируйте репозиторий:
```bash
git clone <repository-url>
cd kanban_python
```

2. Настройте окружение:
```bash
make setup
```

3. Обновите `.env` файл с вашими настройками

4. Запустите миграции:
```bash
make migrate
```

5. Создайте суперпользователя:
```bash
cd backend
python manage.py createsuperuser
```

6. Запустите backend (и фронт одной командой; для WebSocket нужен Daphne):
```bash
cd backend
python manage.py run_full   # бекенд (Daphne) + фронт, WebSocket работает
# или
python manage.py runserver  # бекенд + фронт (если используется кастомный runserver с Daphne)
```

7. Запустите frontend (в отдельном терминале):
```bash
cd frontend
npm install
npm run dev
```

Или используйте Docker:
```bash
make docker-up
```

### Доступ

- **Frontend (dev)**: http://localhost:5173 (Vite)
- **API**: http://localhost:8000/api/
- **Admin**: http://localhost:8000/admin/
- **API Docs (Swagger)**: http://localhost:8000/api/schema/swagger-ui/
- **Health Check**: http://localhost:8000/api/health/

### Продакшен (Docker) — доступ к сайту

Бэкенд при открытии **http://127.0.0.1:8080/** редиректит на фронт (`FRONTEND_URL` в `.env.prod`). По умолчанию это **http://127.0.0.1:5173**.

1. **Перезапустите бэкенд**, чтобы подхватить `FRONTEND_URL`:
   ```bash
   docker-compose -f docker-compose.prod.yml up -d --force-recreate backend
   ```
2. **Запустите фронтенд** (на хосте):
   ```bash
   cd frontend
   npm run dev
   ```
3. **Откройте в браузере**: **http://127.0.0.1:5173**  
   Или **http://127.0.0.1:8080** — произойдёт редирект на 5173.
4. Чтобы фронт ходил в API прод-бэкенда (через Nginx), создайте в `frontend/` файл **`.env.local`**:
   ```
   VITE_API_URL=http://127.0.0.1:8080/api/v1
   ```
   После изменения перезапустите `npm run dev`.

## Структура проекта

```
kanban_python/
├── backend/          # Django backend
│   ├── apps/        # Django приложения
│   ├── config/      # Настройки проекта
│   └── manage.py
├── frontend/         # React + TypeScript frontend
│   ├── src/         # Исходный код
│   ├── package.json
│   └── vite.config.ts
├── infra/           # Docker конфигурация
└── ИНСТРУКЦИИ/      # Документация
```

## Команды

- `make setup` - Первоначальная настройка проекта
- `make install` - Установка зависимостей
- `make migrate` - Применение миграций
- `make run` - Запуск dev сервера
- `make test` - Запуск тестов
- `make lint` - Проверка кода линтерами
- `make format` - Форматирование кода
- `make docker-up` - Запуск Docker контейнеров
- `make docker-down` - Остановка Docker контейнеров

## Разработка

Проект использует:
- `black` для форматирования кода
- `ruff` для линтинга
- `isort` для сортировки импортов
- `pytest` для тестирования

Pre-commit hooks настроены в `.pre-commit-config.yaml`.

## Лицензия

Proprietary

---

## PostgreSQL (из README)

- **Пароль**: `12345`
- **Порт**: `5432`
- **База данных**: `office_suite`

## Проверка: сервер запущен?

1. **PostgreSQL должен быть запущен** (порт 5432, пользователь `postgres`, пароль `12345`, БД `office_suite`):
   - Windows: «Службы» → найдите `postgresql-x64-15` → Запустить, или от админа: `net start postgresql-x64-15`
   - Либо создайте БД: `psql -U postgres -c "CREATE DATABASE office_suite;"`

2. **Запустите в терминале** (из корня проекта):
   ```powershell
   cd backend
   python manage.py migrate
   python manage.py runserver
   ```

3. **Проверьте**:
   - http://localhost:8000/api/health/ — ответ `{"status":"ok","service":"Office Suite 360 API"}`
   - http://localhost:8000/admin/ — админка (после `createsuperuser`)
   - http://localhost:8000/api/schema/swagger-ui/ — Swagger UI

4. **Redis** (опционально): для WebSocket и кеша. Если не запущен — API работает, real-time может быть недоступен.





Вместо импортов используются URL из public/landing/:
hero.jpg — бывший page-0008.jpg
mission.jpg — page-0001.jpg
philosophy.jpg — page-0002.jpg
visualization.jpg — page-0003.jpg
time.jpg — page-0004.jpg
office.jpg — page-0005.jpg
analytics.jpg — page-0006.jpg
ai.jpg — page-0007.jpg
tech.jpg — page-0009.jpg
early-access.jpg — page-0010.jpg