'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { useProductsStore } from '@/hooks/useProductsStore'
import { useShallow } from 'zustand/react/shallow'
import Image from 'next/image'
import { toast } from 'sonner'
import { Edit, Trash2, Search, Plus, Info } from 'lucide-react'

export default function ProductsPage() {
  const { items, loading, error, pagination, filters, actions } = useProductsStore(
    useShallow((s) => ({
      items: s.items,
      loading: s.loading,
      error: s.error,
      pagination: s.pagination,
      filters: s.filters,
      actions: s.actions,
    }))
  )

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [price, setPrice] = useState<string>('500')
  const [file, setFile] = useState<File | null>(null)

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPrice, setNewPrice] = useState<string>('500')
  const [newFile, setNewFile] = useState<File | null>(null)

  useEffect(() => { void actions.fetch() }, [filters.search, actions])

  const openEdit = (id: string, currentName: string, currentPrice?: number) => {
    setEditingId(id)
    setName(currentName)
    setPrice(typeof currentPrice === 'number' ? String(currentPrice) : '')
    setFile(null)
    setIsEditOpen(true)
  }
  const closeEdit = () => { setIsEditOpen(false); setEditingId(null); setFile(null) }

  const onSave = async () => {
    if (!editingId) return
    try {
      // validate image client-side
      if (file) {
        const allowed = ['image/png', 'image/jpeg']
        const MAX = 5 * 1024 * 1024
        if (!allowed.includes(file.type)) {
          toast.error('Допустимые форматы: PNG, JPEG')
          return
        }
        if (file.size > MAX) {
          toast.error('Размер файла не должен превышать 5 МБ')
          return
        }
      }
      const parsedPrice = Number(price)
      if (!price || !Number.isFinite(parsedPrice) || parsedPrice <= 0) {
        toast.error('Цена должна быть положительным числом')
        return
      }
      await actions.update(editingId, { name, price: Math.round(parsedPrice), imageFile: file ?? undefined })
      toast.success('Продукт обновлён')
      closeEdit()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка сохранения продукта')
    }
  }

  const onDelete = async (id: string) => {
    try {
      await actions.remove(id)
      toast.success('Продукт удалён')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка удаления продукта')
    }
  }

  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') void actions.fetch()
  }

  const onCreate = async () => {
    if (!newName.trim()) return
    try {
      if (newFile) {
        const allowed = ['image/png', 'image/jpeg']
        const MAX = 5 * 1024 * 1024
        if (!allowed.includes(newFile.type)) {
          toast.error('Допустимые форматы: PNG, JPEG')
          return
        }
        if (newFile.size > MAX) {
          toast.error('Размер файла не должен превышать 5 МБ')
          return
        }
      }
      const parsedNewPrice = Number(newPrice)
      if (!newPrice || !Number.isFinite(parsedNewPrice) || parsedNewPrice <= 0) {
        toast.error('Цена должна быть положительным числом')
        return
      }
      await actions.create({ name: newName.trim(), price: Math.round(parsedNewPrice), imageFile: newFile ?? undefined })
      toast.success('Продукт создан')
      setIsCreateOpen(false)
      setNewName('')
      setNewPrice('500')
      setNewFile(null)
      void actions.fetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка создания продукта')
    }
  }

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Продукты</h1>
          <p className="mt-2 text-muted-foreground">Список товаров, доступных для размещения в автоматах</p>
        </div>
        <Sheet open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <SheetTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Добавить продукт
            </Button>
          </SheetTrigger>
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>Новый продукт</SheetTitle>
            </SheetHeader>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Название</label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Введите название" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Цена, ₸</label>
                <Input type="number" min={1} step={1} value={newPrice} onChange={(e) => setNewPrice(e.target.value)} placeholder="Введите цену" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Изображение</label>
                <Input type="file" accept="image/png, image/jpeg" onChange={(e) => setNewFile(e.target.files?.[0] ?? null)} />
                <div className="rounded bg-muted p-2 mt-2 flex items-start gap-x-2">
                  <Info className="h-4 w-4" />
                  <p className="text-xs text-warning">Допустимые форматы: PNG, JPEG; <br /> Максимальный размер: 5 МБ.</p>
                </div>
                {newFile && (
                  <div className="relative mt-3 w-full aspect-square rounded-md overflow-hidden bg-muted">
                    <Image src={URL.createObjectURL(newFile)} alt="preview" fill className="object-cover" />
                  </div>
                )}
              </div>
            </div>
            <SheetFooter>
              <Button onClick={() => void onCreate()} disabled={loading || !newName.trim() || !newPrice}>Создать</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      {/* Поиск */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Поиск по названию продукта..."
            className="pl-10"
            value={filters.search || ''}
            onChange={(e) => actions.setFilters({ search: e.target.value })}
            onKeyDown={onSearchKey}
          />
        </div>
      </div>

      {error && <div className="mb-4 text-red-600">{error}</div>}

      {/* Список */}
      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent>
                <Skeleton className="aspect-square w-full rounded-md" />
                <div className="flex gap-2 mt-4">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 border rounded-lg">
          <h3 className="text-lg font-semibold">Нет продуктов</h3>
          <p className="text-sm text-muted-foreground mt-1">Добавьте продукты через кнопку «Добавить продукт»</p>
          <div className="mt-4">
            <Button variant="outline" onClick={() => actions.fetch()} disabled={loading}>Обновить</Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <Card key={p._id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{p.name}</CardTitle>
                <CardDescription>ID: {p._id}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative aspect-square w-full rounded-md overflow-hidden bg-muted">
                  {p.image ? (
                    <Image src={p.image} alt={p.name} fill className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">Нет изображения</div>
                  )}
                </div>
                <div className="mt-3 text-sm">Цена: <span className="font-semibold">{p.price} ₸</span></div>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" className="flex-1" onClick={() => openEdit(p._id, p.name, p.price)}>
                    <Edit className="h-4 w-4 mr-2" /> Редактировать
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="flex-1 text-destructive border-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4 mr-2" /> Удалить</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Удалить продукт?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Действие необратимо. Продукт будет удален из системы.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Отмена</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void onDelete(p._id)}>Удалить</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Пагинация */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <Button variant="outline" disabled={!pagination.hasPrev || loading} onClick={() => actions.fetch((pagination.page ?? 1) - 1, pagination.limit)}>
            Назад
          </Button>
          <span className="text-sm text-muted-foreground">Стр. {pagination.page} из {pagination.totalPages}</span>
          <Button variant="outline" disabled={!pagination.hasNext || loading} onClick={() => actions.fetch((pagination.page ?? 1) + 1, pagination.limit)}>
            Вперед
          </Button>
        </div>
      )}

      {/* Редактирование */}
      <Sheet open={isEditOpen} onOpenChange={setIsEditOpen}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Редактировать продукт</SheetTitle>
          </SheetHeader>
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Название</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Введите название" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Цена, ₸</label>
              <Input type="number" min={1} step={1} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Введите цену" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Изображение</label>
              <Input type="file" accept="image/png, image/jpeg" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <div className="rounded bg-muted p-2 mt-2 flex items-start gap-x-2">
                <Info className="h-4 w-4" />
                <p className="text-xs text-warning">Допустимые форматы: PNG, JPEG; <br /> Максимальный размер: 5 МБ.</p>
              </div>
              {file && (
                <div className="relative mt-3 w-full aspect-square rounded-md overflow-hidden bg-muted">
                  <Image src={URL.createObjectURL(file)} alt="preview" fill className="object-cover" />
                </div>
              )}
            </div>
          </div>
          <SheetFooter>
            <Button onClick={() => void onSave()} disabled={!editingId || loading || !price}>Сохранить</Button>
          </SheetFooter>
        </SheetContent>
        <SheetTrigger asChild>
          <span className="hidden" />
        </SheetTrigger>
      </Sheet>
    </div>
  )
}
