# 📒 KAN_PLAN — Журнал разработки Office Suite 360

> **Как вести этот файл:**
>
> 1. Каждый выполненный шаг — отмечать ✅ и дописывать дату + краткий итог.
> 2. Каждый шаг в работе — 🔄 (в процессе).
> 3. Запланировано, но не начато — ⬜.
> 4. Проблема / блокер — 🔴 с описанием.
> 5. Важные решения и архитектурные находки — фиксировать в разделе **РЕШЕНИЯ**.
> 6. Перечитывать файл перед каждой новой сессией — чтобы не потерять контекст.
> 7. **Перед началом задачи**: записать `IN_PROGRESS` + владелец, чтобы команда видела, кто чем занят.
> 8. **После завершения**: `DONE` + что сделано + что дальше.
> 9. **При блокере**: `BLOCKED` + причина + кто нужен для разблокировки.
> 10. **Правило**: никто не берёт задачу без записи владельца в журнале.

---

## 👥 КОМАНДА И РАСПРЕДЕЛЕНИЕ РОЛЕЙ

> Трое в команде. Перед стартом каждой сессии — перечитать KAN_PLAN и проверить, что в работе у коллег.

| Роль | Кто | Зона ответственности |
|------|-----|-----------------------|
| 🤖 **Cursor AI** | AI-ассистент #1 (Backend) | Backend: SaaS/монетизация, billing-модели, miграции, Entitlement Engine, Usage Metering, API ЛК, каркас Celery-задач, тесты монетизации |
| 🎨 **АНТИГРАВИТИ** | AI-ассистент #2 (UX/Frontend) | UX ЛК: структура экранов, фронт ЛК, расширение SaaS Admin Dashboard, SEO/SMM планирование, финальные правила тарифов/аддонов |
| 👑 **Владелец продукта** | Партнёр (человек) | Финальные решения: тарифная матрица и цены, выбор платёжного провайдера, приёмка этапов, установка приоритетов |

### Протокол взаимодействия

```
[CURSOR AI]     → берёт backend-задачи (модели, API, Celery, тесты)
[АНТИГРАВИТИ]   → берёт frontend/UX-задачи (страницы ЛК, SaaS Admin, дизайн-решения)
[ПАРТНЁР]       → утверждает, принимает, расставляет приоритеты

При конфликте зон — совещаемся в журнале (запись DISCUSS + тема).
Never: два исполнителя берут одну задачу без согласования.
```

### 🏆 Phase R2 — ПЛАТЁЖНАЯ АВТОМАТИЗАЦИЯ: **✅ DONE** (migrate clean + **12 passed** — 2026-03-04)

