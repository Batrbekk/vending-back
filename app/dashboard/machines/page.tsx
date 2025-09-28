'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Plus, Search, Power, PowerOff, Trash2, Link2 } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useMachinesStore } from '@/hooks/useMachinesStore'
import { MachineStatus } from '@/types'
import { useForm, SubmitHandler, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useShallow } from 'zustand/react/shallow'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { machinesApi } from '@/lib/api/machines'
import { toast } from 'sonner'

const CreateMachineSchema = z.object({
  machineId: z
    .string()
    .min(3, 'ID автомата должен содержать минимум 3 символа')
    .max(20, 'ID автомата не должен превышать 20 символов')
    .regex(/^[A-Z0-9-]+$/i, 'ID должен содержать только буквы, цифры и дефисы')
    .transform(s => s.toUpperCase()),
  locationName: z
    .string()
    .min(1, 'Название локации обязательно')
    .max(200, 'Слишком длинное название')
    .trim(),
  notes: z
    .string()
    .max(1000, 'Заметка не должна превышать 1000 символов')
    .optional(),
  activateAfter: z.boolean().default(true),
})

type CreateMachineForm = z.infer<typeof CreateMachineSchema>

function getStatusLabel(status: MachineStatus): string {
  switch (status) {
    case MachineStatus.WORKING:
      return 'Работает'
    case MachineStatus.LOW_STOCK:
      return 'Низкий запас'
    case MachineStatus.OUT_OF_STOCK:
      return 'Пустой'
    case MachineStatus.IN_SERVICE:
      return 'Обслуживание'
    case MachineStatus.ERROR:
      return 'Ошибка'
    case MachineStatus.INACTIVE:
      return 'Неактивен'
    case MachineStatus.UNPAIRED:
      return 'Не подключён'
    default:
      return String(status)
  }
}

function getStatusVariant(status: MachineStatus): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (status) {
    case MachineStatus.WORKING:
      return 'default'
    case MachineStatus.LOW_STOCK:
      return 'secondary'
    case MachineStatus.IN_SERVICE:
      return 'outline'
    case MachineStatus.ERROR:
    case MachineStatus.OUT_OF_STOCK:
      return 'destructive'
    case MachineStatus.INACTIVE:
      return 'outline'
    case MachineStatus.UNPAIRED:
      return 'secondary'
    default:
      return 'secondary'
  }
}

