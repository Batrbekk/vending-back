import { JWTService } from '@/lib/auth/jwt';
import { createSuccessResponse } from '@/lib/auth/middleware';

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Выход из системы
 *     description: Завершение сессии пользователя и очистка аутентификационных данных
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Успешный выход из системы
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
 *                       example: "Выход выполнен успешно"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *         headers:
 *           Set-Cookie:
 *             description: Очистка JWT токена из cookie
 *             schema:
 *               type: string
 *               example: auth-token=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0
 *   get:
 *     summary: Выход из системы (GET)
 *     description: Альтернативный способ выхода из системы через GET запрос
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Успешный выход из системы
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
 *                       example: "Выход выполнен успешно"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
export async function POST() {
  try {
    // Создаем ответ об успешном выходе
    const response = createSuccessResponse({
      message: 'Выход выполнен успешно'
    });

    // Очищаем cookie с токеном
    response.headers.set('Set-Cookie', JWTService.clearTokenCookie());

    return response;

  } catch (error) {
    console.error('Ошибка при выходе:', error);
    
    // В любом случае очищаем cookie
    const response = createSuccessResponse({
      message: 'Выход выполнен'
    });

    response.headers.set('Set-Cookie', JWTService.clearTokenCookie());
    return response;
  }
}

// Поддержка GET запроса для случаев когда фронтенд использует GET
export async function GET() {
  return POST();
}
