import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest, createSuccessResponse } from '@/lib/auth/middleware';
import dbConnect from '@/lib/database/connection';
import { User } from '@/entities';

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Получение информации о текущем пользователе
 *     description: Возвращает данные авторизованного пользователя
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Успешное получение данных пользователя
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
 *       401:
 *         description: Не авторизован
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Пользователь не найден
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

// Получение информации о текущем пользователе
async function handleGetMe(request: AuthenticatedRequest) {
  try {
    await dbConnect();

    // Получаем полную информацию о пользователе из БД
    const user = await User.findById(request.user!.userId);
    
    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: 'Пользователь не найден' },
        { status: 404 }
      );
    }

    // Возвращаем данные пользователя (без пароля)
    const userData = {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      phone: user.phone,
      avatar: user.avatar,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    return createSuccessResponse({ user: userData });

  } catch (error) {
    console.error('Ошибка получения данных пользователя:', error);
    return NextResponse.json(
      { error: 'Ошибка получения данных пользователя' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(handleGetMe);
