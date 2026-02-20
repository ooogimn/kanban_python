# Office Suite 360 - Frontend

Frontend приложение для Office Suite 360 на React + TypeScript.

## Технологии

- **React 18** - UI библиотека
- **TypeScript** - типизация
- **Vite** - сборщик и dev-сервер
- **React Router** - маршрутизация
- **TanStack Query** - управление состоянием и кеширование API запросов
- **Zustand** - управление состоянием аутентификации
- **Axios** - HTTP клиент
- **Tailwind CSS** - стилизация
- **React Beautiful DnD** - drag-and-drop для канбана
- **React Big Calendar** - календарь
- **React Hot Toast** - уведомления

## Установка

```bash
cd frontend
npm install
```

## Разработка

```bash
npm run dev
```

Приложение будет доступно на `http://localhost:5173`

## Сборка

```bash
npm run build
```

Собранные файлы будут в папке `dist/`

## Десктоп (Tauri)

Для запуска приложения в нативном окне (Windows/macOS/Linux):

1. **Иконка (один раз):** Windows требует `src-tauri/icons/icon.ico`. Создайте его:
   ```bash
   python create-icon.py
   ```
   либо сгенерируйте из своего логотипа: `npx tauri icon путь/к/изображению.png`
2. **Запуск:**
   ```bash
   npm run desktop
   ```
   Сборка десктопа: `npm run build:desktop`

**Нужны ли бекенд и бот?**  
- **Бекенд (Django)** — да: логин, проекты, задачи, API работают только при запущенном `python manage.py runserver` в каталоге `backend`.  
- **Бот (Telegram)** — по желанию: для уведомлений в Telegram запускайте `python manage.py runbot` в `backend`. Без бота приложение и десктоп работают, уведомления в Telegram не приходят.

## Структура проекта

```
frontend/
├── src/
│   ├── api/           # API клиенты
│   │   ├── client.ts  # Базовый axios клиент с JWT
│   │   ├── auth.ts    # API аутентификации
│   │   ├── todo.ts    # API задач и проектов
│   │   ├── kanban.ts  # API канбана
│   │   ├── calendar.ts # API календаря
│   │   └── analytics.ts # API аналитики
│   ├── components/    # React компоненты
│   │   ├── Layout.tsx # Основной layout с сайдбаром
│   │   └── ProtectedRoute.tsx # Защита маршрутов
│   ├── pages/         # Страницы приложения
│   │   ├── LoginPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── ProjectsPage.tsx
│   │   ├── KanbanPage.tsx
│   │   └── CalendarPage.tsx
│   ├── store/         # Zustand stores
│   │   └── authStore.ts
│   ├── types/         # TypeScript типы
│   │   └── index.ts
│   ├── App.tsx        # Главный компонент
│   ├── main.tsx       # Точка входа
│   └── index.css      # Глобальные стили
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

## API интеграция

Frontend подключается к Django API на `http://localhost:8000/api/v1/`

### Аутентификация

- JWT токены хранятся в `localStorage`
- Автоматическое обновление токена при истечении
- Редирект на `/login` при 401 ошибке

### Основные эндпоинты

- `/api/v1/auth/login/` - вход
- `/api/v1/auth/telegram/` - вход через Telegram
- `/api/v1/todo/projects/` - проекты
- `/api/v1/todo/tasks/` - задачи
- `/api/v1/kanban/boards/` - канбан доски
- `/api/v1/calendar/events/` - события календаря
- `/api/v1/analytics/dashboard-stats/` - статистика дашборда

## Переменные окружения

Создайте файл `.env`:

```env
VITE_API_URL=http://localhost:8000/api/v1
```

## Особенности

- **Автоматическое обновление токенов** - при истечении access token автоматически обновляется через refresh token
- **Кеширование запросов** - TanStack Query кеширует API запросы
- **Drag-and-drop** - перемещение карточек в канбане
- **Real-time обновления** - готовность к интеграции WebSocket (пока не реализовано)

## Следующие шаги

- [ ] Интеграция WebSocket для real-time обновлений
- [ ] Создание/редактирование задач и проектов
- [ ] Фильтры и поиск
- [ ] Мобильная адаптация
- [ ] Темная тема
