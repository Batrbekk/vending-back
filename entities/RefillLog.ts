import mongoose, { Schema, Document } from 'mongoose';
import { IRefillLog } from '@/types';

export interface RefillLogDocument extends Omit<IRefillLog, '_id'>, Document {}

const RefillLogSchema = new Schema<RefillLogDocument>({
  machineId: {
    type: Schema.Types.ObjectId,
    ref: 'VendingMachine',
    required: [true, 'ID автомата обязателен']
  },
  managerId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'ID менеджера обязателен']
  },
  startedAt: {
    type: Date,
    required: [true, 'Время начала обязательно']
  },
  finishedAt: {
    type: Date,
    required: [true, 'Время окончания обязательно']
  },
  before: {
    type: Number,
    required: [true, 'Остаток до пополнения обязателен'],
    min: [0, 'Остаток не может быть отрицательным']
  },
  added: {
    type: Number,
    required: [true, 'Количество добавленных банок обязательно'],
    min: [1, 'Должна быть добавлена минимум 1 банка']
  },
  after: {
    type: Number,
    required: [true, 'Остаток после пополнения обязателен'],
    min: [0, 'Остаток не может быть отрицательным']
  },
  comment: {
    type: String,
    maxlength: 500
  }
}, {
  timestamps: false,
  versionKey: false
});

// Валидация логики пополнения
RefillLogSchema.pre('save', function(next) {
  // Проверяем что finishedAt больше startedAt
  if (this.finishedAt <= this.startedAt) {
    return next(new Error('Время окончания должно быть больше времени начала'));
  }
  
  // Проверяем логику: after = before + added (с учетом ограничения по capacity)
  if (this.after < this.before) {
    return next(new Error('Остаток после не может быть меньше остатка до пополнения'));
  }
  
  // Рассчитанное добавление не должно быть больше заявленного
  const actualAdded = this.after - this.before;
  if (actualAdded > this.added) {
    return next(new Error('Фактически добавлено больше заявленного количества'));
  }
  
  next();
});

// Индексы для производительности
RefillLogSchema.index({ machineId: 1, finishedAt: -1 });
RefillLogSchema.index({ managerId: 1, finishedAt: -1 });
RefillLogSchema.index({ startedAt: 1, finishedAt: 1 });

// Виртуальные поля
RefillLogSchema.virtual('machine', {
  ref: 'VendingMachine',
  localField: 'machineId',
  foreignField: '_id',
  justOne: true
});

RefillLogSchema.virtual('manager', {
  ref: 'User',
  localField: 'managerId',
  foreignField: '_id',
  justOne: true
});

RefillLogSchema.virtual('duration').get(function() {
  return this.finishedAt.getTime() - this.startedAt.getTime();
});

RefillLogSchema.virtual('actualAdded').get(function() {
  return this.after - this.before;
});

// Методы экземпляра
RefillLogSchema.methods.getDurationMinutes = function(): number {
  return Math.round(this.duration / (1000 * 60));
};

RefillLogSchema.methods.getEfficiency = function(): number {
  // Эффективность = фактически добавлено / заявлено * 100%
  return Math.round((this.actualAdded / this.added) * 100);
};

// Статические методы
RefillLogSchema.statics.getManagerStats = function(managerId: mongoose.Types.ObjectId, fromDate?: Date, toDate?: Date) {
  const matchConditions: Record<string, unknown> = { managerId };
  
  if (fromDate || toDate) {
    matchConditions.finishedAt = {};
    if (fromDate) (matchConditions.finishedAt as Record<string, unknown>).$gte = fromDate;
    if (toDate) (matchConditions.finishedAt as Record<string, unknown>).$lte = toDate;
  }

  return this.aggregate([
    { $match: matchConditions },
    {
      $group: {
        _id: '$managerId',
        totalRefills: { $sum: 1 },
        totalAdded: { $sum: '$added' },
        totalActualAdded: { $sum: { $subtract: ['$after', '$before'] } },
        avgDuration: { $avg: { $subtract: ['$finishedAt', '$startedAt'] } },
        avgEfficiency: { 
          $avg: { 
            $multiply: [
              { $divide: [{ $subtract: ['$after', '$before'] }, '$added'] },
              100
            ]
          }
        }
      }
    }
  ]);
};

RefillLogSchema.statics.getMachineRefillHistory = function(machineId: mongoose.Types.ObjectId, limit: number = 10) {
  return this.find({ machineId })
    .sort({ finishedAt: -1 })
    .limit(limit)
    .populate('manager', 'name email');
};

export const RefillLog = mongoose.models.RefillLog || mongoose.model<RefillLogDocument>('RefillLog', RefillLogSchema);
