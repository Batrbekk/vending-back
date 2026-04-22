import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

// Маршруты, которые не требуют авторизации
const publicRoutes = ['/']
const apiPublicRoutes = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/me',              // проверка авторизации со стороны клиента
  '/api/device/pair/verify',   // Пейринг устройства
  '/api/products',             // Получение товаров (есть свой auth)
  '/api/device/',              // Все device API (heartbeat, sales)
  '/api/machines/',            // Состояние автоматов
  '/api/admin/',               // Админ эндпоинты
]

// JWT_SECRET в Edge runtime доступен через process.env (Next.js подставляет at build time)
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key'
const secret = new TextEncoder().encode(JWT_SECRET)

/**
 * Локальная валидация JWT (без сетевого запроса, работает в Edge runtime).
 * Проверяет подпись и exp. Возвращает true только если токен валиден.
 */
async function validateTokenLocally(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, secret, { algorithms: ['HS256'] })
    return true
  } catch {
    // expired / invalid signature / malformed — всё сюда
    return false
  }
}

function redirectToLogin(request: NextRequest): NextResponse {
  const loginUrl = new URL('/', request.url)
  const response = NextResponse.redirect(loginUrl)
  // Чистим протухшие cookies, чтобы не было лишних редирект-циклов
  response.cookies.delete('accessToken')
  response.cookies.delete('user-data')
  return response
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Пропускаем API маршруты, у которых свой auth (или они публичные)
  if (apiPublicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Пропускаем публичные страницы
  if (publicRoutes.includes(pathname)) {
    return NextResponse.next()
  }

  const token = request.cookies.get('accessToken')?.value
  if (!token) {
    return redirectToLogin(request)
  }

  const valid = await validateTokenLocally(token)
  if (!valid) {
    return redirectToLogin(request)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/api/:path*',
    // Исключаем статику и картинки
    '/((?!_next/static|_next/image|favicon.ico|products/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|SVG|PNG|JPG|JPEG|GIF|WEBP|AVIF)$).*)',
  ],
}
