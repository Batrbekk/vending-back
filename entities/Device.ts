import mongoose, { Schema, Model, HydratedDocument } from 'mongoose';
import { IDevice } from '@/types';
import { randomBytes } from 'crypto';

// Enum для статуса подключения устройства
export enum DeviceConnectionStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  UNKNOWN = 'unknown'
}

// Methods that live on the hydrated document
interface DeviceMethods {
  generateApiKey(): string;
  updateHeartbeat(): Promise<DeviceDocument>;
  updateFirmware(version: string): Promise<DeviceDocument>;
  regenerateApiKey(): Promise<string>;
  getConnectionStatus(): DeviceConnectionStatus;
}

// Virtuals that are exposed on the hydrated document
interface DeviceVirtuals {
  isOnline: boolean;
  lastSeenMinutesAgo: number | null;
  machine?: {
    _id: mongoose.Types.ObjectId;
    machineId: string;
    [key: string]: unknown;
  };
}

// Updated DeviceDocument type to match Mongoose's expectations
export type DeviceDocument = HydratedDocument<IDevice, DeviceMethods & DeviceVirtuals>;

export interface DeviceModel extends Model<IDevice, object, DeviceMethods, DeviceVirtuals> {
  findByApiKey(apiKey: string): Promise<DeviceDocument | null>;
  findOnlineDevices(): Promise<DeviceDocument[]>;
  findOfflineDevices(timeoutMinutes?: number): Promise<DeviceDocument[]>;
  getConnectionStats(): Promise<{
    totalDevices: number;
    online: number;
    recentlyOffline: number;
    longOffline: number;
    onlinePercentage: number;
  }>;
  createForMachine(machineId: mongoose.Types.ObjectId, firmwareVersion?: string): Promise<DeviceDocument>;
}

const DeviceSchema = new Schema<IDevice, DeviceModel, DeviceMethods, object, DeviceVirtuals>({
  machineId: {
    type: Schema.Types.ObjectId,
    ref: 'VendingMachine',
    required: [true, 'ID автомата обязателен'],
    unique: true // Одно устройство на автомат
  },
  apiKey: {
    type: String,
    required: [true, 'API ключ обязателен'],
    unique: true,
    minlength: [32, 'API ключ должен содержать минимум 32 символа']
  },
  firmwareVersion: {
    type: String,
    trim: true,
    validate: {
      validator: function(v: string) {
        return !v || /^\d+\.\d+\.\d+$/.test(v);
      },
      message: 'Версия прошивки должна быть в формате x.y.z'
    }
  },
  lastHeartbeatAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  versionKey: false
});

// Генерация API ключа перед сохранением
DeviceSchema.pre('save', function(next) {
  if (this.isNew && !this.apiKey) {
    this.apiKey = this.generateApiKey();
  }
  next();
});

// Индексы
DeviceSchema.index({ lastHeartbeatAt: -1 });
DeviceSchema.index({ machineId: 1 });

// Виртуальные поля
DeviceSchema.virtual('machine', {
  ref: 'VendingMachine',
  localField: 'machineId',
  foreignField: '_id',
  justOne: true
});

DeviceSchema.virtual('isOnline').get(function(this: DeviceDocument): boolean {
  if (!this.lastHeartbeatAt) return false;
  
  // Считаем устройство онлайн если последний heartbeat был менее 10 минут назад
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  return this.lastHeartbeatAt > tenMinutesAgo;
});

DeviceSchema.virtual('lastSeenMinutesAgo').get(function(this: DeviceDocument): number | null {
  if (!this.lastHeartbeatAt) return null;
  return Math.floor((Date.now() - this.lastHeartbeatAt.getTime()) / (1000 * 60));
});

// Методы экземпляра
DeviceSchema.methods.generateApiKey = function(): string {
  return randomBytes(32).toString('hex');
};

DeviceSchema.methods.updateHeartbeat = function(): Promise<DeviceDocument> {
  this.lastHeartbeatAt = new Date();
  return this.save();
};

DeviceSchema.methods.updateFirmware = function(version: string): Promise<DeviceDocument> {
  // Проверяем формат версии
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error('Некорректный формат версии прошивки. Ожидается формат x.y.z');
  }
  
  this.firmwareVersion = version;
  return this.save();
};

