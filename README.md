# 🤖 Система управления вендинговыми автоматами - MVP

Полнофункциональная backend система для управления сетью вендинговых автоматов, включающая учёт остатков, управление пополнениями, регистрацию продаж и мониторинг статусов.

## 📋 Содержание

- [Возможности](#-возможности)
- [Технологический стек](#-технологический-стек)
- [Быстрый старт](#-быстрый-старт)
- [Структура проекта](#-структура-проекта)
- [API документация](#-api-документация)
- [Модели данных](#-модели-данных)
- [Роли и права доступа](#-роли-и-права-доступа)
- [Бизнес-логика](#-бизнес-логика)
- [Device Gateway](#-device-gateway)
- [Развертывание](#-развертывание)

## 🚀 Возможности

### ✅ Реализовано в MVP v1.0:

- **JWT аутентификация** с ролевой моделью (ADMIN/MANAGER)
- **CRUD автоматов** с управлением локациями и назначением менеджеров
- **Система пополнений** с контролем сессий и валидацией остатков
- **Автоматическое управление статусами** автоматов (WORKING/LOW_STOCK/OUT_OF_STOCK/IN_SERVICE/ERROR)
- **Система алертов** с debounce механизмом (не чаще раза в 30 минут)
- **Регистрация продаж** с автоматическим обновлением остатков
- **Device Gateway API** для интеграции с железом автоматов
- **Телеметрия и heartbeat** от устройств
- **Детальный аудит** всех операций
- **Seed данные** для быстрого тестирования

### ⏳ Планируется в v1.1:

- WebSocket real-time обновления
- Карта локаций с геопозиционированием
- Email/Telegram уведомления
- Расширенная аналитика и отчёты

## 🛠 Технологический стек

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Database**: MongoDB + Mongoose ODM
- **Validation**: Zod
- **Authentication**: JWT (custom implementation)
- **Password Hashing**: bcrypt
- **Real-time**: Socket.io (готово к интеграции)
- **Styling**: Tailwind CSS
- **Development**: TSX для скриптов

## ⚡ Быстрый старт

### 1. Установка зависимостей

```bash
yarn install
```

### 2. Настройка окружения

Создайте файл `.env.local` на основе `.env.example`:

```env
# MongoDB
MONGODB_URI=mongodb://localhost:27017/vending-machines
MONGODB_DB_NAME=vending-machines

# JWT Authentication  
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# Server Configuration
PORT=3000
NODE_ENV=development

# Device API
DEVICE_API_SECRET=device-gateway-secret-key

# Admin User (для seed данных)
ADMIN_EMAIL=admin@vendingapp.kz
ADMIN_PASSWORD=admin123
ADMIN_NAME=System Administrator
```

### 3. Запуск MongoDB

```bash
# Установите MongoDB локально или используйте Docker
docker run --name vending-mongo -p 27017:27017 -d mongo:latest
```

### 4. Заполнение тестовыми данными

```bash
yarn seed
```

Это создаст:
- 3 пользователя (1 админ, 2 менеджера)
- 5 локаций в Алматы
- 8 автоматов с разными остатками
- 500 продаж за последние 30 дней
- 50 записей пополнений
- Алерты для автоматов с низкими остатками

### 5. Запуск сервера

```bash
yarn dev
```

Система будет доступна по адресу: http://localhost:3000

## 📁 Структура проекта

```
├── app/
│   ├── api/                    # API Routes (Next.js App Router)
│   │   ├── auth/              # Аутентификация
│   │   ├── users/             # Управление пользователями  
│   │   ├── locations/         # Управление локациями
│   │   ├── machines/          # Управление автоматами
│   │   └── device/            # Device Gateway API
│   ├── globals.css           # Глобальные стили
│   ├── layout.tsx           # Корневой layout
│   └── page.tsx            # Главная страница
├── entities/               # Mongoose модели
│   ├── User.ts
│   ├── Location.ts
│   ├── VendingMachine.ts
│   ├── RefillLog.ts
│   ├── Sale.ts
│   ├── Alert.ts
│   └── Device.ts
├── lib/                   # Утилиты и библиотеки
│   ├── auth/             # JWT и аутентификация
│   ├── database/         # Подключение к MongoDB
│   └── validation/       # Zod схемы валидации
├── scripts/              # Служебные скрипты
│   └── seed.ts          # Заполнение тестовыми данными
└── types/               # TypeScript типы
    └── index.ts
```

## 🔌 API документация

### Аутентификация

| Метод | Endpoint | Описание |
|-------|----------|----------|
| POST | `/api/auth/login` | Вход в систему |
| POST | `/api/auth/logout` | Выход из системы |
| GET | `/api/auth/me` | Информация о текущем пользователе |

### Пользователи (только ADMIN)

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/users` | Список пользователей |
| POST | `/api/users` | Создание пользователя |
| GET | `/api/users/:id` | Информация о пользователе |
| PATCH | `/api/users/:id` | Обновление пользователя |
| DELETE | `/api/users/:id` | Деактивация пользователя |

### Локации

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/locations` | Список локаций |
| POST | `/api/locations` | Создание локации (ADMIN) |

### Автоматы

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/machines` | Список автоматов |
| POST | `/api/machines` | Создание автомата (ADMIN) |
| GET | `/api/machines/:id` | Информация об автомате |
| PATCH | `/api/machines/:id` | Обновление автомата (ADMIN) |
| DELETE | `/api/machines/:id` | Удаление автомата (ADMIN) |
| POST | `/api/machines/:id/assign` | Назначение менеджера (ADMIN) |
| POST | `/api/machines/:id/refill/start` | Начало пополнения |
| POST | `/api/machines/:id/refill/finish` | Завершение пополнения |
| GET | `/api/machines/:id/refills` | История пополнений |

### Device Gateway

| Метод | Endpoint | Описание |
|-------|----------|----------|
| POST | `/api/device/:machineId/heartbeat` | Heartbeat от устройства |
| POST | `/api/device/:machineId/telemetry` | Телеметрия (остатки, ошибки) |
| POST | `/api/device/:machineId/sale` | Регистрация продажи |

## 🗄 Модели данных

### User (Пользователь)
- `email` - уникальный email
- `role` - ADMIN | MANAGER
- `name` - имя пользователя
- `phone` - телефон (опционально)
- `isActive` - активен ли аккаунт

### Location (Локация)
- `name` - название локации
- `address` - адрес
- `geo` - координаты (lat, lng)
- `timezone` - часовой пояс

### VendingMachine (Автомат)
- `machineId` - уникальный ID автомата
- `locationId` - ссылка на локацию
- `capacity` - вместимость (по умолчанию 360)
- `stock` - текущий остаток
- `status` - WORKING | LOW_STOCK | OUT_OF_STOCK | IN_SERVICE | ERROR
- `assignedManagerId` - назначенный менеджер

### RefillLog (Журнал пополнений)
- `machineId` - автомат
- `managerId` - менеджер
- `startedAt / finishedAt` - время начала/окончания
- `before / added / after` - остатки до/добавлено/после

### Sale (Продажа)
- `machineId` - автомат
- `sku` - код товара
- `price / qty / total` - цена/количество/сумма
- `paymentMethod` - способ оплаты

## 👥 Роли и права доступа

### ADMIN (Администратор)
- Полный доступ ко всем функциям
- Управление пользователями и автоматами
- Просмотр статистики по всем автоматам
- Назначение менеджеров

### MANAGER (Менеджер)
- Просмотр назначенных автоматов
- Пополнение автоматов
- Просмотр истории своих пополнений
- Получение уведомлений о низких остатках

## ⚙️ Бизнес-логика

### Статусы автоматов

1. **WORKING** - автомат работает нормально (остаток ≥ 150)
2. **LOW_STOCK** - нужно пополнение (остаток < 150)
3. **OUT_OF_STOCK** - товары закончились (остаток = 0)
4. **IN_SERVICE** - автомат обслуживается менеджером
5. **ERROR** - ошибка системы, требует вмешательства

### Пороги и правила

- **Порог пополнения**: 150 банок
- **Максимальная вместимость**: 360 банок (настраивается)
- **Debounce алертов**: не чаще 1 раза в 30 минут
- **Drift detection**: расхождение > 5% от вместимости
- **Timeout сессии**: 4 часа на пополнение

### Процесс пополнения

1. Менеджер начинает сессию пополнения
2. Автомат переходит в статус `IN_SERVICE`
3. Менеджер указывает количество добавленных банок
4. Система рассчитывает фактический остаток (не больше capacity)
5. Создается запись в журнале пополнений
6. Статус пересчитывается автоматически

## 📱 Device Gateway

API для интеграции с физическими автоматами:

### Аутентификация устройств
- Каждый автомат имеет уникальный API ключ
- Ключ передается в заголовке `X-API-KEY`

### Heartbeat
- Устройство должно отправлять heartbeat каждые 5-10 минут
- При отсутствии сигнала > 30 минут автомат считается offline

### Телеметрия
- Обновление остатков товаров
- Коды ошибок и температура
- Автоматическое создание алертов

### Продажи
- Регистрация каждой продажи
- Автоматическое обновление остатков
- Контроль доступности товаров

## 🚀 Развертывание

### Production Environment

1. Настройте переменные окружения:
```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/vending
JWT_SECRET=production-secret-key
```

2. Соберите проект:
```bash
yarn build
```

3. Запустите:
```bash
yarn start
```

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .
RUN yarn build
EXPOSE 3000
CMD ["yarn", "start"]
```

## 🧪 Тестовые аккаунты

После запуска `yarn seed`:

- **Администратор**: admin@vendingapp.kz / admin123
- **Менеджер 1**: manager1@vendingapp.kz / manager123  
- **Менеджер 2**: manager2@vendingapp.kz / manager456

## 📊 Пример использования API

### Логин администратора

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@vendingapp.kz", "password": "admin123"}'
```

### Получение списка автоматов

```bash
curl -X GET "http://localhost:3000/api/machines?needsRefill=true" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Начало пополнения

```bash
curl -X POST http://localhost:3000/api/machines/MACHINE_ID/refill/start \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Завершение пополнения

```bash
curl -X POST http://localhost:3000/api/machines/MACHINE_ID/refill/finish \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"added": 200, "comment": "Плановое пополнение"}'
```

## 🔧 Команды разработки

```bash
# Запуск в режиме разработки
yarn dev

# Сборка для production
yarn build

# Запуск production сервера
yarn start

# Заполнение тестовыми данными
yarn seed

# Проверка линтера
yarn lint
```

## 📈 Будущие улучшения

- [ ] WebSocket real-time обновления
- [ ] Карта с геопозиционированием
- [ ] Push уведомления для менеджеров
- [ ] Расширенная аналитика продаж
- [ ] Мобильное приложение для покупателей
- [ ] Интеграция с платёжными системами
- [ ] Система лояльности
- [ ] ML предсказание потребления

---

## 🤝 Поддержка

Для получения поддержки или предложений по улучшению создайте issue в репозитории или обратитесь к команде разработки.

**MVP v1.0 готов к использованию! 🎉**