import { 
  withAdminRole, 
  AuthenticatedRequest, 
  createSuccessResponse, 
  createErrorResponse 
} from '@/lib/auth/middleware';
import { UpdateUserSchema } from '@/lib/validation/auth';
import { PasswordService } from '@/lib/auth/password';
import { User } from '@/entities';
import dbConnect from '@/lib/database/connection';
import mongoose from 'mongoose';
import { UserRole } from '@/types';

// Получение пользователя по ID
async function handleGetUser(request: AuthenticatedRequest) {
  const { pathname } = new URL(request.url);
  const id = pathname.split('/').slice(-1)[0]; // Извлекаем ID из URL
  try {
    await dbConnect();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return createErrorResponse('Некорректный ID пользователя', 400);
    }

    const user = await User.findById(id).select('-passwordHash');
    
    if (!user) {
      return createErrorResponse('Пользователь не найден', 404);
    }

    return createSuccessResponse({ user });

  } catch (error) {
    console.error('Ошибка получения пользователя:', error);
    return createErrorResponse('Ошибка получения пользователя', 500);
  }
}

// Обновление пользователя
async function handleUpdateUser(request: AuthenticatedRequest) {
  const { pathname } = new URL(request.url);
  const id = pathname.split('/').slice(-1)[0]; // Извлекаем ID из URL
  try {
    await dbConnect();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return createErrorResponse('Некорректный ID пользователя', 400);
    }

    const body = await request.json();
    const validatedData = UpdateUserSchema.parse(body);

    // Находим пользователя
    const user = await User.findById(id);
    if (!user) {
      return createErrorResponse('Пользователь не найден', 404);
    }

    // Проверяем уникальность email при его изменении
    if (validatedData.email && validatedData.email !== user.email) {
      const existingUser = await User.findOne({ 
        email: validatedData.email,
        _id: { $ne: id }
      });
      
      if (existingUser) {
        return createErrorResponse('Пользователь с таким email уже существует', 409);
      }
      
      user.email = validatedData.email;
    }

    // Обновляем поля
    if (validatedData.name !== undefined) user.name = validatedData.name;
    if (validatedData.role !== undefined) user.role = validatedData.role as UserRole;
    if (validatedData.phone !== undefined) user.phone = validatedData.phone as string | undefined;
    if (validatedData.isActive !== undefined) user.isActive = validatedData.isActive;

    // Обновляем пароль если указан
    if (validatedData.password) {
      user.passwordHash = await PasswordService.hashPassword(validatedData.password);
    }

    await user.save();

    // Возвращаем обновленного пользователя без пароля
    const userData = user.toJSON();

    return createSuccessResponse({ user: userData });

  } catch (error) {
    console.error('Ошибка обновления пользователя:', error);

    if (error instanceof Error) {
      if (error.name === 'ZodError') {
        return createErrorResponse('Некорректные данные формы', 400);
      }
      
      return createErrorResponse(error.message, 400);
    }

    return createErrorResponse('Ошибка обновления пользователя', 500);
  }
}

// Деактивация пользователя (мягкое удаление)
async function handleDeleteUser(request: AuthenticatedRequest) {
  const { pathname } = new URL(request.url);
  const id = pathname.split('/').slice(-1)[0]; // Извлекаем ID из URL
  try {
    await dbConnect();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return createErrorResponse('Некорректный ID пользователя', 400);
    }

    // Проверяем что пользователь не удаляет сам себя
    if (request.user!.userId === id) {
      return createErrorResponse('Нельзя удалить свой аккаунт', 400);
    }

    const user = await User.findById(id);
    if (!user) {
      return createErrorResponse('Пользователь не найден', 404);
    }

    // Деактивируем пользователя вместо полного удаления
    user.isActive = false;
    await user.save();

    return createSuccessResponse({ 
      message: 'Пользователь деактивирован',
      user: user.toJSON()
    });

  } catch (error) {
    console.error('Ошибка деактивации пользователя:', error);
    return createErrorResponse('Ошибка деактивации пользователя', 500);
  }
}

export const GET = withAdminRole(handleGetUser);
export const PATCH = withAdminRole(handleUpdateUser);
export const DELETE = withAdminRole(handleDeleteUser);
