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
  // slot-keyed map: { "row-column": productId }. Один слот — один продукт,
  // но один продукт может занимать несколько слотов.
  slotAssignments?: Record<string, string>;
  setSlotAssignments(assignments: Record<string, string>): void;
  getSlotAssignments(): Record<string, string>;
  getProductSlots(productId: string): { row: number; column: number }[];
  // Остаток по физическим слотам — 0..5 банок в каждом.
  slotStock?: Record<string, number>;
  getSlotStock(): Record<string, number>;
  getProductQuantity(productId: string): number;
  fillAllSlotsToMax(): void;
  /**
   * Атомарно резервирует и декрементирует слоты для заказа по productId × qty.
   * Возвращает массив физических позиций В ПОРЯДКЕ списания, ИЛИ null если
   * остатка недостаточно. Не сохраняет — нужно вызвать .save() выше.
   */
  allocateForOrder(
    plan: Array<{ productId: string; quantity: number }>
  ): Array<{ productId: string; row: number; column: number }> | null;
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
  // Слот-keyed карта: { "row-column": productId }. Сетка 6×6 = 36 слотов,
  // в каждом помещается 5 банок одного вкуса. Один слот максимум один
  // продукт, но один продукт может занимать сколько угодно слотов.
  // Заполняется из админки и отдаётся планшету, чтобы при покупке выдача
  // шла из правильного физического гнезда.
  slotAssignments: {
    type: Schema.Types.Mixed,
    default: {},
    validate: {
      validator: function(assignments: Record<string, string>) {
        for (const [key, productId] of Object.entries(assignments)) {
          // 5 рядов × 6 колонок — физическая сетка автомата.
          if (!/^[1-5]-[1-6]$/.test(key)) return false;
          if (typeof productId !== 'string' || !productId) return false;
        }
        return true;
      },
      message: 'Ключи слотов должны быть формата row-column (row 1..5, col 1..6)'
    }
  },
  // Остаток по физическим слотам: { "row-column": 0..5 }. Это ИСТОЧНИК ПРАВДЫ
  // по остатку — сумма slotStock = machine.stock. Поле productStock оставлено
  // как deprecated-зеркало для обратной совместимости старых отчётов, но
  // авторитет теперь у slotStock. При выдаче декрементируем именно этот слот,
  // когда счётчик гнезда дошёл до 0 — пружина пустая, переходим к следующему.
  slotStock: {
    type: Schema.Types.Mixed,
    default: {},
    validate: {
      validator: function(stock: Record<string, number>) {
        for (const [key, qty] of Object.entries(stock)) {
          if (!/^[1-5]-[1-6]$/.test(key)) return false;
          if (typeof qty !== 'number' || qty < 0 || qty > 5 || !Number.isInteger(qty)) return false;
        }
        return true;
      },
      message: 'slotStock: ключи row-column, значения 0..5'
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
  },
  cannectStationId: {
    type: String,
    trim: true,
    index: true
  },
  displayName: {
    type: String,
    trim: true,
    maxlength: 120
  }
}, {
  timestamps: true,
  versionKey: false,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Согласование stock + slotStock + slotAssignments перед сохранением.
// Источник правды — slotStock (per-slot 0..5). productStock остаётся как
// производное зеркало (сумма slot-стоков по ключу productId) — нужно для
// старых отчётов, читающих machine.productStock.
VendingMachineSchema.pre('save', async function(next) {
  try {
    const assignments = (this.slotAssignments as Record<string, string>) || {};
    const slotStockObj = ((this.slotStock as Record<string, number>) || {}) as Record<string, number>;

    // 1) Дропаем slotStock-ключи, для которых нет assignment — нельзя хранить
    // остаток у слота, на который не назначен продукт.
    for (const key of Object.keys(slotStockObj)) {
      if (!assignments[key]) delete slotStockObj[key];
    }
    // 2) Для каждого назначенного слота — если в slotStock нет ключа,
    // ставим 0 (новый слот всегда пустой; заполнить надо явно через refillAll).
    for (const key of Object.keys(assignments)) {
      if (typeof slotStockObj[key] !== 'number') slotStockObj[key] = 0;
    }
    this.slotStock = slotStockObj;
    this.markModified('slotStock');

    // 3) Производный productStock: для каждого productId сумма стока слотов,
    // которые ему назначены. Полностью пересчитываем, не аддитивно.
    const productStock: Record<string, number> = {};
    for (const [key, pid] of Object.entries(assignments)) {
      const qty = slotStockObj[key] ?? 0;
      productStock[pid] = (productStock[pid] ?? 0) + qty;
    }
    this.productStock = productStock;
    this.markModified('productStock');

    // 4) machine.stock — сумма slotStock (== сумма productStock, но считаем из slot).
    const totalStock = Object.values(slotStockObj).reduce((a, b) => a + b, 0);
    this.stock = totalStock;

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
  this.markModified('productStock'); // Помечаем как измененное для Mongoose
  this.updateStatus();
  return this.productStock[productId] - oldStock; // Фактически добавлено
};

VendingMachineSchema.methods.reduceStock = function(productId: string, amount: number): boolean {
  const currentStock = this.productStock[productId] || 0;
  if (currentStock >= amount) {
    this.productStock[productId] = currentStock - amount;
    this.markModified('productStock'); // Помечаем как измененное для Mongoose
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
  this.markModified('productStock'); // Помечаем как измененное для Mongoose
  this.updateStatus();
};

VendingMachineSchema.methods.getTotalStock = function(): number {
  return Object.values(this.productStock as Record<string, number>).reduce((a: number, b: number) => a + b, 0);
};

VendingMachineSchema.methods.getProductStockObject = function(): Record<string, number> {
  return this.productStock;
};

// --- Slot assignments (slot → product, один продукт может занять несколько слотов) ---

VendingMachineSchema.methods.setSlotAssignments = function(assignments: Record<string, string>): void {
  this.slotAssignments = assignments ?? {};
  this.markModified('slotAssignments');
};

VendingMachineSchema.methods.getSlotAssignments = function(): Record<string, string> {
  return (this.slotAssignments as Record<string, string>) || {};
};

// Все слоты, в которых лежит данный продукт.
// Возвращает позиции, отсортированные по row, потом column — детерминированный
// порядок нужен планшету, чтобы выдавать круг за кругом по одному слоту до его
// опустошения, потом переходить к следующему.
VendingMachineSchema.methods.getProductSlots = function(productId: string): { row: number; column: number }[] {
  const all = (this.slotAssignments as Record<string, string>) || {};
  const out: { row: number; column: number }[] = [];
  for (const [key, pid] of Object.entries(all)) {
    if (pid !== productId) continue;
    const [r, c] = key.split('-').map(Number);
    if (Number.isInteger(r) && Number.isInteger(c)) {
      out.push({ row: r, column: c });
    }
  }
  out.sort((a, b) => (a.row - b.row) || (a.column - b.column));
  return out;
};

// --- slotStock: per-slot 0..5 — источник правды по остатку ---

VendingMachineSchema.methods.getSlotStock = function(): Record<string, number> {
  return (this.slotStock as Record<string, number>) || {};
};

VendingMachineSchema.methods.getProductQuantity = function(productId: string): number {
  const slots = (this as VendingMachineDocument).getProductSlots(productId);
  const stock = (this.slotStock as Record<string, number>) || {};
  let total = 0;
  for (const s of slots) {
    total += stock[`${s.row}-${s.column}`] ?? 0;
  }
  return total;
};

// Залить ВСЕ назначенные слоты до 5. Используется кнопкой «Заполнить всё» в админке.
VendingMachineSchema.methods.fillAllSlotsToMax = function(): void {
  const assignments = (this.slotAssignments as Record<string, string>) || {};
  const stock = ((this.slotStock as Record<string, number>) || {}) as Record<string, number>;
  for (const key of Object.keys(assignments)) {
    stock[key] = 5;
  }
  this.slotStock = stock;
  this.markModified('slotStock');
};

// Резервируем слоты под заказ. Жадно проходим по slot-листу продукта в порядке
// (row, column): пока в текущем слоте есть остаток — декрементируем его. Когда
// текущий слот опустел, переходим к следующему. Возвращаем массив физических
// позиций (по одной на каждую банку) ровно в порядке списания.
VendingMachineSchema.methods.allocateForOrder = function(
  plan: Array<{ productId: string; quantity: number }>
): Array<{ productId: string; row: number; column: number }> | null {
  const stock = ((this.slotStock as Record<string, number>) || {}) as Record<string, number>;
  const dispense: Array<{ productId: string; row: number; column: number }> = [];

  for (const item of plan) {
    const slots = (this as VendingMachineDocument).getProductSlots(item.productId);
    if (slots.length === 0) return null;

    let need = item.quantity;
    for (const slot of slots) {
      const key = `${slot.row}-${slot.column}`;
      const have = stock[key] ?? 0;
      const take = Math.min(have, need);
      for (let i = 0; i < take; i++) {
        dispense.push({ productId: item.productId, row: slot.row, column: slot.column });
      }
      stock[key] = have - take;
      need -= take;
      if (need === 0) break;
    }
    if (need > 0) return null; // не хватило банок суммарно по продукту
  }

  this.slotStock = stock;
  this.markModified('slotStock');
  return dispense;
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
