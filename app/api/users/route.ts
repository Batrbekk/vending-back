import { 
  withAdminRole, 
  AuthenticatedRequest, 
  createSuccessResponse, 
  createErrorResponse 
} from '@/lib/auth/middleware';
import { CreateUserSchema } from '@/lib/validation/auth';
import { PasswordService } from '@/lib/auth/password';
import { User } from '@/entities';
import { UserRole } from '@/types';
import dbConnect from '@/lib/database/connection';

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Получение списка пользователей
 *     description: Возвращает список всех пользователей с фильтрацией и пагинацией (только для админов)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [admin, manager, operator]
 *         description: Фильтр по роли пользователя
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Фильтр по активности пользователя
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
 *         description: Успешное получение списка пользователей
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
 *                     users:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/User'
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
 *                           example: 100
 *                         totalPages:
 *                           type: integer
 *                           example: 5
 *                         hasNext:
 *                           type: boolean
 *                           example: true
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
 *     summary: Создание нового пользователя
 *     description: Создает нового пользователя в системе (только для админов)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, name]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "newuser@example.com"
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 example: "password123"
 *               name:
 *                 type: string
 *                 example: "Новый Пользователь"
 *               role:
 *                 type: string
 *                 enum: [admin, manager, operator]
 *                 default: manager
 *                 example: "manager"
 *               phone:
 *                 type: string
 *                 example: "+7 (999) 123-45-67"
 *     responses:
 *       201:
 *         description: Пользователь успешно создан
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
 *                     user:
 *                       $ref: '#/components/schemas/User'
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
 *         description: Пользователь с таким email уже существует
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

// Получение списка пользователей (только админы)
async function handleGetUsers(request: AuthenticatedRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    
    // Фильтры
    const role = searchParams.get('role') as UserRole | null;
    const isActive = searchParams.get('isActive');
    const search = searchParams.get('search'); // Поиск по имени/email
    
    // Пагинация
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100); // Максимум 100
    const skip = (page - 1) * limit;

    // Построение фильтра
    const filter: Record<string, unknown> = {};
    
    if (role && Object.values(UserRole).includes(role)) {
      filter.role = role;
    }
    
    if (isActive !== null) {
      filter.isActive = isActive === 'true';
    }
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Получаем пользователей и общее количество
    const [users, totalCount] = await Promise.all([
      User.find(filter)
        .select('-passwordHash') // Исключаем пароль
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return createSuccessResponse({
      users,
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
    console.error('Ошибка получения пользователей:', error);
    return createErrorResponse('Ошибка получения пользователей', 500);
  }
}

// Создание нового пользователя (только админы)
async function handleCreateUser(request: AuthenticatedRequest) {
  try {
    await dbConnect();

    const body = await request.json();
    const validatedData = CreateUserSchema.parse(body);

    // Проверяем не существует ли пользователь с таким email
    const existingUser = await User.findOne({ email: validatedData.email });
    if (existingUser) {
      return createErrorResponse('Пользователь с таким email уже существует', 409);
    }

    // Хешируем пароль
    const passwordHash = await PasswordService.hashPassword(validatedData.password);

    // Создаем пользователя
    const user = new User({
      email: validatedData.email,
      passwordHash,
      name: validatedData.name,
      role: validatedData.role || UserRole.MANAGER,
      phone: validatedData.phone,
      isActive: true
    });

    await user.save();

    // Возвращаем пользователя без пароля
    const userData = user.toJSON();

    return createSuccessResponse({ user: userData }, 201);

  } catch (error) {
    console.error('Ошибка создания пользователя:', error);

    if (error instanceof Error) {
      if (error.name === 'ZodError') {
        return createErrorResponse('Некорректные данные формы', 400);
      }
      
      // Ошибки MongoDB
      if (error.message.includes('duplicate key')) {
        return createErrorResponse('Пользователь с таким email уже существует', 409);
      }
      
      return createErrorResponse(error.message, 400);
    }

    return createErrorResponse('Ошибка создания пользователя', 500);
  }
}

export const GET = withAdminRole(handleGetUsers);
export const POST = withAdminRole(handleCreateUser);
