'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import Image from 'next/image'
import { toast } from 'sonner'
import { machinesApi, MachineDTO, SlotAssignments } from '@/lib/api/machines'
import { productsApi, ProductDTO } from '@/lib/api/products'
import { X } from 'lucide-react'

const ROWS = 6
const COLS = 6
const PER_SLOT_CAPACITY = 5

interface MachineSlotsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  machine: MachineDTO | null
  onSaved?: (updated: MachineDTO) => void
}

/**
 * Визуальный редактор слотов автомата.
 * Сетка 6×6 (36 слотов, 5 банок в каждом). Слева — сетка-дроп-зона, справа —
 * список продуктов. Тащишь продукт на слот → слот закрашивается. Один продукт
 * можно перетащить на несколько слотов (физически загружено больше банок,
 * чем влезает в один). Клик на слот с продуктом — освобождает его.
 *
 * Хранение: slot-keyed карта { "row-column": productId }. Сохраняем целиком
 * один PATCH-запросом — что прислали, то и стало.
 */
export function MachineSlotsSheet({ open, onOpenChange, machine, onSaved }: MachineSlotsSheetProps) {
  const [products, setProducts] = useState<ProductDTO[]>([])
  const [assignments, setAssignments] = useState<SlotAssignments>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  )

  // Загружаем список продуктов при открытии
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    productsApi
      .list({ limit: 100 })
      .then((res) => {
        if (cancelled) return
        setProducts(res.data.products)
      })
      .catch((e) => {
        if (cancelled) return
        toast.error(e instanceof Error ? e.message : 'Не удалось загрузить продукты')
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [open])

  // Подтягиваем текущие slotAssignments при открытии конкретной машины
  useEffect(() => {
    if (!machine) return
    setAssignments((machine.slotAssignments as SlotAssignments) ?? {})
  }, [machine])

  const productsById = useMemo(() => {
    const m = new Map<string, ProductDTO>()
    for (const p of products) m.set(p._id, p)
    return m
  }, [products])

  // Сколько слотов занимает каждый продукт (для бейджа в правом списке)
  const slotsCountByProduct = useMemo(() => {
    const c: Record<string, number> = {}
    for (const pid of Object.values(assignments)) c[pid] = (c[pid] ?? 0) + 1
    return c
  }, [assignments])

  const onDragStart = (e: DragStartEvent) => {
    setActiveDragId(String(e.active.id))
  }

  const onDragEnd = (e: DragEndEvent) => {
    setActiveDragId(null)
    const { active, over } = e
    if (!over) return
    const productId = String(active.id).replace(/^product:/, '')
    const slotKey = String(over.id).replace(/^slot:/, '')
    setAssignments((prev) => ({ ...prev, [slotKey]: productId }))
  }

  const clearSlot = (key: string) => {
    setAssignments((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const clearAll = () => setAssignments({})

  const handleSave = async () => {
    if (!machine) return
    setSaving(true)
    try {
      const res = await machinesApi.update(machine._id, { slotAssignments: assignments })
      toast.success('Слоты сохранены')
      onSaved?.(res.data.machine)
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось сохранить слоты')
    } finally {
      setSaving(false)
    }
  }

  const machineLabel = machine
    ? `${machine.machineId}${machine.location ? ` · ${machine.location.name}` : ''}`
    : ''

  const totalAssigned = Object.keys(assignments).length
  const totalCapacity = ROWS * COLS * PER_SLOT_CAPACITY // 180 банок

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/*
        Центрированный диалог. Высота фиксированно до 90vh, чтобы кнопка
        «Сохранить» всегда была на виду — а внутреннее тело скроллится
        отдельно, если контента больше, чем влезло.
      */}
      <DialogContent className="w-[95vw] sm:max-w-6xl xl:max-w-7xl max-h-[90vh] p-0 flex flex-col gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3 border-b">
          <DialogTitle>Слоты автомата · {machineLabel}</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Сетка 6 × 6 = 36 слотов. В каждый слот {PER_SLOT_CAPACITY} банок одного вкуса.
            Перетащи продукт справа на любой слот — один продукт можно положить в несколько слотов.
            Клик по занятому слоту освобождает его.
          </p>
        </DialogHeader>

        {/* Тело диалога: скроллится, если высоты не хватает */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              Назначено: <b className="text-foreground">{totalAssigned}</b> / {ROWS * COLS} ·
              Вместимость: <b className="text-foreground">{totalAssigned * PER_SLOT_CAPACITY}</b> / {totalCapacity} банок
            </div>
            <Button variant="ghost" size="sm" onClick={clearAll} disabled={totalAssigned === 0}>
              Очистить всё
            </Button>
          </div>

          {loading ? (
            <div className="grid grid-cols-[1fr_240px] gap-6">
              <Skeleton className="h-[420px] w-full" />
              <Skeleton className="h-[420px] w-full" />
            </div>
          ) : (
            <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
              <div className="grid grid-cols-[1fr_260px] gap-6">
                {/* Сетка слотов */}
                <div className="rounded-xl border bg-muted/30 p-4 flex justify-center">
                  <div
                    className="grid gap-3"
                    style={{ gridTemplateColumns: `repeat(${COLS}, 84px)` }}
                  >
                    {Array.from({ length: ROWS }).flatMap((_, r) =>
                      Array.from({ length: COLS }).map((__, c) => {
                        const row = r + 1
                        const column = c + 1
                        const key = `${row}-${column}`
                        const productId = assignments[key]
                        const product = productId ? productsById.get(productId) : undefined
                        return (
                          <SlotCircle
                            key={key}
                            slotKey={key}
                            row={row}
                            column={column}
                            product={product}
                            onClear={() => clearSlot(key)}
                          />
                        )
                      })
                    )}
                  </div>
                </div>

                {/* Список продуктов */}
                <div className="rounded-xl border p-3 space-y-2 self-start">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-2 pb-1">
                    Продукты — тащи на слот
                  </div>
                  {products.map((p) => (
                    <DraggableProduct
                      key={p._id}
                      product={p}
                      slotsCount={slotsCountByProduct[p._id] ?? 0}
                    />
                  ))}
                </div>
              </div>

              <DragOverlay dropAnimation={null}>
                {activeDragId
                  ? (() => {
                      const pid = activeDragId.replace(/^product:/, '')
                      const p = productsById.get(pid)
                      return p ? <ProductChip product={p} dragging /> : null
                    })()
                  : null}
              </DragOverlay>
            </DndContext>
          )}
        </div>

        {/* Закреплённый снизу футер — всегда виден */}
        <DialogFooter className="px-6 py-4 border-t bg-background sm:justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? 'Сохраняем…' : 'Сохранить слоты'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// --- Sub-components ---

function SlotCircle({
  slotKey,
  row,
  column,
  product,
  onClear,
}: {
  slotKey: string
  row: number
  column: number
  product?: ProductDTO
  onClear: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot:${slotKey}` })
  const filled = !!product

  return (
    <div
      ref={setNodeRef}
      className={[
        'relative aspect-square rounded-full border-2 transition-all flex items-center justify-center',
        filled
          ? 'border-violet-500 bg-violet-50'
          : 'border-dashed border-muted-foreground/30 bg-background',
        isOver ? 'ring-4 ring-violet-300 scale-105' : '',
      ].join(' ')}
      title={`Ряд ${row}, Колонка ${column}`}
    >
      {filled && product ? (
        <button
          type="button"
          onClick={onClear}
          className="size-full rounded-full overflow-hidden flex items-center justify-center group relative"
          title="Кликни, чтобы освободить слот"
        >
          {product.image ? (
            <Image
              src={product.image}
              alt={product.name}
              width={64}
              height={64}
              className="size-3/4 object-contain"
            />
          ) : (
            <span className="text-xs font-semibold text-violet-700 px-1 text-center line-clamp-2">
              {product.name}
            </span>
          )}
          <span className="absolute inset-0 rounded-full bg-violet-900/70 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
            <X className="size-5" />
          </span>
        </button>
      ) : (
        <span className="text-xs text-muted-foreground/60 select-none">
          {row}·{column}
        </span>
      )}
    </div>
  )
}

function DraggableProduct({ product, slotsCount }: { product: ProductDTO; slotsCount: number }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `product:${product._id}`,
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.3 : 1,
      }}
      className="cursor-grab active:cursor-grabbing touch-none"
    >
      <ProductChip product={product} slotsCount={slotsCount} />
    </div>
  )
}

function ProductChip({
  product,
  slotsCount = 0,
  dragging = false,
}: {
  product: ProductDTO
  slotsCount?: number
  dragging?: boolean
}) {
  return (
    <div
      className={[
        'flex items-center gap-3 rounded-lg border bg-background p-2.5 select-none',
        dragging ? 'shadow-lg ring-2 ring-violet-400' : 'hover:bg-muted/40',
      ].join(' ')}
    >
      <div className="size-10 shrink-0 overflow-hidden rounded-md bg-muted">
        {product.image ? (
          <Image src={product.image} alt={product.name} width={40} height={40} className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-xs text-muted-foreground">—</div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{product.name}</div>
        <div className="text-xs text-muted-foreground">{product.price} ₸</div>
      </div>
      {slotsCount > 0 && (
        <span className="rounded-full bg-violet-100 text-violet-700 text-xs font-semibold px-2 py-0.5">
          {slotsCount}
        </span>
      )}
    </div>
  )
}