| Задача | Исполнитель | Статус | Дата старта |
|--------|-------------|--------|-------------|
| R1-S1: billing-модели v2 (Payment, SubscriptionLog, UsageMeter) | Cursor AI | ✅ DONE | 2026-03-04 |
| R1-S2: Entitlement Engine + Usage Metering API | Cursor AI | ✅ DONE | 2026-03-04 |
| R1-S3: Usage pipeline и агрегация | Cursor AI | ✅ DONE (4 passed) | 2026-03-04 |
| R1-S4: Расширение API ЛК + интеграция с UX-L2 | Cursor AI | ✅ DONE (7 passed) | 2026-03-04 |
| R1-S5: Стабилизация / cutover preparation | Cursor AI | ✅ DONE (8 passed) | 2026-03-04 |
| **R2-S1: ЮКасса primary — PaymentIntent + каркас оплаты** | Cursor AI | ✅ DONE (9 passed) | 2026-03-04 |
| **R2-S2: Webhook приём + идемпотентность + подписи** | Cursor AI | ✅ DONE (9 passed) | 2026-03-04 |
| **R2-S3: webhook → state transitions (grace/read\_only/restore)** | Cursor AI | ✅ DONE (10 passed) | 2026-03-04 |
| **R2-S4: Dunning-уведомления + ретраи + аналитика деградации** | Cursor AI | ✅ DONE (12 passed) | 2026-03-04 |
| **R2-S5: Яндекс Пэй primary — create-payment + webhook** | Cursor AI | ✅ DONE (12 passed) | 2026-03-04 |
| UX-L1: Структура экранов ЛК | АНТИГРАВИТИ | ✅ DONE | 2026-03-04 |
| UX-L2: Frontend ЛК (AccountLayout, SubscriptionPage, PaymentsPage, UpgradePage) | АНТИГРАВИТИ | ✅ DONE | 2026-03-04 |
| UX-L3: Главная Страница ЛК + виджет подписки в навигации | АНТИГРАВИТИ | ✅ DONE | 2026-03-04 |
| UX-R2: Фронт оплаты (Я.Пэй primary + ЮКасса fallback + грейс/read-only) | АНТИГРАВИТИ | ✅ DONE | 2026-03-04 |
| UX-D1: Расширение SaaS Admin Dashboard | АНТИГРАВИТИ | ✅ DONE | 2026-03-04 |
| UX-P1: Тарифная матрица | АНТИГРАВИТИ | ✅ DONE | 2026-03-04 |
| BIZ-1: Тарифы и цены | Владелец | ✅ DONE (as-is + гибко) | 2026-03-04 |
| BIZ-2: Платёжный провайдер | Владелец | ✅ DONE: **Яндекс Пэй primary** + ЮКасса secondary | 2026-03-04 |
| BIZ-3: Креденциалы Я.Пэй | Владелец | ✅ DONE: Merchant ID получен, **хранить только в .env** | 2026-03-04 |
| **R3-S1: Production ENV + Callback URL** | Владелец + Cursor AI | 🔄 IN_PROGRESS (server validation pending) | 2026-03-04 |
| **R3-S2: Webhook security hardening (JWT/JWK/duplicate/HMAC)** | Cursor AI | ✅ DONE (17 passed) | 2026-03-04 |
| **R3-S3: Мониторинг (failed webhook + Sentry + Celery)** | Cursor AI | ✅ DONE (check + 20 passed) | 2026-03-04 |
| **R3-S4: Revenue API + Dashboard** | Cursor AI + АНТИГРАВИТИ | ✅ DONE (14 passed) | 2026-03-04 |
| **R3-S5: Production smoke + go-live checklist** | Cursor AI | ✅ DONE (18 passed) | 2026-03-04 |
| **GO-LIVE-1: Final production checklist (10 пунктов) + sign-off** | СОЗДАТЕЛЬ + Cursor AI | 🔄 IN_PROGRESS (server run required) | 2026-03-04 |
| **DEPLOY-WAVE-1: Серверный деплой (шаг за шагом)** | СОЗДАТЕЛЬ + Cursor AI | 🔄 IN_PROGRESS | 2026-03-04 |
| **UX-R3: Revenue Dashboard в SaaS Admin** | АНТИГРАВИТИ | ✅ DONE | 2026-03-04 |
| **UX-R3b: PaymentReturnPage premium** | АНТИГРАВИТИ | ✅ DONE | 2026-03-04 |

### Фаза R6: Настройка SEO и Продвижение 🌐

| Задача | Владелец | Статус | Дата |
|---|---|---|---|
| **SEO-1: Базовая инфраструктура и мета-теги** | АНТИГРАВИТИ | ✅ DONE | 2026-03-04 |
| **SEO-2: Sitemaps и robots.txt** | Cursor AI | ✅ DONE (check + 5 passed) | 2026-03-04 |
| **SEO-3: Расширенная разметка (JSON-LD)** | АНТИГРАВИТИ | ✅ DONE | 2026-03-04 |
| **SEO-5: Мета-поля в Blog (Backend + Frontend)** | Cursor AI + АНТИГРАВИТИ | ✅ DONE | 2026-03-04 |
| **SEO-4: Индексация (Google/Yandex ping, IndexNow)** | Cursor AI | ✅ DONE (check + 9 passed) | 2026-03-04 |

---

## 🏗️ ТЕХНИЧЕСКИЙ СТЕК (зафиксировано)

| Слой | Технология |
|------|-----------|
| Backend | Python 3.12, Django 5.0, DRF 3.14 |
| Frontend | React 18 + TypeScript + Vite + TailwindCSS |
| БД | PostgreSQL 15 |
| Кеш / Очередь | Redis 7 + Celery 5 |
| Real-time | Django Channels + Daphne (WebSocket) |
| Десктоп | Tauri v2 (опционально) |
| Auth | JWT (simplejwt) + Djoser + Social OAuth |
| PDF | WeasyPrint |
| Telegram | python-telegram-bot 20 + aiogram 3 |
| Docker | docker-compose (dev) + docker-compose.prod.yml |

