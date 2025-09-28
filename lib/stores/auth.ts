import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authApi } from '@/lib/api/auth'
import Cookies from 'js-cookie'

export interface User {
  id: string
  email: string
  name: string
  role: string
  phone: string
  avatar?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}

interface AuthActions {
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  setUser: (user: User) => void
  setToken: (token: string) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearError: () => void
  initializeFromCookies: () => void
  updateProfile: (profileData: Partial<User>) => Promise<void>
  refreshUserData: () => Promise<void>
}

type AuthStore = AuthState & AuthActions

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      // State
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Actions
      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null })
        
        try {
          const data = await authApi.login({ email, password })
          
          // Сохраняем токен и данные пользователя в cookies
          Cookies.set('accessToken', data.data.accessToken, { expires: 7 })
          Cookies.set('user-data', JSON.stringify(data.data.user), { expires: 7 })
          
          set({
            user: data.data.user,
            token: data.data.accessToken,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          })
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Произошла ошибка',
            isLoading: false,
          })
        }
      },

      logout: () => {
        // Удаляем токен и данные пользователя из cookies
        Cookies.remove('accessToken')
        Cookies.remove('user-data')
        
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          error: null,
        })
      },

      setUser: (user: User) => {
        set({ user })
      },

      setToken: (token: string) => {
        set({ token, isAuthenticated: true })
      },

      setLoading: (isLoading: boolean) => {
        set({ isLoading })
      },

      setError: (error: string | null) => {
        set({ error })
      },

      clearError: () => {
        set({ error: null })
      },

      refreshUserData: async () => {
        try {
          const token = Cookies.get('accessToken')
          if (!token) {
            throw new Error('Токен не найден')
          }

          const response = await fetch('/api/auth/me', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          })

          if (!response.ok) {
            throw new Error('Ошибка получения данных пользователя')
          }

          const data = await response.json()
          const user = data.data.user
          
          // Обновляем данные пользователя в store и cookies
          Cookies.set('user-data', JSON.stringify(user), { expires: 7 })
          
          set({
            user,
            error: null,
          })
        } catch (error) {
          console.error('Ошибка обновления данных пользователя:', error)
        }
      },

      initializeFromCookies: () => {
        const token = Cookies.get('accessToken')
        const userData = Cookies.get('user-data')
        
        if (token && userData) {
          try {
            const user = JSON.parse(userData)
            set({
              user,
              token,
              isAuthenticated: true,
              error: null,
            })
          } catch (error) {
            console.error('Ошибка при парсинге данных пользователя:', error)
            // Очищаем невалидные cookies
            Cookies.remove('accessToken')
            Cookies.remove('user-data')
            set({
              user: null,
              token: null,
              isAuthenticated: false,
              error: null,
            })
          }
        }
      },

      updateProfile: async (profileData: Partial<User>) => {
        set({ isLoading: true, error: null })
        
        try {
          const token = Cookies.get('accessToken')
          if (!token) {
            throw new Error('Токен не найден')
          }

          const response = await fetch('/api/users/profile', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(profileData),
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({
              message: 'Ошибка сервера',
            }))
            throw new Error(errorData.message || 'Ошибка обновления профиля')
          }

          const data = await response.json()
          
          // Обновляем данные пользователя в store и cookies
          const updatedUser = data.data.user
          Cookies.set('user-data', JSON.stringify(updatedUser), { expires: 7 })
          
          set({
            user: updatedUser,
            isLoading: false,
            error: null,
          })
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Произошла ошибка',
            isLoading: false,
          })
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)