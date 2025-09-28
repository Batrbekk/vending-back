import { Types } from 'mongoose';

// Enum для ролей пользователей
export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER'
}

// Enum для статусов автоматов
export enum MachineStatus {
  WORKING = 'WORKING',
  LOW_STOCK = 'LOW_STOCK',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
  IN_SERVICE = 'IN_SERVICE',
  ERROR = 'ERROR',
  INACTIVE = 'INACTIVE',
  UNPAIRED = 'UNPAIRED'
}

// Enum для типов алертов
export enum AlertType {
  LOW_STOCK = 'LOW_STOCK',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
  ERROR = 'ERROR',
  DRIFT = 'DRIFT'
}

// Enum для способов оплаты
export enum PaymentMethod {
  CARD = 'CARD',
  CASH = 'CASH',
  ONLINE = 'ONLINE'
}

// Базовые интерфейсы
export interface IUser {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  phone?: string;
  avatar?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ILocation {
  _id: Types.ObjectId;
  name: string;
  address: string;
  geo?: {
    lat: number;
    lng: number;
  };
  timezone?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IVendingMachine {
  _id: Types.ObjectId;
  machineId: string;
  locationId: Types.ObjectId;
  capacity: number;
  stock: number;
  status: MachineStatus;
  assignedManagerId?: Types.ObjectId;
  lastServiceAt?: Date;
  lastTelemetryAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRefillLog {
  _id: Types.ObjectId;
  machineId: Types.ObjectId;
  managerId: Types.ObjectId;
  startedAt: Date;
  finishedAt: Date;
  before: number;
  added: number;
  after: number;
  comment?: string;
}

export interface ISale {
  _id: Types.ObjectId;
  machineId: Types.ObjectId;
  sku: string;
  price: number;
  qty: number;
  total: number;
  paidAt: Date;
  paymentMethod?: PaymentMethod;
  receiptId?: string;
}

export interface IAlert {
  _id: Types.ObjectId;
  machineId: Types.ObjectId;
  type: AlertType;
  message?: string;
  createdAt: Date;
  resolvedAt?: Date;
  resolvedBy?: Types.ObjectId;
}

export interface IDevice {
  _id: Types.ObjectId;
  machineId: Types.ObjectId;
  apiKey: string;
  firmwareVersion?: string;
  lastHeartbeatAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// API типы
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: Omit<IUser, 'passwordHash'>;
}

export interface UpdateProfileRequest {
  name?: string;
  email?: string;
  phone?: string;
  avatar?: string;
}

export interface UpdateProfileResponse {
  success: boolean;
  data: {
    user: Omit<IUser, 'passwordHash'>;
  };
}

export interface RefillStartRequest {
  managerId: Types.ObjectId;
}

export interface RefillFinishRequest {
  added: number;
  comment?: string;
}

export interface SaleCreateRequest {
  sku: string;
  price: number;
  qty: number;
  paymentMethod?: PaymentMethod;
  receiptId?: string;
}

export interface TelemetryRequest {
  stock?: number;
  errorCode?: string;
  temperature?: number;
}

// WebSocket события
export interface SocketEvents {
  'stock.updated': {
    machineId: Types.ObjectId;
    oldStock: number;
    newStock: number;
  };
  'status.changed': {
    machineId: Types.ObjectId;
    oldStatus: MachineStatus;
    newStatus: MachineStatus;
  };
  'refill.started': {
    machineId: Types.ObjectId;
    managerId: Types.ObjectId;
  };
  'refill.finished': {
    machineId: Types.ObjectId;
    managerId: Types.ObjectId;
    added: number;
  };
  'alert.created': {
    alertId: Types.ObjectId;
    machineId: Types.ObjectId;
    type: AlertType;
  };
  'sale.created': {
    saleId: Types.ObjectId;
    machineId: Types.ObjectId;
    total: number;
  };
}
