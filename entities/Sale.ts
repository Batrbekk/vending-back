import mongoose, { Schema, Document, Model } from 'mongoose';
import { ISale, PaymentMethod } from '@/types';

export interface SaleDocument extends Omit<ISale, '_id'>, Document {}

export interface SaleModel extends Model<SaleDocument> {
  getSalesStats(fromDate?: Date, toDate?: Date, machineId?: mongoose.Types.ObjectId): Promise<unknown>;
  getTopProducts(limit?: number, fromDate?: Date, toDate?: Date): Promise<unknown>;
  getMachinePerformance(fromDate?: Date, toDate?: Date): Promise<unknown>;
  getDailySales(days?: number, machineId?: mongoose.Types.ObjectId, fromDate?: Date, toDate?: Date): Promise<unknown>;
}

const SaleSchema = new Schema<SaleDocument>({
  machineId: {
    type: Schema.Types.ObjectId,
    ref: 'VendingMachine',
    required: [true, 'ID автомата обязателен']
  },
  sku: {
    type: String,
    required: [true, 'Код товара обязателен'],
    trim: true,
    maxlength: 100
  },
  price: {
    type: Number,
    required: [true, 'Цена обязательна'],
    min: [0.01, 'Цена должна быть больше 0']
  },
  qty: {
    type: Number,
    required: [true, 'Количество обязательно'],
    min: [1, 'Количество должно быть больше 0'],
    validate: {
      validator: Number.isInteger,
      message: 'Количество должно быть целым числом'
    }
  },
  total: {
    type: Number,
    required: [true, 'Общая сумма обязательна'],
    min: [0.01, 'Общая сумма должна быть больше 0']
  },
  paidAt: {
    type: Date,
    required: [true, 'Время оплаты обязательно']
  },
  paymentMethod: {
    type: String,
    enum: Object.values(PaymentMethod)
  },
  receiptId: {
    type: String,
    trim: true
  }
}, {
  timestamps: true,
  versionKey: false
});

// Валидация total = price * qty
SaleSchema.pre('save', function(next) {
  const expectedTotal = this.price * this.qty;
  if (Math.abs(this.total - expectedTotal) > 0.01) {
    return next(new Error('Общая сумма не соответствует цене * количество'));
  }
  next();
});

// Индексы для производительности и аналитики
SaleSchema.index({ machineId: 1, paidAt: -1 });
SaleSchema.index({ paidAt: -1 });
SaleSchema.index({ sku: 1, paidAt: -1 });
SaleSchema.index({ total: -1 });

// Виртуальные поля
SaleSchema.virtual('machine', {
  ref: 'VendingMachine',
  localField: 'machineId',
  foreignField: '_id',
  justOne: true
});

// Методы экземпляра
SaleSchema.methods.getFormattedTotal = function(): string {
  return `${this.total.toFixed(2)} ₸`;
};

SaleSchema.methods.isToday = function(): boolean {
  const today = new Date();
  return this.paidAt.toDateString() === today.toDateString();
};

// Статические методы для аналитики
SaleSchema.statics.getSalesStats = function(fromDate?: Date, toDate?: Date, machineId?: mongoose.Types.ObjectId) {
  const matchConditions: Record<string, unknown> = {};
  
  if (fromDate || toDate) {
    matchConditions.paidAt = {};
    if (fromDate) (matchConditions.paidAt as Record<string, unknown>).$gte = fromDate;
    if (toDate) (matchConditions.paidAt as Record<string, unknown>).$lte = toDate;
  }
  
  if (machineId) {
    matchConditions.machineId = machineId;
  }

  return this.aggregate([
    { $match: matchConditions },
    {
      $group: {
        _id: null,
        totalSales: { $sum: 1 },
        totalRevenue: { $sum: '$total' },
        totalItems: { $sum: '$qty' },
        avgOrderValue: { $avg: '$total' },
        uniqueMachines: { $addToSet: '$machineId' }
      }
    },
    {
      $addFields: {
        uniqueMachinesCount: { $size: '$uniqueMachines' }
      }
    },
    {
      $project: {
        uniqueMachines: 0
      }
    }
  ]);
};

