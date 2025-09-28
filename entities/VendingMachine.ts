import mongoose, { Schema, Document, Model } from 'mongoose';
import { IVendingMachine, MachineStatus } from '@/types';
import { Product } from './Product';

export interface VendingMachineDocument extends Omit<IVendingMachine, '_id'>, Document {
  needsRefill(): boolean;
  isEmpty(): boolean;
  getStockPercentage(): number;
  canStartRefill(): boolean;
  updateStatus(): MachineStatus;
  addStock(productId: string, amount: number): number;
  reduceStock(productId: string, amount: number): boolean;
  getProductStock(productId: string): number;
  setProductStock(productId: string, amount: number): void;
  getTotalStock(): number;
  getProductStockObject(): Record<string, number>;
  location?: {
    _id: mongoose.Types.ObjectId;
    name: string;
    address: string;
    [key: string]: unknown;
  };
  assignedManager?: {
    _id: mongoose.Types.ObjectId;
    name: string;
    email: string;
    [key: string]: unknown;
  };
}

export interface VendingMachineModel extends Model<VendingMachineDocument> {
  findNeedingRefill(): Promise<VendingMachineDocument[]>;
  findByManager(managerId: mongoose.Types.ObjectId): Promise<VendingMachineDocument[]>;
  getStatusCounts(): Promise<unknown>;
}

