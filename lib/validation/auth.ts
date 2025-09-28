import { z } from 'zod';

// Схемы валидации для аутентификации
export const LoginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email обязателен')
    .email('Некорректный email')
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(6, 'Пароль должен содержать минимум 6 символов')
    .max(128, 'Пароль не должен превышать 128 символов')
});

export const CreateUserSchema = z.object({
  email: z
    .string()
    .min(1, 'Email обязателен')
    .email('Некорректный email')
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(6, 'Пароль должен содержать минимум 6 символов')
    .max(128, 'Пароль не должен превышать 128 символов')
    .regex(/[a-zA-Z]/, 'Пароль должен содержать минимум одну букву')
    .regex(/\d/, 'Пароль должен содержать минимум одну цифру'),
  name: z
    .string()
    .min(1, 'Имя обязательно')
    .max(100, 'Имя не должно превышать 100 символов')
    .trim(),
  role: z.enum(['ADMIN', 'MANAGER'], {
    message: 'Роль должна быть ADMIN или MANAGER'
  }).optional(),
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{10,14}$/, 'Некорректный номер телефона')
    .optional()
    .nullable()
});

export const UpdateUserSchema = z.object({
  email: z
    .string()
    .email('Некорректный email')
    .toLowerCase()
    .trim()
    .optional(),
  password: z
    .string()
    .min(6, 'Пароль должен содержать минимум 6 символов')
    .max(128, 'Пароль не должен превышать 128 символов')
    .regex(/[a-zA-Z]/, 'Пароль должен содержать минимум одну букву')
    .regex(/\d/, 'Пароль должен содержать минимум одну цифру')
    .optional(),
  name: z
    .string()
    .min(1, 'Имя не может быть пустым')
    .max(100, 'Имя не должно превышать 100 символов')
    .trim()
    .optional(),
  role: z.enum(['ADMIN', 'MANAGER'], {
    message: 'Роль должна быть ADMIN или MANAGER'
  }).optional(),
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{10,14}$/, 'Некорректный номер телефона')
    .optional()
    .nullable(),
  isActive: z.boolean().optional()
});

export const ChangePasswordSchema = z.object({
  currentPassword: z
    .string()
    .min(1, 'Текущий пароль обязателен'),
  newPassword: z
    .string()
    .min(6, 'Новый пароль должен содержать минимум 6 символов')
    .max(128, 'Новый пароль не должен превышать 128 символов')
    .regex(/[a-zA-Z]/, 'Новый пароль должен содержать минимум одну букву')
    .regex(/\d/, 'Новый пароль должен содержать минимум одну цифру')
});

// Типы для использования в API
export type LoginInput = z.infer<typeof LoginSchema>;
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
