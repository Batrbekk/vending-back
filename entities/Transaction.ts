import mongoose, { Schema, Document, Model } from 'mongoose';
import { PaymentMethod } from '@/types';

export interface ITransactionItem {
  productId: string;
  sku: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
}

export interface ITransaction {
  _id?: mongoose.Types.ObjectId;
  machineId: mongoose.Types.ObjectId;
  receiptNumber: number;
  orderNumber: number;
  items: ITransactionItem[];
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paidAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TransactionDocument extends Omit<ITransaction, '_id'>, Document {}

export interface TransactionModel extends Model<TransactionDocument> {
  getNextReceiptNumber(machineId: mongoose.Types.ObjectId): Promise<number>;
  getNextOrderNumber(): Promise<number>;
}

const TransactionItemSchema = new Schema<ITransactionItem>({
  productId: {
    type: String,
    required: true
  },
  sku: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  subtotal: {
    type: Number,
    required: true,
    min: 0
  }
}, { _id: false });

const TransactionSchema = new Schema<TransactionDocument>({
  machineId: {
    type: Schema.Types.ObjectId,
    ref: 'VendingMachine',
    required: true
  },
  receiptNumber: {
    type: Number,
    required: true
  },
  orderNumber: {
    type: Number,
    required: true
  },
  items: {
    type: [TransactionItemSchema],
    required: true,
    validate: {
      validator: (items: ITransactionItem[]) => items.length > 0,
      message: 'Transaction must have at least one item'
    }
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  paymentMethod: {
    type: String,
    enum: Object.values(PaymentMethod),
    required: true
  },
  paidAt: {
    type: Date,
    required: true
  }
}, {
  timestamps: true,
  versionKey: false
});

// Индексы
TransactionSchema.index({ machineId: 1, paidAt: -1 });
TransactionSchema.index({ receiptNumber: 1, machineId: 1 }, { unique: true });
TransactionSchema.index({ orderNumber: 1 }, { unique: true });

// Статические методы
TransactionSchema.statics.getNextReceiptNumber = async function(machineId: mongoose.Types.ObjectId): Promise<number> {
  const lastTransaction = await this.findOne({ machineId }).sort({ receiptNumber: -1 });
  return lastTransaction ? lastTransaction.receiptNumber + 1 : 1;
};

TransactionSchema.statics.getNextOrderNumber = async function(): Promise<number> {
  const lastTransaction = await this.findOne({}).sort({ orderNumber: -1 });
  return lastTransaction ? lastTransaction.orderNumber + 1 : 100;
};

export const Transaction = (mongoose.models.Transaction || mongoose.model<TransactionDocument, TransactionModel>('Transaction', TransactionSchema)) as TransactionModel;