---

## 🔍 АУДИТ: ЧТО УЖЕ ЕСТЬ (по состоянию на 04.03.2026)

### ✅ Уже реализовано — Backend (apps)

| Модуль | Состояние | Примечания |
|--------|----------|------------|
| `core` | ✅ Базовый | User, Workspace, WorkspaceMember, UserEvent |
| `auth` | ✅ Хороший | JWT, Social OAuth (Google, Yandex, VK, Mail.ru, Telegram) |
| `kanban` | ✅ Основной | Доски, колонки, карточки |
| `todo` | ✅ Зрелый | Tasks, Projects, полный CRUD |
| `gantt` | ✅ Базовый | Gantt chart backend |
| `calendar` | ✅ Базовый | События |
| `schedule` | ✅ Есть | Расписание |
| `timetracking` | ✅ Есть | TimeLog, billable часы |
| `billing` | ✅ Частичный | Subscription, Invoice, PDF (WeasyPrint), SubscriptionService |
| `saas` | ✅ Частичный | Plan (CRUD), SaasDashboard (stats), UserViewSet (ban/impersonate/events) |
| `blog` | ✅ Базовый | Post, Category, Tag, CRUD через SaaS-admin |
| `marketing` | ✅ Базовый | Advertisement (рекламные слоты) |
| `ai` | ✅ Частичный | WorkspaceAgent, базовые модели |
| `hr` | ✅ Зрелый | Contact, HR-функции |
| `finance` | ✅ Зрелый | Финансовые операции |
| `crm` | ✅ Базовый | Customer |
| `analytics` | ✅ Базовый | |
| `notifications` | ✅ Базовый | WebSocket события |
| `chat` | ✅ Базовый | Чат через WebSocket |
| `bot` | ✅ Базовый | Telegram бот |
| `documents` | ✅ Базовый | Документы |
| `mindmaps` | ✅ Базовый | Карты мыслей |
| `integrations` | ✅ Базовый | Google Sheets экспорт |

### ✅ Уже реализовано — Frontend (страницы)

| Страница | Состояние |
|----------|----------|
| `LandingPage.tsx` | ✅ Публичная лендинг-страница |
| `LoginPage.tsx` / `RegisterPage.tsx` | ✅ Авторизация |
| `KanbanPage.tsx` | ✅ Главный функционал (~152KB!) |
| `DashboardPage.tsx` | ✅ Дашборд (~35KB) |
| `FinancePage.tsx` | ✅ Финансы (~71KB) |
| `TasksPage.tsx` / `ProjectsPage.tsx` | ✅ Задачи/Проекты |
| `CalendarPage.tsx` / `GanttPage.tsx` | ✅ Календарь/Гантт |
| `ProfilePage.tsx` | ✅ Профиль |
| `saas/SaasDashboardPage.tsx` | ✅ Базовый (3 KPI + график) |
| `saas/SaasPlansPage.tsx` | ✅ CRUD тарифов (JSON лимиты) |
| `saas/SaasUsersPage.tsx` | ✅ Список пользователей |
| `saas/SaasUserDetailPage.tsx` | ✅ Детали пользователя |
| `saas/SaasBlogPage.tsx` | ✅ Блог-редактор (~40KB) |
| `saas/SaasAdsPage.tsx` | ✅ Реклама (~18KB) |

---

## ❌ ЧТО ОТСУТСТВУЕТ / НУЖНО СДЕЛАТЬ

### 🔴 Критично отсутствует

| Что | Почему критично |
|-----|----------------|
| Личный кабинет пользователя (ЛК) | Нет страницы: мои платежи, мой тариф, лимиты, потребление |
| Автоматическое включение/отключение доступа при оплате | Нет Celery-задачи проверки дедлайна подписки |
| Интеграция с платёжным шлюзом (ЮКасса/Robokassa/Stripe) | Нет вебхука и автоподтверждения оплаты |
| SEO: sitemap.xml + robots.txt + meta-теги | Нет вообще |
| Google Search Console / Yandex Webmaster API | Не настроены |
| Автопостинг в Telegram | Celery-задача не создана |
| Автопостинг в Pinterest | Не создан |
| Автопостинг в VK | Не создан |
| Видео-постинг (RuTube, YouTube, VK Video) | Не создан |
| Дополнительные услуги (аренда ИИ-агентов) | Нет отдельного каталога и покупки |
| Ручная установка тарифа и оплаты через ЛК | Только через суперадмина |
| Деплой на сервер | Не выполнен |

