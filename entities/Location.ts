import mongoose, { Schema, Document } from 'mongoose';
import { ILocation } from '@/types';

export interface LocationDocument extends Omit<ILocation, '_id'>, Document {}

const LocationSchema = new Schema<LocationDocument>({
  name: {
    type: String,
    required: [true, 'Название локации обязательно'],
    trim: true,
    maxlength: 200
  },
  address: {
    type: String,
    required: [true, 'Адрес обязателен'],
    trim: true,
    maxlength: 500
  },
  geo: {
    lat: {
      type: Number,
      min: -90,
      max: 90
    },
    lng: {
      type: Number,
      min: -180,
      max: 180
    }
  },
  timezone: {
    type: String,
    default: 'Asia/Almaty'
  }
}, {
  timestamps: true,
  versionKey: false
});

// Индексы для геопоиска
LocationSchema.index({ 'geo.lat': 1, 'geo.lng': 1 });
LocationSchema.index({ name: 1 });

// Виртуальные поля
LocationSchema.virtual('machines', {
  ref: 'VendingMachine',
  localField: '_id',
  foreignField: 'locationId'
});

// Методы для работы с координатами
LocationSchema.methods.hasGeoLocation = function(): boolean {
  return !!(this.geo?.lat && this.geo?.lng);
};

LocationSchema.methods.getDistanceTo = function(lat: number, lng: number): number {
  if (!this.hasGeoLocation()) return Infinity;
  
  const R = 6371; // Радиус Земли в км
  const dLat = this.toRadians(lat - this.geo!.lat);
  const dLon = this.toRadians(lng - this.geo!.lng);
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(this.toRadians(this.geo!.lat)) * Math.cos(this.toRadians(lat)) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
};

LocationSchema.methods.toRadians = function(degrees: number): number {
  return degrees * (Math.PI/180);
};

export const Location = mongoose.models.Location || mongoose.model<LocationDocument>('Location', LocationSchema);