export default function MachinesPage() {
  const { items, loading, error, pagination, filters, actions } = useMachinesStore(
    useShallow((s) => ({
      items: s.items,
      loading: s.loading,
      error: s.error,
      pagination: s.pagination,
      filters: s.filters,
      actions: s.actions,
    }))
  )

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [pairModal, setPairModal] = useState<{ open: boolean; code?: string; expiresAt?: string; machineId?: string; humanId?: string }>({ open: false })

  const { register, handleSubmit, reset, control, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(CreateMachineSchema),
    defaultValues: { activateAfter: true },
  })

  useEffect(() => {
    void actions.fetch()
  }, [filters, actions])

  const statusOptions = useMemo(() => [
    { value: 'ALL', label: 'Все статусы' },
    { value: MachineStatus.WORKING, label: getStatusLabel(MachineStatus.WORKING) },
    { value: MachineStatus.LOW_STOCK, label: getStatusLabel(MachineStatus.LOW_STOCK) },
    { value: MachineStatus.OUT_OF_STOCK, label: getStatusLabel(MachineStatus.OUT_OF_STOCK) },
    { value: MachineStatus.IN_SERVICE, label: getStatusLabel(MachineStatus.IN_SERVICE) },
    { value: MachineStatus.ERROR, label: getStatusLabel(MachineStatus.ERROR) },
    { value: MachineStatus.INACTIVE, label: getStatusLabel(MachineStatus.INACTIVE) },
    { value: MachineStatus.UNPAIRED, label: getStatusLabel(MachineStatus.UNPAIRED) },
  ], [])

  const onSubmitCreate: SubmitHandler<CreateMachineForm> = async (data) => {
    const payload = {
      machineId: data.machineId,
      locationName: data.locationName,
      notes: data.notes,
    }
    await actions.create(payload, data.activateAfter)
    reset({ activateAfter: true })
    setIsCreateOpen(false)
  }

  const startPairing = async (id: string, humanId: string) => {
    try {
      const res = await machinesApi.pairingStart(id)
      setPairModal({ open: true, code: res.data.code, expiresAt: res.data.expiresAt, machineId: id, humanId })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось сгенерировать код')
    }
  }

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Автоматы</h1>
            <p className="mt-2 text-gray-600">Управление сетью вендинговых автоматов</p>
          </div>
          <div className="flex space-x-3">
            <Sheet open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <SheetTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Добавить автомат
                </Button>
              </SheetTrigger>
              <SheetContent side="right">
                <SheetHeader>
                  <SheetTitle>Новый автомат</SheetTitle>
                </SheetHeader>
                <form className="p-4 space-y-4" onSubmit={handleSubmit(onSubmitCreate)}>
                  <div>
                    <label className="block text-sm font-medium mb-1">ID автомата</label>
                    <input
                      type="text"
                      placeholder="Например: KZ-001"
                      className="w-full px-3 py-2 border rounded-md"
                      {...register('machineId')}
                    />
                    {errors.machineId && (
                      <p className="text-sm text-red-600 mt-1">{errors.machineId.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Название локации</label>
                    <Input
                      type="text"
                      placeholder="Например: БЦ Атакент, ресепшн"
                      {...register('locationName')}
                    />
                    {errors.locationName && (
                      <p className="text-sm text-red-600 mt-1">{errors.locationName.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Вместимость</label>
                    <p className="text-sm text-gray-700">80 (фиксировано)</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Заметка</label>
                    <textarea
                      className="w-full px-3 py-2 border rounded-md"
                      placeholder="Опционально"
                      rows={3}
                      {...register('notes')}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Controller
                      name="activateAfter"
                      control={control}
                      render={({ field }) => (
                        <>
                          <Checkbox
                            id="activateAfter"
                            checked={!!field.value}
                            onCheckedChange={(v) => field.onChange(Boolean(v))}
                          />
                          <Label htmlFor="activateAfter" className="text-sm">
                            Активировать (заполнить до полной вместимости)
                          </Label>
                        </>
                      )}
                    />
                  </div>
                  <SheetFooter>
                    <Button type="submit" disabled={isSubmitting}>Создать</Button>
                  </SheetFooter>
                </form>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      {/* Поиск и фильтры */}
      <div className="mb-6 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Поиск по ID автомата, заметкам, адресу/названию локации или ID локации..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={filters.search || ''}
            onChange={(e) => {
              const v = e.target.value
              const isObjectId = /^[a-f\d]{24}$/i.test(v)
              actions.setFilters({
                search: v,
                locationId: isObjectId ? v : undefined,
              })
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') void actions.fetch() }}
          />
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={filters.status ?? 'ALL'}
            onValueChange={(v) => actions.setFilters({ status: v === 'ALL' ? undefined : (v as MachineStatus) })}
          >
            <SelectTrigger className="min-w-56"><SelectValue placeholder="Статус" /></SelectTrigger>
            <SelectContent>
              {statusOptions.map((o) => (
                <SelectItem key={o.value || 'all'} value={String(o.value)}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="inline-flex items-center gap-2 text-sm">
            <Checkbox
              id="needsRefill"
              checked={Boolean(filters.needsRefill)}
              onCheckedChange={(v) => actions.setFilters({ needsRefill: v ? true : undefined })}
            />
            <Label htmlFor="needsRefill">Нуждается в пополнении</Label>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 text-red-600">{error}</div>
      )}

      {/* Loading / Empty / List */}
      {loading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                  <Skeleton className="h-6 w-24 rounded-full" />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
                <div className="flex space-x-2 pt-2">
                  <Skeleton className="h-9 w-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !loading && items.length === 0 ? (
        <div className="text-center py-16 border rounded-lg">
          <h3 className="text-lg font-semibold">Нет автоматов</h3>
          <p className="text-sm text-gray-600 mt-1">Добавьте первый автомат, чтобы начать управлять сетью.</p>
          <div className="mt-4 flex gap-2 justify-center">
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Добавить автомат
            </Button>
            <Button variant="outline" onClick={() => actions.fetch()} disabled={loading}>
              Обновить
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {items.map((machine) => (
            <Card key={String(machine._id)}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">Автомат #{machine.machineId}</CardTitle>
                    <CardDescription className="mt-1">
                      {machine.location ? (
                        <>
                          <div>{machine.location.name}</div>
                        </>
                      ) : (
                        'Локация не указана'
                      )}
                    </CardDescription>
                  </div>
                  <Badge variant={getStatusVariant(machine.status)}>
                    {getStatusLabel(machine.status)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Вместимость</p>
                    <p className="font-medium">{machine.capacity} шт</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Остаток</p>
                    <p className="font-medium">{machine.stock} шт ({machine.stockPercentage}%)</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Нуждается в пополнении</p>
                    <p className="font-medium">{machine.needsRefill ? 'Да' : 'Нет'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Статус</p>
                    <p className="font-medium">{getStatusLabel(machine.status)}</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {machine.status === MachineStatus.UNPAIRED && (
                    <Button
                      variant="default"
                      size="sm"
                      className="w-full"
                      onClick={() => startPairing(String(machine._id), machine.machineId)}
                    >
                      <Link2 className="h-4 w-4 mr-1" /> Сгенерировать код подключения
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={machine.stock >= machine.capacity || machine.status === MachineStatus.INACTIVE}
                    onClick={() => actions.activate(String(machine._id), machine.capacity)}
                  >
                    Заполнить до {machine.capacity}
                  </Button>
                  <div className="flex gap-2">
                    {machine.status === MachineStatus.INACTIVE ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1"
                        onClick={() => actions.setStatus(String(machine._id), MachineStatus.WORKING)}
                        title="Активировать"
                      >
                        <Power className="h-4 w-4 mr-1" /> Активировать
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => actions.setStatus(String(machine._id), MachineStatus.INACTIVE)}
                        title="Деактивировать"
                      >
                        <PowerOff className="h-4 w-4 mr-1" /> Деактивировать
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-destructive border-destructive hover:bg-destructive/10"
                          title="Удалить"
                        >
                          <Trash2 className="h-4 w-4 mr-1" /> Удалить
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Удалить автомат?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Действие необратимо. Будет удален автомат {machine.machineId}. Связанные записи (устройства) также будут очищены.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Отмена</AlertDialogCancel>
                          <AlertDialogAction onClick={() => void actions.remove(String(machine._id))}>
                            Удалить
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Пагинация */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <Button
            variant="outline"
            disabled={!pagination.hasPrev || loading}
            onClick={() => actions.fetch((pagination.page ?? 1) - 1, pagination.limit)}
          >
            Назад
          </Button>
          <span className="text-sm text-gray-600">Стр. {pagination.page} из {pagination.totalPages}</span>
          <Button
            variant="outline"
            disabled={!pagination.hasNext || loading}
            onClick={() => actions.fetch((pagination.page ?? 1) + 1, pagination.limit)}
          >
            Вперед
          </Button>
        </div>
      )}
      {/* Диалог с кодом пейринга */}
      <AlertDialog open={pairModal.open} onOpenChange={(o) => setPairModal((s) => ({ ...s, open: o }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Подключение автомата #{pairModal.humanId}</AlertDialogTitle>
            <AlertDialogDescription>
              Введите этот код на планшете в приложении в течение 5 минут.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="text-center py-4">
            <div className="text-4xl font-bold tracking-widest">{pairModal.code}</div>
            {pairModal.expiresAt && (
              <p className="text-sm text-gray-600 mt-2">Истекает: {new Date(pairModal.expiresAt).toLocaleTimeString()}</p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setPairModal({ open: false })}>Готово</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
