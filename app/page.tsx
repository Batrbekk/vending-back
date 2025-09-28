'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LoginForm } from '@/components/auth/login-form'
import { useAuthStore } from '@/lib/stores/auth'
import Image from 'next/image'

export default function LoginPage() {
  const router = useRouter()
  const { isAuthenticated, initializeFromCookies } = useAuthStore()

  useEffect(() => {
    // Инициализируем пользователя из cookies при загрузке страницы
    initializeFromCookies()
  }, [initializeFromCookies])

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard')
    }
  }, [isAuthenticated, router])

  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Перенаправление...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-y-8 bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="relative w-[274px] h-[42px]">
        <Image src="/images/logo.svg" alt="Logo" fill priority />
      </div>
      <div className="max-w-md w-full space-y-8">
        <LoginForm />
      </div>
    </div>
  )
}