### 🟡 Нужно улучшить / расширить

| Что | Текущее состояние | Что добавить |
|-----|------------------|-------------|
| `SaasDashboardPage` | 3 KPI + 1 график | ARR, Churn Rate, доходность по тарифам, карта платежей |
| `SaasPlansPage` | JSON-textarea для лимитов | UI-конструктор лимитов с named полями |
| `billing/models.py` | Только Subscription + Invoice | Добавить: Payment, PaymentWebhook, SubscriptionLog |
| `saas/models.py` | Только Plan | Добавить: AddonService (доп услуги), PricingPeriod (месяц/год) |
| Blog SEO | Нет meta_title, meta_description, og_image | Добавить поля в Post |
| SitemapXML | Нет | Создать django.contrib.sitemaps |
| Реклама | Есть слоты | Нет метрик кликов, A/B тестирования |

### 🟢 Что удалить или рефакторить

| Что | Причина |
|-----|--------|
| `billing/models.py` поле `plan` (str) | Дублирует `plan_obj` (FK), legacy, запутывает |
| `db.sqlite3` в backend | Остатки разработки, не должен попасть на прод |
| Разрозненные check_*.py в корне | Утилиты не нужны в продакшене, переместить в `/tools` |

---

## 🗺️ ДОРОЖНАЯ КАРТА — ФАЗЫ (ROADMAP)

### 📌 ФАЗА 1: SaaS Монетизация (Приоритет #1)

**Цель:** Полноценная система подписок, оплат и управления доступом

#### 1.1 Backend — Расширение моделей

- ⬜ `billing/models.py`: добавить `Payment` (факт оплаты), `SubscriptionLog` (история изменений)
- ⬜ `saas/models.py`: добавить `PricingPeriod` (month/year), `AddonService` (аренда ИИ-агентов)
- ⬜ `blog/models.py`: добавить SEO поля (`meta_title`, `meta_desc`, `og_image`, `canonical_url`)
- ⬜ Создать и применить миграции

#### 1.2 Backend — Платёжный шлюз

- ⬜ Выбрать шлюз: ЮКасса (ЮМани) — рекомендуется для РФ
- ⬜ Создать `billing/payment_gateway.py` (абстракция над шлюзом)
- ⬜ Создать вебхук `/api/v1/billing/webhook/` для подтверждения оплат
- ⬜ Celery-задача `check_subscriptions_expiry` (ежедневно): отключать просроченных

#### 1.3 Backend — ЛК пользователя API

- ⬜ `GET /api/v1/me/subscription/` — мой тариф + лимиты + потребление
- ⬜ `GET /api/v1/me/payments/` — история платежей
- ⬜ `POST /api/v1/me/subscription/upgrade/` — апгрейд тарифа + создание платежа
- ⬜ `GET /api/v1/me/usage/` — текущее потребление ресурсов

#### 1.4 Frontend — Личный кабинет (ЛК)

- ⬜ Создать `pages/account/AccountPage.tsx` — главная ЛК
- ⬜ Создать `pages/account/SubscriptionPage.tsx` — тариф, лимиты, потребление
- ⬜ Создать `pages/account/PaymentsPage.tsx` — история платежей
- ⬜ Создать `pages/account/UpgradePage.tsx` — выбор тарифа + оплата
- ⬜ Встроить в навигацию и роутинг

#### 1.5 Frontend — Расширение SaaS Admin Dashboard

- ⬜ Добавить: ARR, Churn Rate, платежи по месяцам, тепловая карта
- ⬜ `SaasPlansPage`: заменить JSON-textarea на UI-конструктор лимитов
- ⬜ Добавить вкладку: Доп. услуги (AddonService) с CRUD
- ⬜ Добавить вкладку: Платежи (реестр всех транзакций)
- ⬜ Добавить: ручная установка тарифа пользователю + ручной платёж

---

### 📌 ФАЗА 2: SEO и Продвижение (Приоритет #2)

**Цель:** ТОП в поисковиках, автоматическая индексация

