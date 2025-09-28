import { NextRequest, NextResponse } from 'next/server';
import { JWTService, JWTPayload } from './jwt';
import { UserRole } from '@/types';

export interface AuthenticatedRequest extends NextRequest {
  user?: JWTPayload;
}

/**
 * Middleware для проверки аутентификации
 */
export function withAuth<C = unknown>(
  handler: (req: AuthenticatedRequest, context: C) => Promise<NextResponse>
) {
  // ВАЖНО: возвращаем обработчик, совместимый с Next.js Route Handlers (принимает request и context)
  return async (request: NextRequest, context: C): Promise<NextResponse> => {
    // 1) Извлекаем токен
    const token = JWTService.extractTokenFromRequest(request);
    if (!token) {
      return NextResponse.json(
        { error: 'Токен авторизации отсутствует' },
        { status: 401 }
      );
    }

    // 2) Валидируем токен
    try {
      const payload = await JWTService.verifyToken(token);
      (request as AuthenticatedRequest).user = payload;
    } catch {
      return NextResponse.json(
        { error: 'Недействительный токен авторизации' },
        { status: 401 }
      );
    }

    // 3) Передаем управление целевому обработчику и прокидываем context (например, params)
    try {
      return await handler(request as AuthenticatedRequest, context);
    } catch (error) {
      console.error('Ошибка обработчика маршрута:', error);
      return NextResponse.json(
        { error: 'Внутренняя ошибка сервера' },
        { status: 500 }
      );
    }
  };
}

/**
 * Middleware для проверки роли пользователя
 */
export function withRole<C = unknown>(
  requiredRole: UserRole | UserRole[],
  handler: (req: AuthenticatedRequest, context: C) => Promise<NextResponse>
) {
  return withAuth<C>(async (request: AuthenticatedRequest, context: C): Promise<NextResponse> => {
    const user = request.user!;

    if (!JWTService.hasRole(user.role, requiredRole)) {
      return NextResponse.json(
        { error: 'Недостаточно прав доступа' },
        { status: 403 }
      );
    }

    return await handler(request, context);
  });
}

/**
 * Middleware только для админов
 */
export function withAdminRole<C = unknown>(
  handler: (req: AuthenticatedRequest, context: C) => Promise<NextResponse>
) {
  return withRole<C>(UserRole.ADMIN, handler);
}

/**
 * Middleware для админов или менеджеров
 */
export function withAnyRole<C = unknown>(
  handler: (req: AuthenticatedRequest, context: C) => Promise<NextResponse>
) {
  return withRole<C>([UserRole.ADMIN, UserRole.MANAGER], handler);
}

/**
 * Middleware для проверки доступа к ресурсу
 * Позволяет доступ админам или владельцу ресурса
 */
export function withResourceAccess<C = unknown>(
  getResourceOwnerId: (req: AuthenticatedRequest, context: C) => Promise<string | null>,
  handler: (req: AuthenticatedRequest, context: C) => Promise<NextResponse>
) {
  return withAuth<C>(async (request: AuthenticatedRequest, context: C): Promise<NextResponse> => {
    const user = request.user!;

    // Админ имеет доступ ко всем ресурсам
    if (user.role === UserRole.ADMIN) {
      return await handler(request, context);
    }

    try {
      // Получаем ID владельца ресурса
      const resourceOwnerId = await getResourceOwnerId(request, context);

      if (!resourceOwnerId || user.userId !== resourceOwnerId) {
        return NextResponse.json(
          { error: 'Нет доступа к данному ресурсу' },
          { status: 403 }
        );
      }

      return await handler(request, context);
    } catch {
      return NextResponse.json(
        { error: 'Ошибка проверки доступа к ресурсу' },
        { status: 500 }
      );
    }
  });
}

/**
 * Утилита для извлечения данных пользователя из запроса
 */
export function getCurrentUser(request: AuthenticatedRequest): JWTPayload | null {
  return request.user || null;
}

/**
 * Проверка является ли пользователь админом
 */
export function isAdmin(request: AuthenticatedRequest): boolean {
  return request.user?.role === UserRole.ADMIN;
}

/**
 * Проверка является ли пользователь менеджером
 */
export function isManager(request: AuthenticatedRequest): boolean {
  return request.user?.role === UserRole.MANAGER;
}

/**
 * Создание стандартного ответа об ошибке
 */
export function createErrorResponse(message: string, status: number = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Создание стандартного успешного ответа
 */
export function createSuccessResponse(data: unknown, status: number = 200): NextResponse {
  return NextResponse.json({ success: true, data }, { status });
}
