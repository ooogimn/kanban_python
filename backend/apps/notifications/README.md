# Notifications app

## Уведомления (Notification) vs Журнал активности (AuditLog)

- **Модель `Notification`** (таблица `notifications`): предназначена для персональных уведомлений пользователя (назначение на задачу, комментарий, дедлайн и т.д.). На текущий момент **записи в эту таблицу нигде не создаются**; API для списка «мои уведомления» и отметки прочитанным не реализован.
- **Журнал активности (AuditLog)** — используется для отображения последних действий по проектам и задачам. API: `GET /api/v1/notifications/activity/` (с фильтрами `project_id`, `workitem_id`, `limit`). На фронте блок «Последняя активность» на дашборде и при необходимости на странице проекта получает данные отсюда.

Итог: **для пользователя «уведомления» в приложении = журнал активности на дашборде**. Полноценный список уведомлений (создание записей Notification по событиям + API + UI) — возможная доработка (см. ПРЕДЛОЖЕНИЯ_ДОРАБОТОК.md).

---

## WebSocket API для Real-time обновлений

## Подключение

WebSocket использует JWT аутентификацию. Токен передаётся в query string:

```
ws://localhost:8000/ws/dashboard/?token=YOUR_JWT_TOKEN
ws://localhost:8000/ws/kanban/1/?token=YOUR_JWT_TOKEN
ws://localhost:8000/ws/project/1/?token=YOUR_JWT_TOKEN
```

## Endpoints

### 1. Dashboard Consumer
**URL:** `ws://host/ws/dashboard/`

**Группа:** `dashboard_{user_id}`

**События:**
- `dashboard_update` - обновление дашборда
- `task_update` - обновление задачи
- `notification` - уведомление

**Пример сообщения:**
```json
{
  "type": "task_update",
  "data": {
    "id": 1,
    "title": "Задача",
    "status": "in_progress"
  }
}
```

### 2. Kanban Consumer
**URL:** `ws://host/ws/kanban/{board_id}/`

**Группа:** `kanban_board_{board_id}`

**События:**
- `kanban_update` - обновление доски
- `card_moved` - перемещение карточки
- `card_created` - создание карточки

**Пример сообщения:**
```json
{
  "type": "card_moved",
  "data": {
    "id": 1,
    "title": "Карточка",
    "column": 2,
    "position": 0
  }
}
```

### 3. Project Consumer
**URL:** `ws://host/ws/project/{project_id}/`

**Группа:** `project_{project_id}`

**События:**
- `project_update` - обновление проекта
- `task_created` - создание задачи
- `task_updated` - обновление задачи
- `task_deleted` - удаление задачи

**Пример сообщения:**
```json
{
  "type": "task_created",
  "data": {
    "id": 1,
    "title": "Новая задача",
    "status": "todo"
  }
}
```

## Использование на фронтенде

### JavaScript пример:

```javascript
const token = localStorage.getItem('access_token');
const ws = new WebSocket(`ws://localhost:8000/ws/dashboard/?token=${token}`);

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message.type, message.data);
  
  switch(message.type) {
    case 'task_update':
      // Обновить задачу в UI
      break;
    case 'card_moved':
      // Обновить позицию карточки
      break;
  }
};

// Ping для поддержания соединения
setInterval(() => {
  ws.send(JSON.stringify({ type: 'ping' }));
}, 30000);
```

## Автоматические уведомления

Система автоматически отправляет WebSocket уведомления при:

1. **Создании/обновлении задачи** → уведомления в проект и назначенным пользователям
2. **Перемещении карточки** → уведомления в доску
3. **Изменении статуса** → синхронизация между компонентами

## NotificationService

Сервис для отправки уведомлений из кода:

```python
from apps.notifications.services import NotificationService

# Отправка обновления дашборда
NotificationService.send_dashboard_update(user_id, data)

# Отправка обновления канбана
NotificationService.send_kanban_update(board_id, data)

# Отправка обновления проекта
NotificationService.send_project_update(project_id, data)
```
