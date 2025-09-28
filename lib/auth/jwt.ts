import jwt from 'jsonwebtoken';
import { UserRole } from '@/types';
import { Types } from 'mongoose';

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  name: string;
  iat?: number;
  exp?: number;
}

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';

export class JWTService {
  /**
   * Создание JWT токена
   */
  static async generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): Promise<string> {
    return new Promise((resolve, reject) => {
      jwt.sign(
        payload,
        JWT_SECRET as string,
        {
          expiresIn: '7d',
          algorithm: 'HS256'
        },
        (error, token) => {
          if (error || !token) {
            reject(new Error('Ошибка создания токена'));
          } else {
            resolve(token);
          }
        }
      );
    });
  }

  /**
   * Верификация JWT токена
   */
  static async verifyToken(token: string): Promise<JWTPayload> {
    return new Promise((resolve, reject) => {
      jwt.verify(token, JWT_SECRET, (error, decoded) => {
        if (error) {
          reject(new Error('Недействительный токен'));
        } else {
          resolve(decoded as JWTPayload);
        }
      });
    });
  }

  /**
   * Извлечение токена из заголовка Authorization или cookie
   */
  static extractTokenFromRequest(request: Request): string | null {
    // Сначала проверяем заголовок Authorization
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }

    // Затем проверяем cookie (для браузерных запросов)
    const cookies = request.headers.get('cookie');
    if (cookies) {
      const tokenMatch = cookies.match(/accessToken=([^;]+)/);
      if (tokenMatch) {
        return tokenMatch[1];
      }
    }

    return null;
  }

  /**
   * Проверка роли пользователя
   */
  static hasRole(userRole: UserRole, requiredRole: UserRole | UserRole[]): boolean {
    if (Array.isArray(requiredRole)) {
      return requiredRole.includes(userRole);
    }
    
    // Админ имеет доступ ко всему
    if (userRole === UserRole.ADMIN) {
      return true;
    }
    
    return userRole === requiredRole;
  }

  /**
   * Проверка прав доступа к ресурсу
   */
  static canAccessResource(
    userRole: UserRole, 
    userId: string, 
    resourceOwnerId?: string | Types.ObjectId,
    requiredRole?: UserRole
  ): boolean {
    // Админ имеет доступ ко всему
    if (userRole === UserRole.ADMIN) {
      return true;
    }

    // Если указана требуемая роль, проверяем её
    if (requiredRole && !this.hasRole(userRole, requiredRole)) {
      return false;
    }

    // Если указан владелец ресурса, проверяем что это текущий пользователь
    if (resourceOwnerId) {
      const ownerIdStr = typeof resourceOwnerId === 'string' 
        ? resourceOwnerId 
        : resourceOwnerId.toString();
      return userId === ownerIdStr;
    }

    return true;
  }

  /**
   * Создание cookie с токеном (без HttpOnly для доступа с клиента)
   */
  static createTokenCookie(token: string): string {
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 дней в миллисекундах
    return `accessToken=${token}; SameSite=Strict; Max-Age=${maxAge}; Path=/`;
  }

  /**
   * Удаление cookie с токеном
   */
  static clearTokenCookie(): string {
    return 'accessToken=; SameSite=Strict; Max-Age=0; Path=/';
  }
}
