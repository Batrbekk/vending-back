import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/database/connection';
import { User } from '@/entities';
import { PasswordService } from '@/lib/auth/password';
import { JWTService } from '@/lib/auth/jwt';
import { LoginSchema } from '@/lib/validation/auth';
import { createErrorResponse, createSuccessResponse } from '@/lib/auth/middleware';

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Авторизация пользователя
 *     description: Вход в систему с использованием email и пароля
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Успешная авторизация
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *         headers:
 *           Set-Cookie:
 *             description: JWT токен в HttpOnly cookie
 *             schema:
 *               type: string
 *               example: auth-token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...; HttpOnly; Path=/; SameSite=Strict
 *       400:
 *         description: Некорректные данные формы
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Неверные учетные данные или заблокированный аккаунт
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
export async function POST(request: NextRequest) {
  try {
    // Подключаемся к БД
    await dbConnect();

    // Получаем и валидируем данные
    const body = await request.json();
    const validatedData = LoginSchema.parse(body);

    // Ищем пользователя по email
    const user = await User.findByEmail(validatedData.email);
    
    if (!user) {
      return createErrorResponse('Неверные учетные данные', 401);
    }

    // Проверяем активен ли пользователь
    if (!user.isActive) {
      return createErrorResponse('Аккаунт заблокирован', 401);
    }

    // Проверяем пароль
    const isValidPassword = await PasswordService.comparePassword(
      validatedData.password,
      user.passwordHash
    );

    if (!isValidPassword) {
      return createErrorResponse('Неверные учетные данные', 401);
    }

    // Создаем JWT токен
    const token = await JWTService.generateToken({
      userId: (user._id as mongoose.Types.ObjectId).toString(),
      email: user.email,
      role: user.role,
      name: user.name
    });

    // Подготавливаем данные пользователя для ответа (без пароля)
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

    // Создаем ответ с токеном в cookie и в теле ответа
    const response = createSuccessResponse({
      accessToken: token,
      user: userData
    });

    // Устанавливаем HttpOnly cookie для браузерных запросов
    response.headers.set('Set-Cookie', JWTService.createTokenCookie(token));

    return response;

  } catch (error) {
    console.error('Ошибка при входе:', error);

    if (error instanceof Error) {
      // Ошибки валидации Zod
      if (error.name === 'ZodError') {
        return createErrorResponse('Некорректные данные формы', 400);
      }
      
      return createErrorResponse(error.message, 400);
    }

    return createErrorResponse('Внутренняя ошибка сервера', 500);
  }
}