SaleSchema.statics.getTopProducts = function(limit: number = 10, fromDate?: Date, toDate?: Date) {
  const matchConditions: Record<string, unknown> = {};
  
  if (fromDate || toDate) {
    matchConditions.paidAt = {};
    if (fromDate) (matchConditions.paidAt as Record<string, unknown>).$gte = fromDate;
    if (toDate) (matchConditions.paidAt as Record<string, unknown>).$lte = toDate;
  }

  return this.aggregate([
    { $match: matchConditions },
    {
      $group: {
        _id: '$sku',
        totalSold: { $sum: '$qty' },
        totalRevenue: { $sum: '$total' },
        salesCount: { $sum: 1 },
        avgPrice: { $avg: '$price' }
      }
    },
    { $sort: { totalSold: -1 } },
    { $limit: limit }
  ]);
};

SaleSchema.statics.getMachinePerformance = function(fromDate?: Date, toDate?: Date) {
  const matchConditions: Record<string, unknown> = {};
  
  if (fromDate || toDate) {
    matchConditions.paidAt = {};
    if (fromDate) (matchConditions.paidAt as Record<string, unknown>).$gte = fromDate;
    if (toDate) (matchConditions.paidAt as Record<string, unknown>).$lte = toDate;
  }

  return this.aggregate([
    { $match: matchConditions },
    {
      $group: {
        _id: '$machineId',
        totalSales: { $sum: 1 },
        totalRevenue: { $sum: '$total' },
        totalItems: { $sum: '$qty' },
        avgOrderValue: { $avg: '$total' },
        lastSale: { $max: '$paidAt' }
      }
    },
    { $sort: { totalRevenue: -1 } },
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

SaleSchema.statics.getDailySales = async function(days: number = 30, machineId?: mongoose.Types.ObjectId, fromDate?: Date, toDate?: Date) {
  const matchConditions: Record<string, unknown> = {};
  
  // Если переданы конкретные даты, используем их
  if (fromDate || toDate) {
    matchConditions.paidAt = {};
    if (fromDate) (matchConditions.paidAt as Record<string, unknown>).$gte = fromDate;
    if (toDate) (matchConditions.paidAt as Record<string, unknown>).$lte = toDate;
  } else {
    // Иначе используем количество дней от текущей даты
    const calculatedFromDate = new Date();
    calculatedFromDate.setDate(calculatedFromDate.getDate() - days);
    matchConditions.paidAt = { $gte: calculatedFromDate };
  }
  
  if (machineId) matchConditions.machineId = machineId;

  // Временное логирование для отладки
  console.log('🔍 Match conditions:', matchConditions);
  
  // Проверим общее количество записей
  const totalCount = await this.countDocuments(matchConditions);
  console.log('🔍 Total sales in range:', totalCount);
  
  // Проверим все даты в диапазоне
  const allSales = await this.find(matchConditions).select('paidAt').lean();
  const uniqueDates = [...new Set(allSales.map(s => new Date(s.paidAt).toISOString().split('T')[0]))];
  console.log('🔍 Unique dates found:', uniqueDates);

  const result = await this.aggregate([
    { $match: matchConditions },
    {
      $group: {
        _id: {
          year: { $year: '$paidAt' },
          month: { $month: '$paidAt' },
          day: { $dayOfMonth: '$paidAt' }
        },
        date: { $first: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt' } } },
        totalSales: { $sum: 1 },
        totalRevenue: { $sum: '$total' },
        totalItems: { $sum: '$qty' }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
  ]);
  
  console.log('🔍 Aggregation result:', result);
  return result;
};

export const Sale = (mongoose.models.Sale || mongoose.model<SaleDocument, SaleModel>('Sale', SaleSchema)) as SaleModel;
