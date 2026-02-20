# Быстрый старт Frontend

## Установка зависимостей

```bash
cd frontend
npm install
```

## Запуск в режиме разработки

```bash
npm run dev
```

Приложение будет доступно на `http://localhost:3000`

## Настройка

Убедитесь, что backend запущен на `http://localhost:8000`

Если backend на другом порту, создайте файл `.env`:

```env
VITE_API_URL=http://localhost:8000/api/v1
```

## Первый вход

1. Откройте `http://localhost:3000`
2. Войдите с учетными данными, созданными в Django admin
3. Или используйте Telegram Login (если настроен)

## Структура

- `/dashboard` - Главная страница с аналитикой
- `/projects` - Список проектов
- `/kanban?board=1` - Канбан-доска
- `/calendar` - Календарь событий

## Сборка для production

```bash
npm run build
```

Файлы будут в папке `dist/`