#### 2.1 Backend — SEO-инфраструктура

- ⬜ `django.contrib.sitemaps`: SitemapView для Blog Posts
- ⬜ `robots.txt` endpoint
- ⬜ Мета-поля в Post: `meta_title`, `meta_description`, `og_image`, `canonical_url`, `schema_org`
- ⬜ API: `GET /sitemap.xml` и `GET /robots.txt`

#### 2.2 Frontend — SEO-метатеги

- ⬜ Вставлять в `<head>`: title, description, og:*, twitter:*, canonical
- ⬜ Использовать `react-helmet-async` или `@tanstack/react-head`
- ⬜ JSON-LD разметка для статей (schema.org/Article)

#### 2.3 Интеграция с поисковиками

- ⬜ Google Search Console API — отправка sitemap и IndexNow
- ⬜ Яндекс.Вебмастер API — ping при публикации статьи
- ⬜ IndexNow endpoint (единый протокол для Bing, Яндекс)
- ⬜ Celery-задача: при публикации статьи → пинговать всех

---

### 📌 ФАЗА 3: Автопостинг в соцсети (Приоритет #3)

**Цель:** Статьи и видео автоматически идут в Telegram, VK, Pinterest; видео — в YouTube/RuTube

#### 3.1 Backend — Celery задачи постинга

- ⬜ `apps/blog/tasks.py`: Celery-задачи автопостинга при публикации
- ⬜ `post_to_telegram(post_id)` — текст + изображение в канал
- ⬜ `post_to_vk(post_id)` — VK API
- ⬜ `post_to_pinterest(post_id)` — Pinterest API
- ⬜ `post_video_to_youtube(post_id)` — YouTube Data API v3
- ⬜ `post_video_to_rutube(post_id)` — RuTube API
- ⬜ `post_video_to_vk(post_id)` — VK Video API

#### 3.2 Настройки и конфиги

- ⬜ Добавить в `.env`: токены Telegram-канала, VK групп, Pinterest, YouTube
- ⬜ Таблица `SocialPostLog` — лог публикаций (успех/ошибка)
- ⬜ SaaS Admin: управление автопостингом (вкл/выкл каналы)

---

### 📌 ФАЗА 4: Деплой на сервер (Приоритет #4)

**Цель:** Продакшн-деплой с SSL, доменом, мониторингом

#### 4.1 Docker/Infra

