import bcrypt from 'bcryptjs';

export class PasswordService {
  private static readonly SALT_ROUNDS = 12;

  /**
   * Хеширование пароля
   */
  static async hashPassword(password: string): Promise<string> {
    if (!password || password.length < 6) {
      throw new Error('Пароль должен содержать минимум 6 символов');
    }

    try {
      return await bcrypt.hash(password, this.SALT_ROUNDS);
    } catch {
      throw new Error('Ошибка хеширования пароля');
    }
  }

  /**
   * Проверка пароля
   */
  static async comparePassword(password: string, hashedPassword: string): Promise<boolean> {
    if (!password || !hashedPassword) {
      return false;
    }

    try {
      return await bcrypt.compare(password, hashedPassword);
    } catch (error) {
      console.error('Ошибка сравнения пароля:', error);
      return false;
    }
  }

  /**
   * Валидация сложности пароля
   */
  static validatePassword(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!password) {
      errors.push('Пароль обязателен');
      return { isValid: false, errors };
    }

    if (password.length < 6) {
      errors.push('Пароль должен содержать минимум 6 символов');
    }

    if (password.length > 128) {
      errors.push('Пароль не должен превышать 128 символов');
    }

    if (!/[a-zA-Z]/.test(password)) {
      errors.push('Пароль должен содержать минимум одну букву');
    }

    if (!/\d/.test(password)) {
      errors.push('Пароль должен содержать минимум одну цифру');
    }

    // Проверка на простые пароли
    const commonPasswords = [
      '123456', 'password', '12345678', 'qwerty', '123456789',
      'admin', 'administrator', '1234567890', 'password123'
    ];
    
    if (commonPasswords.includes(password.toLowerCase())) {
      errors.push('Пароль слишком простой');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Генерация случайного пароля
   */
  static generateRandomPassword(length: number = 12): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    const allChars = uppercase + lowercase + numbers + symbols;
    let password = '';

    // Обеспечиваем наличие минимум по одному символу каждого типа
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];

    // Заполняем оставшиеся позиции случайными символами
    for (let i = password.length; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Перемешиваем символы
    return password
      .split('')
      .sort(() => 0.5 - Math.random())
      .join('');
  }
}
