import { 
  withAdminRole, 
  AuthenticatedRequest, 
  createSuccessResponse, 
  createErrorResponse 
} from '@/lib/auth/middleware';
import { PasswordService } from '@/lib/auth/password';
import { User } from '@/entities';
import { UserRole } from '@/types';
import dbConnect from '@/lib/database/connection';
import { emailService } from '@/lib/email/emailService';
import { z } from 'zod';

// Схема валидации для создания менеджера
const CreateManagerSchema = z.object({
  name: z.string().min(2, 'Имя должно содержать минимум 2 символа').max(100, 'Имя не должно превышать 100 символов'),
  email: z.string().email('Некорректный email адрес'),
  phone: z.string().min(10, 'Некорректный номер телефона').optional(),
});

// Схема валидации для обновления менеджера
const UpdateManagerSchema = z.object({
  name: z.string().min(2, 'Имя должно содержать минимум 2 символа').max(100, 'Имя не должно превышать 100 символов').optional(),
  email: z.string().email('Некорректный email адрес').optional(),
  phone: z.string().min(10, 'Некорректный номер телефона').optional(),
});

/**
 * @swagger
 * /api/managers:
 *   get:
 *     summary: Получение списка менеджеров
 *     description: Возвращает список всех менеджеров с фильтрацией и пагинацией (только для админов)
 *     tags: [Managers]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Поиск по имени или email
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Номер страницы
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Количество записей на странице
 *     responses:
 *       200:
 *         description: Успешное получение списка менеджеров
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     managers:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Manager'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                           example: 1
 *                         limit:
 *                           type: integer
 *                           example: 20
 *                         totalCount:
 *                           type: integer
 *                           example: 10
 *                         totalPages:
 *                           type: integer
 *                           example: 1
 *                         hasNext:
 *                           type: boolean
 *                           example: false
 *                         hasPrev:
 *                           type: boolean
 *                           example: false
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Не авторизован
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Недостаточно прав (только для админов)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Внутренняя ошибка сервера
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   post:
 *     summary: Создание нового менеджера
 *     description: Создает нового менеджера и отправляет ему email с авторизационными данными (только для админов)
 *     tags: [Managers]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email]
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Иван Иванов"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "ivan@example.com"
 *               phone:
 *                 type: string
 *                 example: "+7 (999) 123-45-67"
 *     responses:
 *       201:
 *         description: Менеджер успешно создан
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     manager:
 *                       $ref: '#/components/schemas/Manager'
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Некорректные данные формы
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Не авторизован
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Недостаточно прав (только для админов)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Менеджер с таким email уже существует
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Внутренняя ошибка сервера
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

// Генерация случайного пароля
function generateRandomPassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// Получение списка менеджеров (только админы)
async function handleGetManagers(request: AuthenticatedRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    
    // Фильтры
    const search = searchParams.get('search'); // Поиск по имени/email
    
    // Пагинация
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100); // Максимум 100
    const skip = (page - 1) * limit;

    // Построение фильтра только для менеджеров
    const filter: Record<string, unknown> = {
      role: UserRole.MANAGER,
      isActive: true
    };
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Получаем менеджеров и общее количество
    const [managers, totalCount] = await Promise.all([
      User.find(filter)
        .select('-passwordHash') // Исключаем пароль
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return createSuccessResponse({
      managers,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('Ошибка получения менеджеров:', error);
    return createErrorResponse('Ошибка получения менеджеров', 500);
  }
}

// Создание нового менеджера (только админы)
async function handleCreateManager(request: AuthenticatedRequest) {
  try {
    await dbConnect();

    const body = await request.json();
    const validatedData = CreateManagerSchema.parse(body);

    // Проверяем не существует ли пользователь с таким email
    const existingUser = await User.findOne({ email: validatedData.email });
    if (existingUser) {
      // Если менеджер существует, но деактивирован — реактивируем вместо конфликта
      if (existingUser.role === UserRole.MANAGER && existingUser.isActive === false) {
        // Генерируем новый пароль при реактивации
        const reactivatedPassword = generateRandomPassword();
        const reactivatedPasswordHash = await PasswordService.hashPassword(reactivatedPassword);

        existingUser.name = validatedData.name;
        existingUser.phone = validatedData.phone;
        existingUser.passwordHash = reactivatedPasswordHash;
        existingUser.isActive = true;
        await existingUser.save();

        const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard`;
        const emailSent = await emailService.sendManagerCredentials({
          name: validatedData.name,
          email: validatedData.email,
          password: reactivatedPassword,
          loginUrl
        });

        if (!emailSent) {
          console.warn('Не удалось отправить email с авторизационными данными при реактивации');
        }

        const managerData = existingUser.toJSON();
        return createSuccessResponse({ manager: managerData, emailSent, reactivated: true }, 200);
      }

      return createErrorResponse('Менеджер с таким email уже существует', 409);
    }

    // Генерируем случайный пароль
    const password = generateRandomPassword();
    const passwordHash = await PasswordService.hashPassword(password);

    // Создаем менеджера
    const manager = new User({
      email: validatedData.email,
      passwordHash,
      name: validatedData.name,
      role: UserRole.MANAGER,
      phone: validatedData.phone,
      isActive: true
    });

    await manager.save();

    // Отправляем email с авторизационными данными
    const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard`;
    const emailSent = await emailService.sendManagerCredentials({
      name: validatedData.name,
      email: validatedData.email,
      password,
      loginUrl
    });

    if (!emailSent) {
      console.warn('Не удалось отправить email с авторизационными данными');
    }

    // Возвращаем менеджера без пароля
    const managerData = manager.toJSON();

    return createSuccessResponse({ 
      manager: managerData,
      emailSent 
    }, 201);

  } catch (error) {
    console.error('Ошибка создания менеджера:', error);

    if (error instanceof Error) {
      if (error.name === 'ZodError') {
        return createErrorResponse('Некорректные данные формы', 400);
      }
      
      // Ошибки MongoDB
      if (error.message.includes('duplicate key')) {
        return createErrorResponse('Менеджер с таким email уже существует', 409);
      }
      
      return createErrorResponse(error.message, 400);
    }

    return createErrorResponse('Ошибка создания менеджера', 500);
  }
}

export const GET = withAdminRole(handleGetManagers);
export const POST = withAdminRole(handleCreateManager);
