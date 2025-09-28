import { 
  withAdminRole, 
  AuthenticatedRequest, 
  createSuccessResponse, 
  createErrorResponse 
} from '@/lib/auth/middleware';
import { User } from '@/entities';
import { UserRole } from '@/types';
import dbConnect from '@/lib/database/connection';
import { z } from 'zod';
import { Types } from 'mongoose';

// Схема валидации для обновления менеджера
const UpdateManagerSchema = z.object({
  name: z.string().min(2, 'Имя должно содержать минимум 2 символа').max(100, 'Имя не должно превышать 100 символов').optional(),
  email: z.string().email('Некорректный email адрес').optional(),
  phone: z.string().min(10, 'Некорректный номер телефона').optional(),
});

/**
 * @swagger
 * /api/managers/{id}:
 *   get:
 *     summary: Получение информации о менеджере
 *     description: Возвращает информацию о конкретном менеджере (только для админов)
 *     tags: [Managers]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID менеджера
 *     responses:
 *       200:
 *         description: Успешное получение информации о менеджере
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
 *       404:
 *         description: Менеджер не найден
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
 *   patch:
 *     summary: Обновление менеджера
 *     description: Обновляет информацию о менеджере (только для админов)
 *     tags: [Managers]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID менеджера
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
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
 *       200:
 *         description: Менеджер успешно обновлен
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
 *       404:
 *         description: Менеджер не найден
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
 *   delete:
 *     summary: Удаление менеджера
 *     description: Деактивирует менеджера (мягкое удаление) (только для админов)
 *     tags: [Managers]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID менеджера
 *     responses:
 *       200:
 *         description: Менеджер успешно удален
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
 *                     message:
 *                       type: string
 *                       example: "Менеджер успешно удален"
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
 *       404:
 *         description: Менеджер не найден
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

// Получение информации о менеджере
async function handleGetManager(request: AuthenticatedRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();

    const { id } = await params;

    if (!Types.ObjectId.isValid(id)) {
      return createErrorResponse('Некорректный ID менеджера', 400);
    }

    const manager = await User.findOne({
      _id: id,
      role: UserRole.MANAGER,
      isActive: true
    }).select('-passwordHash');

    if (!manager) {
      return createErrorResponse('Менеджер не найден', 404);
    }

    return createSuccessResponse({ manager });

  } catch (error) {
    console.error('Ошибка получения менеджера:', error);
    return createErrorResponse('Ошибка получения менеджера', 500);
  }
}

// Обновление менеджера
async function handleUpdateManager(request: AuthenticatedRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();

    const { id } = await params;

    if (!Types.ObjectId.isValid(id)) {
      return createErrorResponse('Некорректный ID менеджера', 400);
    }

    const body = await request.json();
    const validatedData = UpdateManagerSchema.parse(body);

    // Проверяем существование менеджера
    const existingManager = await User.findOne({
      _id: id,
      role: UserRole.MANAGER,
      isActive: true
    });

    if (!existingManager) {
      return createErrorResponse('Менеджер не найден', 404);
    }

    // Если обновляется email, проверяем уникальность
    if (validatedData.email && validatedData.email !== existingManager.email) {
      const emailExists = await User.findOne({ 
        email: validatedData.email,
        _id: { $ne: id }
      });
      
      if (emailExists) {
        return createErrorResponse('Менеджер с таким email уже существует', 409);
      }
    }

    // Обновляем менеджера
    const updateData: Record<string, unknown> = {};
    if (validatedData.name) updateData.name = validatedData.name;
    if (validatedData.email) updateData.email = validatedData.email;
    if (validatedData.phone !== undefined) updateData.phone = validatedData.phone;

    const updatedManager = await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select('-passwordHash');

    return createSuccessResponse({ manager: updatedManager });

  } catch (error) {
    console.error('Ошибка обновления менеджера:', error);

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

    return createErrorResponse('Ошибка обновления менеджера', 500);
  }
}

// Удаление менеджера (мягкое удаление)
async function handleDeleteManager(request: AuthenticatedRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();

    const { id } = await params;

    if (!Types.ObjectId.isValid(id)) {
      return createErrorResponse('Некорректный ID менеджера', 400);
    }

    const manager = await User.findOne({
      _id: id,
      role: UserRole.MANAGER,
      isActive: true
    });

    if (!manager) {
      return createErrorResponse('Менеджер не найден', 404);
    }

    // Мягкое удаление - деактивируем пользователя
    await User.findByIdAndUpdate(id, { isActive: false });

    return createSuccessResponse({ message: 'Менеджер успешно удален' });

  } catch (error) {
    console.error('Ошибка удаления менеджера:', error);
    return createErrorResponse('Ошибка удаления менеджера', 500);
  }
}

export const GET = withAdminRole(handleGetManager);
export const PATCH = withAdminRole(handleUpdateManager);
export const DELETE = withAdminRole(handleDeleteManager);