- ⬜ Проверить `docker-compose.prod.yml` — актуализировать
- ⬜ Добавить Nginx с SSL (Let's Encrypt / Certbot)
- ⬜ Настроить переменные окружения для продакшна
- ⬜ `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `FRONTEND_URL` — прописать реальный домен

#### 4.2 CI/CD

- ⬜ GitHub Actions: build → test → deploy
- ⬜ Автоматические миграции при деплое

#### 4.3 Мониторинг

- ⬜ Sentry (error tracking)
- ⬜ Prometheus + Grafana или UptimeRobot
- ⬜ Celery Flower (мониторинг задач)

---

### 📌 ФАЗА 5: Основной функционал (полировка)

- ⬜ Реклама: метрики кликов, CTR, отчёты
- ⬜ ИИ-агенты: каталог доступных агентов для аренды
- ⬜ Регистрация через Telegram (виджет)
- ⬜ Email-нотификации (подтверждение, продление подписки)
- ⬜ Основная программа: проверить все фичи, закрыть баги

---

## 📋 ЖУРНАЛ РАБОТ

| Дата | Версия | Действие | Исполнитель | Результат |
|------|--------|----------|-------------|-----------|
| 2026-03-04 | 0.1 | Аудит кода, создан KAN_PLAN.md | АНТИГРАВИТИ | Файл создан, полный аудит, дорожная карта по 5 фазам |
| 2026-03-04 | 0.2 | Распределение ролей команды, протокол совместной работы | АНТИГРАВИТИ | Роли зафиксированы: Cursor AI (backend), АНТИГРАВИТИ (UX/frontend), Владелец (приёмка) |
| 2026-03-04 | 0.2 | Cursor AI: стартовал R1-S1 (billing-модели v2) | Cursor AI | IN_PROGRESS: Payment, SubscriptionLog, UsageMeter, EntitlementOverride |
| 2026-03-04 | 0.2 | АНТИГРАВИТИ: стартовал UX-L1 (структура ЛК) + UX-P1 (тарифная матрица) | АНТИГРАВИТИ | IN_PROGRESS: проектирование экранов ЛК и описание тарифов |
| 2026-03-04 | 0.3 | **BIZ-2 РЕШЕНО**: платёжные системы — ЮКасса + Яндекс Пэй (первая очередь) | Владелец | ✅ DONE: зафиксировано в KAN_PLAN |
| 2026-03-04 | 0.3 | **BIZ-3 РЕШЕНО**: тарифная матрица с возможностью дальнейшей корректировки | Владелец | ✅ DONE: гибкая архитектура через JSON-лимиты |
| 2026-03-04 | 0.3 | Реквизиты ООО "ЛукИнтерЛаб" — единый файл `companyInfo.ts` | АНТИГРАВИТИ | ✅ DONE: `frontend/src/lib/companyInfo.ts` — единый источник правды |
| 2026-03-04 | 0.3 | Обновлена страница реквизитов `LegalContactsPage.tsx` | АНТИГРАВИТИ | ✅ DONE: актуальные реквизиты, платёжные системы, ссылки на документы |
| 2026-03-04 | 0.3 | Создана страница Политики Cookie `CookiePolicyPage.tsx` | АНТИГРАВИТИ | ✅ DONE: `/cookies` — по ФЗ-152, таблица типов cookie, управление согласием |
| 2026-03-04 | 0.3 | Создан публичный футер `PublicFooter.tsx` | АНТИГРАВИТИ | ✅ DONE: 4 колонки, реквизиты, юр. документы, платёжные системы, кнопка cookie |
| 2026-03-04 | 0.3 | Обновлён `PublicLayout.tsx` — добавлен PublicFooter | АНТИГРАВИТИ | ✅ DONE: все публичные страницы теперь имеют полноценный футер |
| 2026-03-04 | 0.3 | Добавлен маршрут `/cookies` в `App.tsx` | АНТИГРАВИТИ | ✅ DONE: страница cookie-политики доступна публично |
| 2026-03-04 | 0.4 | **BIZ-1 УТВЕРЖДЕНО**: тарифная матрица используется as-is, с гибкостью изменений | Владелец | ✅ DONE: тарифы корректируемы в любой момент через SaaS Admin |
| 2026-03-04 | 0.4 | **UX-D1 DONE**: SaasPlansPage — новый UI-конструктор тарифов | АНТИГРАВИТИ | ✅ DONE: именованные поля, переключатели фич, подсказка о гибкости, 0=без лимита |
| 2026-03-04 | 0.5 | **Cursor AI→АНТИГРАВИТИ**: реальные endpoint-ы `/billing/account/me/`, `/billing/usage/me/` | Cursor AI | Синх: структура entitlement (source/access_mode/limits/features/restrictions/period) зафиксирована |
| 2026-03-04 | 0.5 | **UX-L2 DONE**: фронтенд ЛК — api/account.ts + 4 страницы ЛК | АНТИГРАВИТИ | ✅ DONE: AccountLayout, SubscriptionPage, PaymentsPage, UpgradePage; маршруты /account/* |
| 2026-03-04 | 0.5 | URL `api/account.ts` обновлены под реальные endpoint-ы Cursor AI | АНТИГРАВИТИ | ✅ DONE: `/billing/account/me/`, `/billing/usage/me/`, fallback при недоступности API |
| 2026-03-04 | 0.6 | **R1-S4 DONE** (7 passed): 3 новых endpoint-а (платежи/счета/таймлайн) | Cursor AI | ✅ DONE: `cabinet/payments/me`, `cabinet/invoices/me`, `cabinet/timeline/me` |
| 2026-03-04 | 0.6 | **R1-S4 DONE**: `GET /billing/account/me/` расширен новыми полями | Cursor AI | plan_badge, next_billing_at, provider, account_currency, trial_end, cancel_at_period_end |
| 2026-03-04 | 0.6 | api/account.ts: `MyAccount` обновлён + getTimeline() + правильные URL cabinet/ | АНТИГРАВИТИ | ✅ DONE: фронт синхронизирован с backend |
| 2026-03-04 | 0.8 | **DEPLOY-WAVE-1**: Получены параметры сервера | СОЗДАТЕЛЬ + Cursor AI | Ubuntu 24.04 LTS, тариф Гамма, домен antexpress.ru, 2 публичных IP; идём к шагу верификации runtime |
| 2026-03-04 | 0.9 | **DEPLOY-WAVE-1**: Проверка runtime-стека сервера | СОЗДАТЕЛЬ + Cursor AI | ✅ DONE: nginx/postgresql/redis/node установлены, сервисы active; следующий шаг — DNS A-записи |
| 2026-03-04 | 1.0 | **DEPLOY-WAVE-1**: DNS A-записи добавлены | СОЗДАТЕЛЬ + Cursor AI | 🔄 IN_PROGRESS: записи `@/www/api` созданы на 81.177.141.122, ждём подтверждение резолва |
| 2026-03-04 | 1.1 | **DEPLOY-WAVE-1**: Проверка DNS резолва (fallback) | СОЗДАТЕЛЬ + Cursor AI | `dig` отсутствует на сервере; переходим на `nslookup` для проверки резолва |
| 2026-03-04 | 0.7 | **DEPLOY-WAVE-1**: Старт пошагового деплоя на сервер | АНТИГРАВИТИ | 🔄 IN_PROGRESS: Ожидание параметров сервера от СОЗДАТЕЛЯ |

---

## 🧠 АРХИТЕКТУРНЫЕ РЕШЕНИЯ (копилка)

### Решение 1: SubscriptionService (уже есть)

`billing/services.py::SubscriptionService` — единая точка проверки лимитов и фич.
Использовать везде: `SubscriptionService.has_feature(user, 'payroll')`.
**Не дублировать проверки в views!**

### Решение 2: Plan.limits — JSON-схема (ГИБКАЯ, можно менять в любой момент)

> ⭐ **ПРИНЦИП ГИБКОСТИ**: тарифы меняются через SaaS Admin → Планы, без правки кода.
> Изменения применяются мгновенно. Действующие подписки — по прежним условиям до продления.

Актуальная схема лимитов:

```json
{
  "max_system_contacts": 200,
  "max_ai_agents": 3,
  "max_users": 5,
  "max_projects": 20,
  "storage_gb": 10,
  "billing_period": "month",
  "description": "Для малого бизнеса",
  "features": {
    "hr": true,
    "payroll": true,
    "ai_analyst": false,
    "finance_analytics": true,
    "gantt": true,
    "api_access": false
  }
}
```

**Правило 0**: значение `0` в числовых лимитах = **без ограничений** (Enterprise).
**Правило**: при добавлении новых фич — добавлять в `features{}`, НЕ создавать новые поля модели.
**UI**: `SaasPlansPage.tsx` — работает через именованные поля, JSON-textarea удалён.

### Решение 3: UserEvent — единый лог событий

`core.UserEvent` — таблица всех событий: логины, оплаты, бизнес-доступ, реклама.
При добавлении новых событий — добавлять константы `EVENT_*` в модель.

### Решение 4: Платёжный шлюз — изоляция

Общение с ЮКассой/Stripe — только через `billing/payment_gateway.py`.
Вебхуки обрабатываем в отдельном view, независимо от остального биллинга.

### Решение 5: Celery для фоновых задач

- Проверка просроченных подписок — `crontab(hour=3, minute=0)` (каждую ночь в 3:00)
- Автопостинг — сигналы Django: `post_save` на `Post` → `if is_published → Celery task`
- Пинг поисковиков — Celery task после публикации

---

## ⚠️ ИЗВЕСТНЫЕ ПРОБЛЕМЫ / ТЕХНИЧЕСКИЙ ДОЛГ

| # | Проблема | Приоритет | Статус |
|---|---------|-----------|--------|
| 1 | `billing/models.py`: поле `plan` (CharField) дублирует `plan_obj` (FK) | 🟡 Средний | Удалить при следующей миграции |
| 2 | `db.sqlite3` в `/backend` — не должен попасть на прод | 🔴 Высокий | Добавить в .gitignore |
| 3 | WeasyPrint — проблемы с установкой на Windows (нужны GTK dll) | 🟡 Средний | На сервере Linux — ок |
| 4 | Порт 8020 для dev сервера (нестандартный) | 🟢 Низкий | Зафиксировать в .env |
| 5 | Frontend SaasDashboardPage — только 3 KPI, нет реальных данных платежей | 🔴 Высокий | ФАЗА 1.5 |
| 6 | Social OAuth: Telegram через виджет — не реализован в frontend | 🟡 Средний | ФАЗА 5 |

---

## 🎯 ТЕКУЩИЙ ФОКУС КОМАНДЫ

**→ ФАЗА 1 — SaaS Монетизация | Параллельная работа**

### Cursor AI делает прямо сейчас

1. 🔄 **R1-S1**: Модели v2 — `billing/models.py`: `Payment`, `SubscriptionLog`, `UsageMeter`, `UsageRecord`, `EntitlementOverride`
2. ⬜ **R1-S2**: Entitlement Engine — расчёт доступа с учётом override'ов
3. ⬜ **R1-S3**: API ЛК — `GET /api/v1/me/subscription/`, `GET /api/v1/me/usage/`, платежи
4. ⬜ **R1-S4**: Celery авто-управление — `check_subscriptions_expiry` + status transitions
5. ⬜ **R1-S5**: Тесты лимитов/статусов/переключения доступа

### АНТИГРАВИТИ делает прямо сейчас

1. 🔄 **UX-L1**: Структура экранов ЛК — описание всех разделов + данные по каждому экрану
2. 🔄 **UX-P1**: Тарифная матрица — черновик тарифов с ценами и фичами для утверждения Владельцем
3. ⬜ **UX-L2**: Frontend ЛК — `AccountPage`, `SubscriptionPage`, `PaymentsPage`, `UpgradePage` *(ждём R1-S3)*
4. ⬜ **UX-D1**: SaaS Admin Dashboard — расширение до полноценной аналитики

### Владелец — вопросы для решения

- ❓ **BIZ-1**: Утвердить тарифы и цены (после UX-P1)
- ❓ **BIZ-2**: Выбрать платёжный провайдер: **ЮКасса** (рекомендуется для РФ) / Robokassa / Tinkoff

---

## 💡 ПРЕДЛОЖЕНИЕ АНТИГРАВИТИ: ТАРИФНАЯ МАТРИЦА (ЧЕРНОВИК)

> **Статус**: 🔄 Черновик | Ждёт утверждения Владельца | Cursor AI реализует после BIZ-1

| Параметр | 🆓 FREE | 🚀 PRO | 🏢 BUSINESS | 👑 ENTERPRISE |
|----------|---------|--------|------------|---------------|
| **Цена** | 0 ₽/мес | 990 ₽/мес | 2 990 ₽/мес | Договорная |
| **Пользователи в workspace** | 1 | до 5 | до 20 | Без лимита |
| **Проекты** | до 3 | до 20 | Без лимита | Без лимита |
| **Системные контакты (CRM)** | до 10 | до 200 | до 2 000 | Без лимита |
| **ИИ-агенты** | 1 | до 3 | до 10 | Без лимита |
| **Хранилище** | 1 ГБ | 10 ГБ | 50 ГБ | 500 ГБ |
| **HR / Расчёт зарплат** | ❌ | ✅ | ✅ | ✅ |
| **Финансовая аналитика** | ❌ | ✅ | ✅ | ✅ |
| **ИИ-аналитик** | ❌ | ❌ | ✅ | ✅ |
| **Gantt + Timeline** | ❌ | ✅ | ✅ | ✅ |
| **API доступ** | ❌ | ❌ | ✅ | ✅ |
| **Поддержка** | FAQ | Email | Приоритетная | Персональная |

### Дополнительные услуги (AddonService — каталог)

| Услуга | Стоимость |
|--------|-----------|
| Аренда дополнительного ИИ-агента | 499 ₽/мес за агента |
| Дополнительное хранилище | 99 ₽/мес за 10 ГБ |
| Дополнительный workplace | 299 ₽/мес |
| Приоритетная поддержка | 1 990 ₽/мес |
| Персональная настройка | 9 900 ₽ разово |

> ⚠️ **Владелец**: подтвердите или скорректируйте матрицу — Cursor AI сразу зашьёт лимиты в модели.

---

*Файл поддерживается командой. Обновлять при каждом значимом изменении.*
*Версия документа: 1.2 | Обновлён: 2026-03-04 | Команда: Cursor AI + АНТИГРАВИТИ + Владелец*