const VendingMachineSchema = new Schema<VendingMachineDocument>({
  machineId: {
    type: String,
    required: [true, 'ID автомата обязателен'],
    unique: true,
    trim: true,
    uppercase: true,
    match: [/^[A-Z0-9-]{3,20}$/, 'ID должен содержать только буквы, цифры и дефисы']
  },
  locationId: {
    type: Schema.Types.ObjectId,
    ref: 'Location',
    required: [true, 'Локация обязательна']
  },
  capacity: {
    type: Number,
    required: true,
    default: 80,
    min: [1, 'Вместимость должна быть больше 0'],
    max: [1000, 'Максимальная вместимость 1000 банок']
  },
  stock: {
    type: Number,
    default: 0,
    min: [0, 'Остаток не может быть отрицательным']
  },
  productStock: {
    type: Schema.Types.Mixed,
    default: {},
    validate: {
      validator: function(stock: Record<string, number>) {
        for (const quantity of Object.values(stock)) {
          if (quantity < 0) return false;
        }
        return true;
      },
      message: 'Остатки продуктов не могут быть отрицательными'
    }
  },
  status: {
    type: String,
    enum: Object.values(MachineStatus),
    default: MachineStatus.UNPAIRED
  },
  assignedManagerId: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  lastServiceAt: {
    type: Date
  },
  lastTelemetryAt: {
    type: Date
  },
  notes: {
    type: String,
    maxlength: 1000
  }
}, {
  timestamps: true,
  versionKey: false,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Валидация productStock не должен превышать capacity
VendingMachineSchema.pre('save', async function(next) {
  try {
    // Если это новый документ и productStock пустой, автоматически заполняем его
    if (this.isNew && (!this.productStock || Object.keys(this.productStock).length === 0)) {
      // Получаем все доступные продукты
      const products = await Product.find({}).select('_id').lean();
      
      if (products.length > 0) {
        // Если stock указан, распределяем его между продуктами
        const stockToDistribute = this.stock || this.capacity;
        const stockPerProduct = Math.floor(stockToDistribute / products.length);
        const remainder = stockToDistribute % products.length;
        const productStock: Record<string, number> = {};
        
        products.forEach((product, index) => {
          const stock = stockPerProduct + (index < remainder ? 1 : 0);
          productStock[product._id.toString()] = stock;
        });
        
        this.productStock = productStock;
        this.stock = stockToDistribute;
      }
    }
    
    // Синхронизируем stock с productStock - stock всегда должен равняться сумме productStock
    const totalStock = Object.values(this.productStock as Record<string, number>).reduce((a: number, b: number) => a + b, 0);
    this.stock = totalStock;
    
    // Валидация: общий остаток не должен превышать вместимость
    if (this.stock > this.capacity) {
      return next(new Error('Остаток не может превышать вместимость автомата'));
    }
    
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Индексы
VendingMachineSchema.index({ status: 1 });
VendingMachineSchema.index({ locationId: 1 });
VendingMachineSchema.index({ assignedManagerId: 1 });

// Виртуальные поля
VendingMachineSchema.virtual('location', {
  ref: 'Location',
  localField: 'locationId',
  foreignField: '_id',
  justOne: true
});

VendingMachineSchema.virtual('assignedManager', {
  ref: 'User',
  localField: 'assignedManagerId',
  foreignField: '_id',
  justOne: true
});

// Методы экземпляра
VendingMachineSchema.methods.needsRefill = function(): boolean {
  const totalStock = Object.values(this.productStock as Record<string, number>).reduce((a: number, b: number) => a + b, 0);
  return totalStock < this.capacity * 0.5;
};

VendingMachineSchema.methods.isEmpty = function(): boolean {
  return Object.values(this.productStock).every(stock => stock === 0);
};

VendingMachineSchema.methods.getStockPercentage = function(): number {
  const totalStock = Object.values(this.productStock as Record<string, number>).reduce((a: number, b: number) => a + b, 0);
  return Math.round((totalStock / this.capacity) * 100);
};

VendingMachineSchema.methods.canStartRefill = function(): boolean {
  return this.status !== MachineStatus.IN_SERVICE && this.status !== MachineStatus.INACTIVE;
};

VendingMachineSchema.methods.updateStatus = function(): MachineStatus {
  // Не изменяем статус автоматически, если автомат деактивирован или не спарен
  if (this.status === MachineStatus.INACTIVE || this.status === MachineStatus.UNPAIRED) {
    return this.status;
  }
  const totalStock = Object.values(this.productStock as Record<string, number>).reduce((a: number, b: number) => a + b, 0);
  if (totalStock === 0) {
    this.status = MachineStatus.OUT_OF_STOCK;
  } else if (totalStock < this.capacity * 0.5) {
    this.status = MachineStatus.LOW_STOCK;
  } else if (this.status === MachineStatus.LOW_STOCK || this.status === MachineStatus.OUT_OF_STOCK) {
    this.status = MachineStatus.WORKING;
  }
  return this.status;
};

VendingMachineSchema.methods.addStock = function(productId: string, amount: number): number {
  const oldStock = this.productStock[productId] || 0;
  this.productStock[productId] = Math.min(oldStock + amount, this.capacity);
  this.updateStatus();
  return this.productStock[productId] - oldStock; // Фактически добавлено
};

VendingMachineSchema.methods.reduceStock = function(productId: string, amount: number): boolean {
  const currentStock = this.productStock[productId] || 0;
  if (currentStock >= amount) {
    this.productStock[productId] = currentStock - amount;
    this.updateStatus();
    return true;
  }
  return false;
};

VendingMachineSchema.methods.getProductStock = function(productId: string): number {
  return this.productStock[productId] || 0;
};

VendingMachineSchema.methods.setProductStock = function(productId: string, amount: number): void {
  this.productStock[productId] = amount;
  this.updateStatus();
};

VendingMachineSchema.methods.getTotalStock = function(): number {
  return Object.values(this.productStock as Record<string, number>).reduce((a: number, b: number) => a + b, 0);
};

VendingMachineSchema.methods.getProductStockObject = function(): Record<string, number> {
  return this.productStock;
};

// Статические методы
VendingMachineSchema.statics.findNeedingRefill = function() {
  return this.aggregate([
    {
      $match: {
        status: { $in: [MachineStatus.WORKING, MachineStatus.LOW_STOCK, MachineStatus.OUT_OF_STOCK] }
      }
    },
    {
      $addFields: {
        totalStock: {
          $sum: {
            $map: {
              input: { $objectToArray: '$productStock' },
              as: 'item',
              in: '$$item.v'
            }
          }
        },
        lowStockThreshold: { $multiply: ['$capacity', 0.5] }
      }
    },
    {
      $match: {
        $expr: { $lt: ['$totalStock', '$lowStockThreshold'] }
      }
    },
    {
      $lookup: {
        from: 'locations',
        localField: 'locationId',
        foreignField: '_id',
        as: 'location'
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'assignedManagerId',
        foreignField: '_id',
        as: 'assignedManager'
      }
    },
    {
      $unwind: { path: '$location', preserveNullAndEmptyArrays: true }
    },
    {
      $unwind: { path: '$assignedManager', preserveNullAndEmptyArrays: true }
    }
  ]);
};

VendingMachineSchema.statics.findByManager = function(managerId: mongoose.Types.ObjectId) {
  return this.find({ assignedManagerId: managerId }).populate('location');
};

VendingMachineSchema.statics.getStatusCounts = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
};

// В среде разработки/при hot-reload в Next.js модель может быть уже зарегистрирована
// с устаревшей схемой (например, без нового значения enum). Удаляем перед пересозданием,
// чтобы гарантировать актуальность схемы и списка enum-значений.
if (mongoose.models.VendingMachine) {
  delete mongoose.models.VendingMachine;
}

export const VendingMachine = mongoose.model<VendingMachineDocument, VendingMachineModel>(
  'VendingMachine',
  VendingMachineSchema
);
