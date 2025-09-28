import { withAuth, type AuthenticatedRequest, createErrorResponse, createSuccessResponse } from '@/lib/auth/middleware'
import dbConnect from '@/lib/database/connection'
import { Product } from '@/entities/Product'
import { NextResponse } from 'next/server'
import path from 'path'
import { promises as fs } from 'fs'
import { randomUUID } from 'crypto'

async function ensureDir(dirPath: string) {
  try {
    await fs.mkdir(dirPath, { recursive: true })
  } catch {}
}

async function handlePatchProduct(request: AuthenticatedRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    await dbConnect()
    const { id } = await params

    // Accept both JSON and multipart/form-data. If multipart, support image upload
    const contentType = request.headers.get('content-type') || ''

    let name: string | undefined
    let imagePath: string | undefined
    let price: number | undefined

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      const nameField = form.get('name')
      if (typeof nameField === 'string' && nameField.trim()) {
        name = nameField.trim()
      }
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
      // JSON
      const body = await request.json().catch(() => ({})) as { name?: string; image?: string; price?: number }
      if (body.name && body.name.trim()) name = body.name.trim()
      if (body.image) imagePath = body.image // allow direct path assignment if needed
      if (typeof body.price !== 'undefined') {
        const parsed = Number(body.price)
        if (!Number.isFinite(parsed) || parsed <= 0) {
          return createErrorResponse('Цена должна быть положительным числом', 400)
        }
        price = Math.round(parsed)
      }
    }

    const update: Record<string, unknown> = {}
    if (typeof name === 'string') update.name = name
    if (typeof imagePath === 'string') update.image = imagePath
    if (typeof price === 'number') update.price = price

    if (Object.keys(update).length === 0) {
      return createErrorResponse('Нет данных для обновления', 400)
    }

    const updated = await Product.findByIdAndUpdate(id, update, { new: true })
    if (!updated) return createErrorResponse('Продукт не найден', 404)

    return createSuccessResponse({ product: { _id: updated._id.toString(), name: updated.name, image: updated.image, price: updated.price } })
  } catch (e) {
    console.error('Ошибка обновления продукта:', e)
    return createErrorResponse('Ошибка обновления продукта', 500)
  }
}

async function handleDeleteProduct(request: AuthenticatedRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    await dbConnect()
    const { id } = await params
    const deleted = await Product.findByIdAndDelete(id)
    if (!deleted) return createErrorResponse('Продукт не найден', 404)
    return createSuccessResponse({ message: 'Удалено', id })
  } catch (e) {
    console.error('Ошибка удаления продукта:', e)
    return createErrorResponse('Ошибка удаления продукта', 500)
  }
}

export const PATCH = withAuth(handlePatchProduct)
export const DELETE = withAuth(handleDeleteProduct)
