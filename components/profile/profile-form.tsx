'use client'

import { useState, useRef, useEffect } from 'react'
import { useAuthStore } from '@/lib/stores/auth'
import Cookies from 'js-cookie'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Camera, X, Info } from 'lucide-react'
import { toast } from 'sonner'

export function ProfileForm() {
  const { user, updateProfile, refreshUserData, isLoading, error, clearError } = useAuthStore()
  
  
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  })
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Отслеживаем изменения пользователя
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
      })
    }
  }, [user])

  // Обновляем данные пользователя при загрузке компонента
  useEffect(() => {
    if (user && !user.avatar) {
      refreshUserData()
    }
  }, [user, refreshUserData])

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (error) clearError()
  }

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // Проверяем тип файла (только JPG, JPEG, PNG)
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png']
      if (!allowedTypes.includes(file.type)) {
        toast.error('Ошибка формата', {
          description: 'Поддерживаются только форматы JPG, JPEG, PNG'
        })
        return
      }
      
      // Проверяем размер файла (максимум 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Ошибка размера', {
          description: 'Размер файла не должен превышать 5 МБ'
        })
        return
      }

      setAvatarFile(file)
      
      // Создаем превью
      const reader = new FileReader()
      reader.onload = (e) => {
        setAvatarPreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemoveAvatar = () => {
    setAvatarFile(null)
    setAvatarPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const uploadAvatar = async (file: File): Promise<string | null> => {
    try {
      // Получаем токен из cookies
      const token = Cookies.get('accessToken')
      if (!token) {
        throw new Error('Токен не найден')
      }

      const formData = new FormData()
      formData.append('avatar', file)

      const response = await fetch('/api/users/avatar', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          message: 'Ошибка сервера',
        }))
        console.error('Ошибка загрузки аватарки:', errorData)
        throw new Error(errorData.message || 'Ошибка загрузки аватарки')
      }

      const data = await response.json()
      console.log('Аватарка успешно загружена:', data)
      toast.success('Аватар загружен', {
        description: 'Фотография успешно загружена'
      })
      return data.data.avatarUrl
    } catch (error) {
      console.error('Ошибка загрузки аватарки:', error)
      throw error
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      let avatarUrl = user?.avatar

      // Загружаем аватарку если выбрана новая
      if (avatarFile) {
        setIsUploadingAvatar(true)
        avatarUrl = await uploadAvatar(avatarFile) || undefined
        setIsUploadingAvatar(false)
        
        // Обновляем данные пользователя после загрузки аватара
        await refreshUserData()
      }

      // Обновляем профиль
      await updateProfile({
        ...formData,
        avatar: avatarUrl,
      })

      // Показываем успешное уведомление
      toast.success('Профиль обновлен', {
        description: 'Информация о профиле успешно сохранена'
      })

      // Сбрасываем состояние файла
      setAvatarFile(null)
      setAvatarPreview(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error) {
      console.error('Ошибка обновления профиля:', error)
      toast.error('Ошибка обновления', {
        description: error instanceof Error ? error.message : 'Произошла ошибка при обновлении профиля'
      })
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Профиль пользователя</CardTitle>
        <CardDescription>
          Обновите информацию о вашем профиле
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Аватарка */}
          <div className="flex items-start space-x-6">
            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                <Avatar className="h-24 w-24">
                  <AvatarImage 
                    src={avatarPreview || user?.avatar || undefined} 
                    alt="Аватар пользователя" 
                  />
                  <AvatarFallback className="text-lg">
                    {getInitials(user?.name || 'Пользователь')}
                  </AvatarFallback>
                </Avatar>
                <Button
                  type="button"
                  size="sm"
                  className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full p-0"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                >
                  <Camera className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                >
                  {isUploadingAvatar ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Изменить фото'
                  )}
                </Button>
                
                {(avatarFile || avatarPreview) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveAvatar}
                    disabled={isUploadingAvatar}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,image/jpeg,image/jpg,image/png"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Info className="h-4 w-4" />
                <p>Аватарка: поддерживаются форматы JPG, JPEG, PNG, максимальный размер 5 МБ</p>
              </div>
            </div>
          </div>

          {/* Ошибки */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Поля формы */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Имя *</Label>
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Введите ваше имя"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="Введите ваш email"
                required
                readOnly
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Телефон</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                placeholder="+7 (999) 123-45-67"
              />
            </div>
          </div>

          {/* Кнопка сохранения */}
          <div className="flex justify-end">
            <Button 
              type="submit" 
              disabled={isLoading || isUploadingAvatar}
              className="min-w-[120px]"
            >
              {isLoading || isUploadingAvatar ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Сохранить'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
