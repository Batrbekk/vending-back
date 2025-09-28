import mongoose, { Schema, Document, Model } from 'mongoose';
import { IAlert, AlertType } from '@/types';

export interface AlertDocument extends Omit<IAlert, '_id'>, Document {
  resolve(userId: mongoose.Types.ObjectId, message?: string): Promise<AlertDocument>;
  getDurationHours(): number;
  getSeverityLevel(): 'low' | 'medium' | 'high' | 'critical';
  getDisplayMessage(): string;
  isResolved: boolean;
  duration: number;
}

export interface AlertModel extends Model<AlertDocument> {
  findUnresolved(): Promise<AlertDocument[]>;
  findByMachine(machineId: mongoose.Types.ObjectId, includeResolved?: boolean): Promise<AlertDocument[]>;
  createIfNotExists(machineId: mongoose.Types.ObjectId, type: AlertType, message?: string): Promise<AlertDocument>;
  getStatsByType(fromDate?: Date, toDate?: Date): Promise<unknown>;
  getMachineAlertFrequency(days?: number): Promise<unknown>;
}

const AlertSchema = new Schema<AlertDocument>({
  machineId: {
    type: Schema.Types.ObjectId,
    ref: 'VendingMachine',
    required: [true, 'ID автомата обязателен']
  },
  type: {
    type: String,
    enum: Object.values(AlertType),
    required: [true, 'Тип алерта обязателен']
  },
  message: {
    type: String,
    maxlength: 500
  },
  createdAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  resolvedAt: {
    type: Date
  },
  resolvedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: false, // Используем свои поля createdAt
  versionKey: false
});

// Валидация: resolvedAt должен быть больше createdAt
AlertSchema.pre('save', function(next) {
  if (this.resolvedAt && this.resolvedAt < this.createdAt) {
    return next(new Error('Время разрешения не может быть раньше времени создания'));
  }
  next();
});

// Индексы для производительности
AlertSchema.index({ machineId: 1, createdAt: -1 });
AlertSchema.index({ type: 1, resolvedAt: 1 });
AlertSchema.index({ createdAt: -1 });
AlertSchema.index({ resolvedAt: 1 }); // null для неразрешенных

// Виртуальные поля
AlertSchema.virtual('machine', {
  ref: 'VendingMachine',
  localField: 'machineId',
  foreignField: '_id',
  justOne: true
});

AlertSchema.virtual('resolver', {
  ref: 'User',
  localField: 'resolvedBy',
  foreignField: '_id',
  justOne: true
});

AlertSchema.virtual('isResolved').get(function() {
  return !!this.resolvedAt;
});

AlertSchema.virtual('duration').get(function() {
  const endTime = this.resolvedAt || new Date();
  return endTime.getTime() - this.createdAt.getTime();
});

// Методы экземпляра
AlertSchema.methods.resolve = function(userId: mongoose.Types.ObjectId, message?: string) {
  if (this.resolvedAt) {
    throw new Error('Алерт уже разрешен');
  }
  
  this.resolvedAt = new Date();
  this.resolvedBy = userId;
  
  if (message) {
    this.message = this.message ? `${this.message}\n\nРешение: ${message}` : `Решение: ${message}`;
  }
  
  return this.save();
};

AlertSchema.methods.getDurationHours = function(): number {
  return Math.round(this.duration / (1000 * 60 * 60));
};

AlertSchema.methods.getSeverityLevel = function(): 'low' | 'medium' | 'high' | 'critical' {
  switch (this.type) {
    case AlertType.OUT_OF_STOCK:
      return 'critical';
    case AlertType.LOW_STOCK:
      return 'high';
    case AlertType.ERROR:
      return 'medium';
    case AlertType.DRIFT:
      return 'low';
    default:
      return 'medium';
  }
};

AlertSchema.methods.getDisplayMessage = function(): string {
  const baseMessages = {
    [AlertType.LOW_STOCK]: 'Заканчиваются товары (менее 150 банок)',
    [AlertType.OUT_OF_STOCK]: 'Товары закончились',
    [AlertType.ERROR]: 'Ошибка работы автомата',
    [AlertType.DRIFT]: 'Расхождение в учете товаров'
  };
  
  return this.message || baseMessages[this.type as keyof typeof baseMessages] || 'Неизвестная проблема';
};

// Статические методы
AlertSchema.statics.findUnresolved = function() {
  return this.find({ resolvedAt: null })
    .sort({ createdAt: -1 })
    .populate('machine')
    .populate({
      path: 'machine',
      populate: {
        path: 'location',
        model: 'Location'
      }
    });
};

AlertSchema.statics.findByMachine = function(machineId: mongoose.Types.ObjectId, includeResolved: boolean = false) {
  const filter: Record<string, unknown> = { machineId };
  if (!includeResolved) {
    filter.resolvedAt = null;
  }
  
  return this.find(filter).sort({ createdAt: -1 });
};

AlertSchema.statics.createIfNotExists = function(machineId: mongoose.Types.ObjectId, type: AlertType, message?: string) {
  // Проверяем, есть ли активный алерт того же типа для этого автомата
  // Используем debounce - не создаем повторные алерты чаще чем раз в 30 минут
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
  
  return this.findOne({
    machineId,
    type,
    resolvedAt: null,
    createdAt: { $gte: thirtyMinutesAgo }
  }).then((existingAlert: AlertDocument | null) => {
    if (existingAlert) {
      return existingAlert; // Уже есть недавний алерт
    }
    
    return this.create({
      machineId,
      type,
      message,
      createdAt: new Date()
    });
  });
};

AlertSchema.statics.getStatsByType = function(fromDate?: Date, toDate?: Date) {
  const matchConditions: Record<string, unknown> = {};
  
  if (fromDate || toDate) {
    matchConditions.createdAt = {};
    if (fromDate) (matchConditions.createdAt as Record<string, unknown>).$gte = fromDate;
    if (toDate) (matchConditions.createdAt as Record<string, unknown>).$lte = toDate;
  }

  return this.aggregate([
    { $match: matchConditions },
    {
      $group: {
        _id: '$type',
        total: { $sum: 1 },
        resolved: {
          $sum: {
            $cond: [{ $ne: ['$resolvedAt', null] }, 1, 0]
          }
        },
        avgResolutionTime: {
          $avg: {
            $cond: [
              { $ne: ['$resolvedAt', null] },
              { $subtract: ['$resolvedAt', '$createdAt'] },
              null
            ]
          }
        }
      }
    },
    {
      $addFields: {
        unresolved: { $subtract: ['$total', '$resolved'] },
        resolutionRate: {
          $multiply: [
            { $divide: ['$resolved', '$total'] },
            100
          ]
        }
      }
    },
    { $sort: { total: -1 } }
  ]);
};

AlertSchema.statics.getMachineAlertFrequency = function(days: number = 30) {
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);

  return this.aggregate([
    { $match: { createdAt: { $gte: fromDate } } },
    {
      $group: {
        _id: '$machineId',
        alertCount: { $sum: 1 },
        types: { $addToSet: '$type' },
        lastAlert: { $max: '$createdAt' }
      }
    },
    { $sort: { alertCount: -1 } },
    {
      $lookup: {
        from: 'vendingmachines',
        localField: '_id',
        foreignField: '_id',
        as: 'machine'
      }
    },
    {
      $lookup: {
        from: 'locations',
        localField: 'machine.locationId',
        foreignField: '_id',
        as: 'location'
      }
    }
  ]);
};

export const Alert = (mongoose.models.Alert || mongoose.model<AlertDocument, AlertModel>('Alert', AlertSchema)) as AlertModel;
