import { NextRequest, NextResponse } from 'next/server'
import { User } from '@/entities/User'
import dbConnect from '@/lib/database/connection'
import { JWTService } from '@/lib/auth/jwt'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

export async function POST(request: NextRequest) {
  try {
    await dbConnect()
    
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Токен не предоставлен' },
        { status: 401 }
      )
    }

    const payload = await JWTService.verifyToken(token)
    if (!payload || !payload.userId) {
      return NextResponse.json(
        { success: false, message: 'Недействительный токен' },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('avatar') as File
    
    if (!file) {
      return NextResponse.json(
        { success: false, message: 'Файл не предоставлен' },
        { status: 400 }
      )
    }

    // Проверяем тип файла
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { success: false, message: 'Файл должен быть изображением' },
        { status: 400 }
      )
    }

    // Проверяем размер файла (максимум 5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, message: 'Размер файла не должен превышать 5MB' },
        { status: 400 }
      )
    }

    // Создаем директорию для аватарок если её нет
    const uploadDir = join(process.cwd(), 'public', 'avatars')
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // Генерируем уникальное имя файла
    const fileExtension = file.name.split('.').pop()
    const fileName = `${payload.userId}-${Date.now()}.${fileExtension}`
    const filePath = join(uploadDir, fileName)

    // Конвертируем файл в буфер и сохраняем
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // Обновляем аватар пользователя в базе данных
    const avatarUrl = `/avatars/${fileName}`
    await User.findByIdAndUpdate(payload.userId, { avatar: avatarUrl })

    return NextResponse.json({
      success: true,
      data: {
        avatarUrl
      }
    })
  } catch (error) {
    console.error('Ошибка загрузки аватарки:', error)
    return NextResponse.json(
      { success: false, message: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await dbConnect()
    
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Токен не предоставлен' },
        { status: 401 }
      )
    }

    const payload = await JWTService.verifyToken(token)
    if (!payload || !payload.userId) {
      return NextResponse.json(
        { success: false, message: 'Недействительный токен' },
        { status: 401 }
      )
    }

    // Удаляем аватар из базы данных
    await User.findByIdAndUpdate(payload.userId, { $unset: { avatar: 1 } })

    return NextResponse.json({
      success: true,
      message: 'Аватар удален'
    })
  } catch (error) {
    console.error('Ошибка удаления аватарки:', error)
    return NextResponse.json(
      { success: false, message: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
