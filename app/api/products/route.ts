import { withAuth, type AuthenticatedRequest, createErrorResponse, createSuccessResponse } from '@/lib/auth/middleware'
import dbConnect from '@/lib/database/connection'
import { Product } from '@/entities/Product'
import { NextResponse } from 'next/server'
import path from 'path'
import { promises as fs } from 'fs'
import { randomUUID } from 'crypto'

async function handleGetProducts(request: AuthenticatedRequest) {
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
      products: products.map((p) => ({ _id: p._id.toString(), name: p.name, image: p.image, price: (p as { price?: number }).price ?? 500 })),
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
    console.error('Ошибка получения продуктов:', e)
    return createErrorResponse('Ошибка получения продуктов', 500)
  }
}

async function ensureDir(dirPath: string) {
  try { await fs.mkdir(dirPath, { recursive: true }) } catch {}
}

async function handleCreateProduct(request: AuthenticatedRequest): Promise<NextResponse> {
  try {
    await dbConnect()

    const contentType = request.headers.get('content-type') || ''
    let name: string | undefined
    let imagePath: string | undefined
    let price: number | undefined

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      const nameField = form.get('name')
      if (typeof nameField === 'string' && nameField.trim()) name = nameField.trim()

      const priceField = form.get('price')
      if (typeof priceField === 'string' && priceField.trim()) {
        const parsed = Number(priceField)
        if (!Number.isFinite(parsed) || parsed <= 0) {
          return createErrorResponse('Цена должна быть положительным числом', 400)
        }
        price = Math.round(parsed)
      }

      const image = form.get('image') as File | null
      if (image && typeof image === 'object') {
        // validations
        const allowed = ['image/png', 'image/jpeg']
        const MAX = 5 * 1024 * 1024
        if (!allowed.includes(image.type)) {
          return createErrorResponse('Допустимые форматы: PNG, JPEG', 400)
        }
        if (image.size > MAX) {
          return createErrorResponse('Размер файла не должен превышать 5 МБ', 400)
        }

        const arrayBuffer = await image.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const uploadDir = path.join(process.cwd(), 'public', 'products')
        await ensureDir(uploadDir)
        const ext = image.name?.includes('.') ? `.${image.name.split('.').pop()}` : (image.type === 'image/png' ? '.png' : '.jpg')
        const filename = `${randomUUID()}${ext}`
        const filePath = path.join(uploadDir, filename)
        await fs.writeFile(filePath, buffer)
        imagePath = `/products/${filename}`
      }
    } else {
      const body = await request.json().catch(() => ({})) as { name?: string; image?: string; price?: number }
      if (body.name && body.name.trim()) name = body.name.trim()
      if (body.image) imagePath = body.image
      if (typeof body.price !== 'undefined') {
        const parsed = Number(body.price)
        if (!Number.isFinite(parsed) || parsed <= 0) {
          return createErrorResponse('Цена должна быть положительным числом', 400)
        }
        price = Math.round(parsed)
      }
    }

    if (!name) return createErrorResponse('Название обязательно', 400)
    if (typeof price === 'undefined') price = 500

    const created = await Product.create({ name, image: imagePath, price })
    return createSuccessResponse({ product: { _id: created._id.toString(), name: created.name, image: created.image, price: created.price } }, 201)
  } catch (e) {
    console.error('Ошибка создания продукта:', e)
    return createErrorResponse('Ошибка создания продукта', 500)
  }
}

export const GET = withAuth(handleGetProducts)
export const POST = withAuth(handleCreateProduct)
