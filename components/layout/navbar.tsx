'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/auth'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LogOut, LayoutDashboard, ShoppingCart, Package, Menu, X, Settings, Users, Boxes } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

export function Navbar() {
  const router = useRouter()
  const pathname = usePathname()
  const { user, logout } = useAuthStore()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const handleLogout = async () => {
    try {
      await logout()
      router.push('/')
    } catch (error) {
      console.error('Ошибка при выходе:', error)
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

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'Администратор'
      case 'MANAGER':
        return 'Менеджер'
      default:
        return role
    }
  }

  const navigation = [
    { name: 'Главная', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Автоматы', href: '/dashboard/machines', icon: Package },
    { name: 'Продукты', href: '/dashboard/products', icon: Boxes },
    { name: 'Продажи', href: '/dashboard/sales', icon: ShoppingCart },
    ...(user?.role === 'ADMIN' ? [{ name: 'Менеджеры', href: '/dashboard/managers', icon: Users }] : []),
  ]

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="container mx-auto px-4 lg:px-0">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <div className="relative w-[274px] h-[42px]">
              <Image src="/images/logo.svg" alt="Logo" fill priority />
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Навигация */}
            <nav className="hidden md:flex space-x-1">
              {navigation.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <item.icon className="mr-2 h-4 w-4" />
                    {item.name}
                  </Link>
                )
              })}
            </nav>

            {/* Мобильное меню */}
            <div className="md:hidden">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </Button>
            </div>

            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage 
                        src={user.avatar ? `${user.avatar}` : ''} 
                        alt="Аватар пользователя" 
                      />
                      <AvatarFallback className="bg-blue-100 text-blue-600">
                        {getInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user.name}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user.email}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {getRoleLabel(user.role)}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  
                  {/* Навигация */}
                  {navigation.map((item) => {
                    const isActive = pathname === item.href
                    return (
                      <DropdownMenuItem key={item.name} asChild>
                        <Link
                          href={item.href}
                          className={`flex items-center w-full ${
                            isActive ? 'bg-blue-100 text-blue-700' : ''
                          }`}
                        >
                          <item.icon className={`mr-2 h-4 w-4 ${
                            isActive ? 'text-blue-700' : ''
                          }`} />
                          <span>{item.name}</span>
                        </Link>
                      </DropdownMenuItem>
                    )
                  })}
                  
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link 
                      href="/dashboard/profile" 
                      className={`flex items-center w-full ${
                        pathname === '/dashboard/profile' ? 'bg-blue-100 text-blue-700' : ''
                      }`}
                    >
                      <Settings className={`mr-2 h-4 w-4 ${
                        pathname === '/dashboard/profile' ? 'text-blue-700' : ''
                      }`} />
                      <span>Настройки</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Выйти</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>

      {/* Мобильное меню */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t bg-white">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center px-3 py-2 rounded-md text-base font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <item.icon className="mr-3 h-5 w-5" />
                  {item.name}
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </header>
  )
}