DeviceSchema.methods.regenerateApiKey = async function(): Promise<string> {
  this.apiKey = this.generateApiKey();
  await this.save();
  return this.apiKey;
};

DeviceSchema.methods.getConnectionStatus = function(): DeviceConnectionStatus {
  if (!this.lastHeartbeatAt) return DeviceConnectionStatus.UNKNOWN;
  return this.isOnline ? DeviceConnectionStatus.ONLINE : DeviceConnectionStatus.OFFLINE;
};

// Статические методы
DeviceSchema.statics.findByApiKey = function(this: DeviceModel, apiKey: string): Promise<DeviceDocument | null> {
  if (!apiKey || apiKey.length < 32) {
    return Promise.resolve(null);
  }
  return this.findOne({ apiKey }).populate('machine') as Promise<DeviceDocument | null>;
};

DeviceSchema.statics.findOnlineDevices = function(this: DeviceModel): Promise<DeviceDocument[]> {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  return this.find({
    lastHeartbeatAt: { $gte: tenMinutesAgo }
  }).populate('machine') as Promise<DeviceDocument[]>;
};

DeviceSchema.statics.findOfflineDevices = function(this: DeviceModel, timeoutMinutes: number = 30): Promise<DeviceDocument[]> {
  const cutoffTime = new Date(Date.now() - timeoutMinutes * 60 * 1000);
  return this.find({
    $or: [
      { lastHeartbeatAt: { $lt: cutoffTime } },
      { lastHeartbeatAt: { $exists: false } },
      { lastHeartbeatAt: null }
    ]
  }).populate('machine') as Promise<DeviceDocument[]>;
};

DeviceSchema.statics.getConnectionStats = async function(this: DeviceModel) {
  const now = new Date();
  const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
  const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

  const result = await this.aggregate([
    {
      $group: {
        _id: null,
        totalDevices: { $sum: 1 },
        online: {
          $sum: {
            $cond: [
              { 
                $and: [
                  { $ne: ['$lastHeartbeatAt', null] },
                  { $gte: ['$lastHeartbeatAt', tenMinutesAgo] }
                ]
              },
              1,
              0
            ]
          }
        },
        recentlyOffline: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ['$lastHeartbeatAt', null] },
                  { $lt: ['$lastHeartbeatAt', tenMinutesAgo] },
                  { $gte: ['$lastHeartbeatAt', thirtyMinutesAgo] }
                ]
              },
              1,
              0
            ]
          }
        },
        longOffline: {
          $sum: {
            $cond: [
              {
                $or: [
                  { $eq: ['$lastHeartbeatAt', null] },
                  { $lt: ['$lastHeartbeatAt', thirtyMinutesAgo] }
                ]
              },
              1,
              0
            ]
          }
        }
      }
    },
    {
      $addFields: {
        onlinePercentage: {
          $cond: [
            { $eq: ['$totalDevices', 0] },
            0,
            {
              $multiply: [
                { $divide: ['$online', '$totalDevices'] },
                100
              ]
            }
          ]
        }
      }
    }
  ]);

  return result[0] || {
    totalDevices: 0,
    online: 0,
    recentlyOffline: 0,
    longOffline: 0,
    onlinePercentage: 0
  };
};

DeviceSchema.statics.createForMachine = function(
  this: DeviceModel,
  machineId: mongoose.Types.ObjectId, 
  firmwareVersion?: string
): Promise<DeviceDocument> {
  const deviceData: Partial<IDevice> = { 
    machineId,
    apiKey: randomBytes(32).toString('hex') // Явно генерируем API ключ
  };
  if (firmwareVersion) {
    // Валидируем формат версии перед созданием
    if (!/^\d+\.\d+\.\d+$/.test(firmwareVersion)) {
      return Promise.reject(new Error('Некорректный формат версии прошивки. Ожидается формат x.y.z'));
    }
    deviceData.firmwareVersion = firmwareVersion;
  }
  
  return this.create(deviceData) as Promise<DeviceDocument>;
};

export const Device = (mongoose.models.Device as DeviceModel) || 
  mongoose.model<IDevice, DeviceModel>('Device', DeviceSchema);
