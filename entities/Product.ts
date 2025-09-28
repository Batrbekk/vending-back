import mongoose, { Schema, Document, Model, Types } from 'mongoose'

export interface ProductDocument extends Document {
  _id: Types.ObjectId
  name: string
  image?: string // relative path like /products/uuid.jpg
  price: number
  createdAt: Date
  updatedAt: Date
}

export type ProductModel = Model<ProductDocument>

const ProductSchema = new Schema<ProductDocument>({
  name: {
    type: String,
    required: [true, 'Название обязательно'],
    trim: true,
    maxlength: 200,
  },
  image: {
    type: String,
    default: undefined,
  },
  price: {
    type: Number,
    required: [true, 'Цена обязательна'],
    min: [1, 'Цена должна быть больше 0'],
    default: 500,
  },
}, {
  timestamps: true,
  versionKey: false,
})

if (mongoose.models.Product) {
  delete mongoose.models.Product
}

export const Product = mongoose.model<ProductDocument, ProductModel>('Product', ProductSchema)
