import mongoose, { Schema, Document, Model } from 'mongoose';

export enum PairingStatus {
  PENDING = 'PENDING',
  USED = 'USED',
  EXPIRED = 'EXPIRED'
}

export interface PairingCodeDocument extends Document {
  machineId: mongoose.Types.ObjectId;
  code: string; // шестизначный
  expiresAt: Date;
  usedAt?: Date;
  usedByDeviceId?: mongoose.Types.ObjectId;
  status: PairingStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface PairingCodeModel extends Model<PairingCodeDocument> {
  generateForMachine(machineId: mongoose.Types.ObjectId, ttlMs?: number): Promise<PairingCodeDocument>;
  verifyCode(code: string): Promise<PairingCodeDocument | null>;
}

const PairingCodeSchema = new Schema<PairingCodeDocument>({
  machineId: { type: Schema.Types.ObjectId, ref: 'VendingMachine', required: true, index: true },
  code: { type: String, required: true, index: true },
  expiresAt: { type: Date, required: true, index: true },
  usedAt: { type: Date },
  usedByDeviceId: { type: Schema.Types.ObjectId, ref: 'Device' },
  status: { type: String, enum: Object.values(PairingStatus), default: PairingStatus.PENDING, index: true }
}, {
  timestamps: true,
  versionKey: false
});

// Генерация 6-значного кода (с ведущими нулями)
function randomCode(): string {
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
}

PairingCodeSchema.statics.generateForMachine = async function(machineId: mongoose.Types.ObjectId, ttlMs: number = 5 * 60 * 1000) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);

  // Помечаем старые активные коды как EXPIRED
  await this.updateMany({ machineId, status: PairingStatus.PENDING, expiresAt: { $lt: new Date(now.getTime()) } }, { $set: { status: PairingStatus.EXPIRED } });

  // Создаем новый код и гарантируем уникальность кода среди активных
  let code = randomCode();
  // Пытаемся несколько раз, чтобы избежать коллизий
  for (let i = 0; i < 5; i++) {
    const exists = await this.findOne({ code, status: PairingStatus.PENDING, expiresAt: { $gt: now } });
    if (!exists) break;
    code = randomCode();
  }

  return this.create({ machineId, code, expiresAt, status: PairingStatus.PENDING });
};

PairingCodeSchema.statics.verifyCode = async function(code: string) {
  const now = new Date();
  const doc = await this.findOne({ code, status: PairingStatus.PENDING, expiresAt: { $gt: now } });
  return doc || null;
};

if (mongoose.models.PairingCode) {
  delete mongoose.models.PairingCode;
}

export const PairingCode = mongoose.model<PairingCodeDocument, PairingCodeModel>('PairingCode', PairingCodeSchema);
