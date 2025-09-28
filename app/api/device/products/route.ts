import { NextRequest } from 'next/server'
import { createErrorResponse, createSuccessResponse } from '@/lib/auth/middleware'
import dbConnect from '@/lib/database/connection'
import { Product } from '@/entities/Product'

export async function GET(request: NextRequest) {
  try {
    await dbConnect()

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
    const skip = (page - 1) * limit

    const filter: Record<string, unknown> = {}
    if (search) {
      filter.name = { $regex: new RegExp(search, 'i') }
    }

    const [products, totalCount] = await Promise.all([
      Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Product.countDocuments(filter),
    ])

    const totalPages = Math.ceil(totalCount / limit)

    return createSuccessResponse({
      products: products.map((p) => ({ 
        _id: p._id.toString(), 
        name: p.name, 
        image: p.image, 
        price: (p as { price?: number }).price ?? 500 
      })),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    })
  } catch (e) {
    console.error('Ошибка получения продуктов для устройства:', e)
    return createErrorResponse('Ошибка получения продуктов', 500)
  }
}
