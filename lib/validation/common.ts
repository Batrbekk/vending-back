import { z } from 'zod';
import { MachineStatus, AlertType, PaymentMethod } from '@/types';

// Общие валидационные схемы
export const ObjectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Некорректный ID');

export const PaginationSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20)
});

// Схемы для локаций
export const CreateLocationSchema = z.object({
  name: z
    .string()
    .min(1, 'Название локации обязательно')
    .max(200, 'Название не должно превышать 200 символов')
    .trim(),
  address: z
    .string()
    .min(1, 'Адрес обязателен')
    .max(500, 'Адрес не должен превышать 500 символов')
    .trim(),
  geo: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180)
    })
    .optional(),
  timezone: z
    .string()
    .default('Asia/Almaty')
    .optional()
});

export const UpdateLocationSchema = CreateLocationSchema.partial();

// Схемы для автоматов
export const CreateMachineSchema = z
  .object({
    machineId: z
      .string()
      .min(3, 'ID автомата должен содержать минимум 3 символа')
      .max(20, 'ID автомата не должен превышать 20 символов')
      .regex(/^[A-Z0-9-]+$/, 'ID должен содержать только заглавные буквы, цифры и дефисы')
      .transform(s => s.toUpperCase()),
    locationId: ObjectIdSchema.optional(),
    locationName: z
      .string()
      .min(1, 'Название локации обязательно')
      .max(200, 'Название не должно превышать 200 символов')
      .trim()
      .optional(),
    capacity: z
      .number()
      .min(1, 'Вместимость должна быть больше 0')
      .max(1000, 'Максимальная вместимость 1000')
      .default(80),
    stock: z
      .number()
      .min(0, 'Остаток не может быть отрицательным')
      .default(0),
    assignedManagerId: ObjectIdSchema.optional(),
    notes: z
      .string()
      .max(1000, 'Заметка не должна превышать 1000 символов')
      .optional()
  })
  .refine((data) => !!data.locationId || !!data.locationName, {
    message: 'Укажите либо locationId, либо locationName',
    path: ['locationName']
  });

export const UpdateMachineSchema = z.object({
  locationId: ObjectIdSchema.optional(),
  capacity: z
    .number()
    .min(1, 'Вместимость должна быть больше 0')
    .max(1000, 'Максимальная вместимость 1000')
    .optional(),
  stock: z
    .number()
    .min(0, 'Остаток не может быть отрицательным')
    .optional(),
  status: z.nativeEnum(MachineStatus).optional(),
  assignedManagerId: ObjectIdSchema.nullable().optional(),
  notes: z
    .string()
    .max(1000, 'Заметка не должна превышать 1000 символов')
    .nullable()
    .optional()
});

export const AssignManagerSchema = z.object({
  managerId: ObjectIdSchema.nullable()
});

// Схемы для пополнений
export const StartRefillSchema = z.object({
  managerId: ObjectIdSchema
});

export const FinishRefillSchema = z.object({
  added: z
    .number()
    .min(1, 'Должна быть добавлена минимум 1 банка')
    .max(1000, 'Слишком большое количество за раз'),
  comment: z
    .string()
    .max(500, 'Комментарий не должен превышать 500 символов')
    .optional()
});

// Схемы для продаж
export const CreateSaleSchema = z.object({
  machineId: ObjectIdSchema,
  sku: z
    .string()
    .min(1, 'Код товара обязателен')
    .max(100, 'Код товара не должен превышать 100 символов')
    .trim(),
  price: z
    .number()
    .min(0.01, 'Цена должна быть больше 0'),
  qty: z
    .number()
    .int()
    .min(1, 'Количество должно быть больше 0'),
  paymentMethod: z.nativeEnum(PaymentMethod).optional(),
  receiptId: z
    .string()
    .trim()
    .optional()
});

// Схемы для устройств
export const CreateDeviceSchema = z.object({
  machineId: ObjectIdSchema,
  firmwareVersion: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, 'Версия должна быть в формате x.y.z')
    .optional()
});

export const TelemetrySchema = z.object({
  stock: z
    .number()
    .min(0)
    .max(1000)
    .optional(),
  errorCode: z
    .string()
    .max(50)
    .optional(),
  temperature: z
    .number()
    .optional()
});

// Схемы для алертов
export const ResolveAlertSchema = z.object({
  message: z
    .string()
    .max(500, 'Сообщение не должно превышать 500 символов')
    .optional()
});

// Фильтры для запросов
export const MachineFiltersSchema = z.object({
  status: z.nativeEnum(MachineStatus).optional(),
  locationId: ObjectIdSchema.optional(),
  assignedManagerId: ObjectIdSchema.optional(),
  needsRefill: z
    .string()
    .transform(val => val === 'true')
    .optional(),
  search: z.string().optional() // Поиск по machineId или заметкам
});

export const SalesFiltersSchema = z.object({
  machineId: ObjectIdSchema.optional(),
  from: z
    .string()
    .transform(str => new Date(str))
    .optional(),
  to: z
    .string()
    .transform(str => new Date(str))
    .optional(),
  sku: z.string().optional()
});

export const AlertFiltersSchema = z.object({
  machineId: ObjectIdSchema.optional(),
  type: z.nativeEnum(AlertType).optional(),
  resolved: z
    .string()
    .transform(val => val === 'true')
    .optional()
});

// Типы для использования в API
export type CreateLocationInput = z.infer<typeof CreateLocationSchema>;
export type UpdateLocationInput = z.infer<typeof UpdateLocationSchema>;
export type CreateMachineInput = z.infer<typeof CreateMachineSchema>;
export type UpdateMachineInput = z.infer<typeof UpdateMachineSchema>;
export type AssignManagerInput = z.infer<typeof AssignManagerSchema>;
export type StartRefillInput = z.infer<typeof StartRefillSchema>;
export type FinishRefillInput = z.infer<typeof FinishRefillSchema>;
export type CreateSaleInput = z.infer<typeof CreateSaleSchema>;
export type TelemetryInput = z.infer<typeof TelemetrySchema>;
export type MachineFilters = z.infer<typeof MachineFiltersSchema>;
export type SalesFilters = z.infer<typeof SalesFiltersSchema>;
export type AlertFilters = z.infer<typeof AlertFiltersSchema>;
