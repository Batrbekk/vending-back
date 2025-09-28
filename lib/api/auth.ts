interface LoginRequest {
  email: string
  password: string
}

interface LoginResponse {
  success: boolean;
  data: {
    accessToken: string;
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      phone: string;
      isActive: boolean;
      createdAt: string;
      updatedAt: string;
    }
  }
}

interface ApiError {
  message: string
  status: number
}

export class AuthApiClient {
  private baseUrl: string

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl
  }

  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await fetch(`${this.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        message: 'Ошибка сервера',
      }))
      
      const error: ApiError = {
        message: errorData.message || 'Ошибка авторизации',
        status: response.status,
      }
      
      throw error
    }

    return response.json()
  }

  async logout(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error('Ошибка при выходе из системы')
    }
  }

  async getCurrentUser(token?: string): Promise<{ user: LoginResponse['data']['user']; accessToken: string }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    // Если токен передан, используем его в заголовке Authorization
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch(`${this.baseUrl}/api/auth/me`, {
      method: 'GET',
      headers,
    })

    if (!response.ok) {
      throw new Error('Ошибка получения данных пользователя')
    }

    const data = await response.json()
    return {
      user: data.data.user,
      accessToken: token || '' // Возвращаем токен если он был передан
    }
  }
}

export const authApi = new AuthApiClient()