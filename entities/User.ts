import mongoose, { Schema, Document, Model } from 'mongoose';
import { IUser, UserRole } from '@/types';

export interface UserDocument extends Omit<IUser, '_id'>, Document {}

export interface UserModel extends Model<UserDocument> {
  findByEmail(email: string): Promise<UserDocument | null>;
  findActiveManagers(): Promise<UserDocument[]>;
}

const UserSchema = new Schema<UserDocument>({
  email: {
    type: String,
    required: [true, 'Email обязателен'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Некорректный email']
  },
  passwordHash: {
    type: String,
    required: [true, 'Пароль обязателен'],
    minlength: 6
  },
  name: {
    type: String,
    required: [true, 'Имя обязательно'],
    trim: true,
    maxlength: 100
  },
  role: {
    type: String,
    enum: Object.values(UserRole),
    required: [true, 'Роль обязательна'],
    default: UserRole.MANAGER
  },
  phone: {
    type: String,
    trim: true,
    match: [/^\+?[1-9]\d{10,14}$/, 'Некорректный номер телефона']
  },
  avatar: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  versionKey: false
});

// Индексы для производительности
// UserSchema.index({ email: 1 }); // Удалено - дублирует unique: true
UserSchema.index({ role: 1, isActive: 1 });

// Методы экземпляра
UserSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.passwordHash;
  return user;
};

UserSchema.methods.isAdmin = function(): boolean {
  return this.role === UserRole.ADMIN;
};

UserSchema.methods.isManager = function(): boolean {
  return this.role === UserRole.MANAGER;
};

// Статические методы
UserSchema.statics.findActiveManagers = function() {
  return this.find({ role: UserRole.MANAGER, isActive: true });
};

UserSchema.statics.findByEmail = function(email: string) {
  return this.findOne({ email: email.toLowerCase(), isActive: true });
};

export const User = (mongoose.models.User || mongoose.model<UserDocument, UserModel>('User', UserSchema)) as UserModel;
