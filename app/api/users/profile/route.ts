import { NextRequest, NextResponse } from 'next/server'
import { User } from '@/entities/User'
import dbConnect from '@/lib/database/connection'
import { JWTService } from '@/lib/auth/jwt'
import { UpdateProfileRequest, UpdateProfileResponse } from '@/types'

export async function GET(request: NextRequest) {
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

    const user = await User.findById(payload.userId).select('-passwordHash')
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Пользователь не найден' },
        { status: 404 }
      )
    }

    const response: UpdateProfileResponse = {
      success: true,
      data: { 
        user: {
          _id: user._id as any,
          email: user.email,
          name: user.name,
          role: user.role,
          phone: user.phone,
          avatar: user.avatar,
          isActive: user.isActive,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Ошибка получения профиля:', error)
    return NextResponse.json(
      { success: false, message: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
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

    const body: UpdateProfileRequest = await request.json()
    
    // Валидация данных
    const updateData: Partial<UpdateProfileRequest> = {}
    
    if (body.name !== undefined) {
      if (body.name.trim().length === 0) {
        return NextResponse.json(
          { success: false, message: 'Имя не может быть пустым' },
          { status: 400 }
        )
      }
      updateData.name = body.name.trim()
    }
    
    if (body.email !== undefined) {
      const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/
      if (!emailRegex.test(body.email)) {
        return NextResponse.json(
          { success: false, message: 'Некорректный email' },
          { status: 400 }
        )
      }
      
      // Проверяем, что email не занят другим пользователем
      const existingUser = await User.findOne({ 
        email: body.email.toLowerCase(), 
        _id: { $ne: payload.userId } 
      })
      if (existingUser) {
        return NextResponse.json(
          { success: false, message: 'Email уже используется' },
          { status: 400 }
        )
      }
      updateData.email = body.email.toLowerCase()
    }
    
    if (body.phone !== undefined) {
      if (body.phone.trim().length > 0) {
        const phoneRegex = /^\+?[1-9]\d{10,14}$/
        if (!phoneRegex.test(body.phone)) {
          return NextResponse.json(
            { success: false, message: 'Некорректный номер телефона' },
            { status: 400 }
          )
        }
      }
      updateData.phone = body.phone.trim() || undefined
    }
    
    if (body.avatar !== undefined) {
      updateData.avatar = body.avatar.trim() || undefined
    }

    const user = await User.findByIdAndUpdate(
      payload.userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-passwordHash')

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Пользователь не найден' },
        { status: 404 }
      )
    }

    const response: UpdateProfileResponse = {
      success: true,
      data: { 
        user: {
          _id: user._id as any,
          email: user.email,
          name: user.name,
          role: user.role,
          phone: user.phone,
          avatar: user.avatar,
          isActive: user.isActive,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Ошибка обновления профиля:', error)
    return NextResponse.json(
      { success: false, message: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
