"use client"

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { IUser } from '@/types';

// Схема валидации для формы менеджера
const ManagerFormSchema = z.object({
  name: z.string().min(2, 'Имя должно содержать минимум 2 символа').max(100, 'Имя не должно превышать 100 символов'),
  email: z.string().email('Некорректный email адрес'),
  phone: z.string().min(10, 'Некорректный номер телефона').optional().or(z.literal('')),
});

type ManagerFormData = z.infer<typeof ManagerFormSchema>;

type Manager = Omit<IUser, 'passwordHash'>;

interface ManagerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: ManagerFormData) => Promise<void>;
  manager?: Manager | null;
  isLoading?: boolean;
}

export function ManagerDialog({
  isOpen,
  onClose,
  onSave,
  manager,
  isLoading = false
}: ManagerDialogProps) {
  const isEditing = !!manager;
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue
  } = useForm<ManagerFormData>({
    resolver: zodResolver(ManagerFormSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
    }
  });

  // Сброс формы при открытии/закрытии диалога
  useEffect(() => {
    if (isOpen) {
      if (manager) {
        setValue('name', manager.name);
        setValue('email', manager.email);
        setValue('phone', manager.phone || '');
      } else {
        reset({
          name: '',
          email: '',
          phone: '',
        });
      }
    }
  }, [isOpen, manager, setValue, reset]);

  const onSubmit = async (data: ManagerFormData) => {
    try {
      await onSave(data);
      onClose();
    } catch (error) {
      console.error('Ошибка сохранения менеджера:', error);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Редактировать менеджера' : 'Добавить менеджера'}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? 'Внесите изменения в информацию о менеджере.'
              : 'Заполните форму для создания нового менеджера. На указанный email будет отправлено письмо с авторизационными данными.'
            }
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Имя и фамилия *</Label>
            <Input
              id="name"
              placeholder="Иван Иванов"
              {...register('name')}
              disabled={isLoading}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              placeholder="ivan@example.com"
              {...register('email')}
              disabled={isLoading}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Номер телефона</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+7 (999) 123-45-67"
              {...register('phone')}
              disabled={isLoading}
            />
            {errors.phone && (
              <p className="text-sm text-destructive">{errors.phone.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Отмена
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {isEditing ? 'Сохранение...' : 'Создание...'}
                </>
              ) : (
                isEditing ? 'Сохранить' : 'Создать'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
