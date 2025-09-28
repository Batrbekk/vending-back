import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Маршруты, которые не требуют авторизации
const publicRoutes = ['/']
const apiRoutes = [
  '/api/auth/login', 
  '/api/auth/logout',
  '/api/device/pair/verify',  // Пейринг устройства
  '/api/products',            // Получение товаров
  '/api/device/',             // Все device API (heartbeat, sales)
  '/api/machines/'            // Состояние автоматов
]

// Функция для проверки валидности токена
async function validateToken(token: string, baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/api/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })
    return response.ok
  } catch (error) {
    console.error('Token validation error:', error)
    return false
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Пропускаем API маршруты авторизации и устройств
  if (apiRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Пропускаем публичные маршруты
  if (publicRoutes.includes(pathname)) {
    return NextResponse.next()
  }

  // Проверяем наличие токена в cookies
  const token = request.cookies.get('accessToken')?.value

  if (!token) {
    // Перенаправляем на страницу входа
    const loginUrl = new URL('/', request.url)
    return NextResponse.redirect(loginUrl)
  }

  // Проверяем валидность токена
  const baseUrl = request.nextUrl.origin
  const isValidToken = await validateToken(token, baseUrl)

  if (!isValidToken) {
    // Токен недействителен, перенаправляем на страницу входа
    const loginUrl = new URL('/', request.url)
    const response = NextResponse.redirect(loginUrl)
    
    // Удаляем недействительные cookies
    response.cookies.delete('accessToken')
    response.cookies.delete('user-data')
    
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Явно указываем все маршруты, которые должны быть защищены
    '/dashboard/:path*',
    '/api/:path*',
    // Исключаем статические файлы и публичные изображения (любой регистр) + директорию /products/
    '/((?!_next/static|_next/image|favicon.ico|products/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|SVG|PNG|JPG|JPEG|GIF|WEBP|AVIF)$).*)',
  ],
}