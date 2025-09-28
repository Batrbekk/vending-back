'use client'

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '@/lib/stores/auth';
import { ManagersTable } from '@/components/managers/ManagersTable';
import { ManagerDialog } from '@/components/managers/ManagerDialog';
import { IUser } from '@/types';
import { toast } from 'sonner';

type Manager = Omit<IUser, 'passwordHash'>;

interface Pagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface ManagerFormData {
  name: string;
  email: string;
  phone?: string;
}

export default function ManagersPage() {
  const { user } = useAuthStore();
  const [managers, setManagers] = useState<Manager[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    totalCount: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingManager, setEditingManager] = useState<Manager | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Загрузка менеджеров
  const fetchManagers = useCallback(async (page = 1, search = '') => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
      });
      
      if (search) {
        params.append('search', search);
      }

      const token = useAuthStore.getState().token;
      if (!token) {
        throw new Error('Токен авторизации не найден');
      }

      const response = await fetch(`/api/managers?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Ошибка загрузки менеджеров');
      }

      const data = await response.json();
      
      if (data.success) {
        setManagers(data.data.managers);
        setPagination(data.data.pagination);
      } else {
        throw new Error(data.message || 'Ошибка загрузки менеджеров');
      }
    } catch (error) {
      console.error('Ошибка загрузки менеджеров:', error);
      toast.error('Не удалось загрузить список менеджеров');
    } finally {
      setIsLoading(false);
    }
  }, [pagination.limit]);

  // Загрузка при монтировании компонента
  useEffect(() => {
    fetchManagers();
  }, [fetchManagers]);

  // Очистка таймаута при размонтировании
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Обработка поиска с debounce
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    
    // Очищаем предыдущий таймаут
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Устанавливаем новый таймаут
    searchTimeoutRef.current = setTimeout(() => {
      fetchManagers(1, query);
    }, 300); // 300ms задержка
  };

  // Обработка смены страницы
  const handlePageChange = (page: number) => {
    fetchManagers(page, searchQuery);
  };

  // Обработка добавления менеджера
  const handleAdd = () => {
    setEditingManager(null);
    setIsDialogOpen(true);
  };

  // Обработка редактирования менеджера
  const handleEdit = (manager: Manager) => {
    setEditingManager(manager);
    setIsDialogOpen(true);
  };

  // Обработка удаления менеджера
  const handleDelete = async (managerId: string) => {
    try {
      const token = useAuthStore.getState().token;
      if (!token) {
        throw new Error('Токен авторизации не найден');
      }

      const response = await fetch(`/api/managers/${managerId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Ошибка удаления менеджера');
      }

      const data = await response.json();
      
      if (data.success) {
        toast.success('Менеджер успешно удален');
        // Перезагружаем список
        fetchManagers(pagination.page, searchQuery);
      } else {
        throw new Error(data.message || 'Ошибка удаления менеджера');
      }
    } catch (error) {
      console.error('Ошибка удаления менеджера:', error);
      toast.error('Не удалось удалить менеджера');
    }
  };

  // Обработка сохранения менеджера
  const handleSave = async (formData: ManagerFormData) => {
    try {
      setIsSubmitting(true);
      
      const token = useAuthStore.getState().token;
      if (!token) {
        throw new Error('Токен авторизации не найден');
      }
      
      const url = editingManager 
        ? `/api/managers/${editingManager._id}`
        : '/api/managers';
      
      const method = editingManager ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Ошибка сохранения менеджера');
      }

      const data = await response.json();
      
      if (data.success) {
        if (editingManager) {
          toast.success('Менеджер успешно обновлен');
        } else {
          toast.success('Менеджер успешно создан');
          if (data.data.emailSent) {
            toast.info('Письмо с авторизационными данными отправлено на email');
          } else {
            toast.warning('Менеджер создан, но не удалось отправить email');
          }
        }
        
        // Перезагружаем список
        fetchManagers(pagination.page, searchQuery);
      } else {
        // Показываем конкретную ошибку от сервера
        toast.error(data.message || 'Ошибка сохранения менеджера');
        return; // Не перезагружаем список при ошибке
      }
    } catch (error) {
      console.error('Ошибка сохранения менеджера:', error);
      toast.error('Не удалось сохранить менеджера');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Обработка закрытия диалога
  const handleCloseDialog = () => {
    if (!isSubmitting) {
      setIsDialogOpen(false);
      setEditingManager(null);
    }
  };

  // Проверяем права доступа
  if (user?.role !== 'ADMIN') {
    return (
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Доступ запрещен</h1>
          <p className="text-gray-600">У вас нет прав для доступа к этой странице.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Управление менеджерами</h1>
        <p className="mt-2 text-gray-600">
          Создание и управление менеджерами системы
        </p>
      </div>

      <ManagersTable
        managers={managers}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onAdd={handleAdd}
        onSearch={handleSearch}
        pagination={pagination}
        onPageChange={handlePageChange}
        isLoading={isLoading}
      />

      <ManagerDialog
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        onSave={handleSave}
        manager={editingManager}
        isLoading={isSubmitting}
      />
    </div>
  );
}
