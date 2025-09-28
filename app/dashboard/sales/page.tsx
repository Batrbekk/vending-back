'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar as CalendarIcon, Download, Loader2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useSalesStore } from '@/hooks/useSalesStore'
import { useShallow } from 'zustand/react/shallow'
import { Calendar } from '@/components/ui/calendar'
import type { DateRange, SelectRangeEventHandler } from 'react-day-picker'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export default function SalesPage() {
  const { items, pagination, stats, loading, loadingStats, error, filters, actions } = useSalesStore(
    useShallow((s) => ({
      items: s.items,
      pagination: s.pagination,
      stats: s.stats,
      loading: s.loading,
      loadingStats: s.loadingStats,
      error: s.error,
      filters: s.filters,
      actions: s.actions,
    }))
  )

  const [openCalendar, setOpenCalendar] = useState(false)
  const [range, setRange] = useState<DateRange | undefined>(undefined)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    // Initial load with current month filter
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    
    const fromISO = startOfMonth.toISOString()
    const toISO = endOfMonth.toISOString()
    
    console.log('🗓️ Sales page - Setting current month filters:', { fromISO, toISO })
    
    actions.setFilters({ from: fromISO, to: toISO })
    
    setTimeout(() => {
      void actions.fetch()
      void actions.fetchStats()
    }, 100)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Update local range from filters on mount
    setRange(
      filters.from || filters.to
        ? {
            from: filters.from ? new Date(filters.from) : undefined,
            to: filters.to ? new Date(filters.to) : undefined,
          }
        : undefined
    )
  }, [filters.from, filters.to])

  useEffect(() => {
    if (items.length > 0) {
      console.log('Sales data:', items[0]);
    }
  }, [items])

  const totalRevenue = useMemo(() => stats?.totals.totalRevenue ?? 0, [stats])
  const totalSales = useMemo(() => stats?.totals.totalSales ?? 0, [stats])
  const avgOrder = useMemo(() => stats?.totals.avgOrderValue ?? 0, [stats])

  const onSelectRange: SelectRangeEventHandler = (r) => {
    applyRange(r)
  }

  const applyRange = (r?: DateRange) => {
    setRange(r)
    if (r?.from && r?.to) {
      const fromISO = new Date(r.from.getFullYear(), r.from.getMonth(), r.from.getDate(), 0, 0, 0).toISOString()
      const toISO = new Date(r.to.getFullYear(), r.to.getMonth(), r.to.getDate(), 23, 59, 59, 999).toISOString()
      actions.setFilters({ from: fromISO, to: toISO })
      void actions.fetch()
      void actions.fetchStats()
      setOpenCalendar(false)
    }
    if (!r?.from && !r?.to) {
      actions.setFilters({ from: undefined, to: undefined })
      void actions.fetch()
      void actions.fetchStats()
    }
  }

  const handleExport = async () => {
    try {
      setExporting(true)
      await actions.export()
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Продажи</h1>
            <p className="mt-2 text-gray-600">Аналитика и история продаж</p>
          </div>
          <div className="flex space-x-3">
            <div className="relative">
              <Button variant="outline" onClick={() => setOpenCalendar((v) => !v)}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                Период
              </Button>
              {openCalendar && (
                <div className="absolute right-0 mt-2 z-20 bg-white border rounded-md shadow-xl p-2">
                  <Calendar
                    mode="range"
                    numberOfMonths={2}
                    selected={range}
                    onSelect={onSelectRange}
                    locale={ru}
                  />
                  <div className="flex justify-end gap-2 p-2">
                    <Button variant="ghost" size="sm" onClick={() => applyRange(undefined)}>Сбросить</Button>
                    <Button variant="outline" size="sm" onClick={() => setOpenCalendar(false)}>Закрыть</Button>
                  </div>
                </div>
              )}
            </div>
            <Button onClick={() => void handleExport()} disabled={exporting || loading}>
              {exporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {exporting ? 'Экспорт...' : 'Экспорт'}
            </Button>
          </div>
        </div>
      </div>

      {error && <div className="mb-4 text-red-600">{error}</div>}

      {/* Статистика */}
      <div className="grid gap-6 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Общая выручка</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <>
                <Skeleton className="h-7 w-32" />
                <Skeleton className="h-3 w-40 mt-2" />
              </>
            ) : (
              <>
                <div className="text-2xl font-bold">{totalRevenue.toLocaleString('ru-RU')} ₸</div>
                <p className="text-xs text-muted-foreground">за выбранный период</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Количество продаж</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <>
                <Skeleton className="h-7 w-20" />
                <Skeleton className="h-3 w-40 mt-2" />
              </>
            ) : (
              <>
                <div className="text-2xl font-bold">{totalSales}</div>
                <p className="text-xs text-muted-foreground">за выбранный период</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Средний чек</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <>
                <Skeleton className="h-7 w-28" />
                <Skeleton className="h-3 w-40 mt-2" />
              </>
            ) : (
              <>
                <div className="text-2xl font-bold">{Math.round(avgOrder).toLocaleString('ru-RU')} ₸</div>
                <p className="text-xs text-muted-foreground">за выбранный период</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* График дневной выручки */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Динамика выручки</CardTitle>
          <CardDescription>
            {range?.from && range?.to
              ? `${format(range.from, 'dd MMM yyyy', { locale: ru })} — ${format(range.to, 'dd MMM yyyy', { locale: ru })}`
              : 'Последние дни'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingStats ? (
            <Skeleton className="h-[120px] w-full" />
          ) : (
            <ChartContainer config={{ revenue: { label: 'Выручка', color: '#3b82f6' } }}>
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={stats?.daily ?? []} margin={{ left: 12, right: 12, top: 10, bottom: 10 }}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 11, fill: '#6b7280' }} 
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 11, fill: '#6b7280' }} 
                    width={50}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="totalRevenue" 
                    stroke="#3b82f6" 
                    strokeWidth={3} 
                    fill="url(#revenueGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Список продаж */}
      <Card>
        <CardHeader>
          <CardTitle>Последние продажи</CardTitle>
          <CardDescription>
            История транзакций{range?.from && range?.to ? ` за период ${format(range.from, 'dd.MM.yyyy')}–${format(range.to, 'dd.MM.yyyy')}` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <Skeleton className="w-10 h-10 rounded-full" />
                      <div>
                        <Skeleton className="h-4 w-40 mb-2" />
                        <Skeleton className="h-3 w-56" />
                      </div>
                    </div>
                    <div className="text-right">
                      <Skeleton className="h-4 w-20 mb-2" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                    <Skeleton className="h-6 w-24" />
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="text-sm text-gray-600">Нет данных</div>
            ) : (
              items.map((sale) => (
                <div key={sale._id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="text-green-600 font-semibold text-sm">₸</span>
                    </div>
                    <div>
                      <p className="font-medium">{sale.productName || sale.sku}</p>
                      <p className="text-sm text-gray-500">Автомат #{sale.machine?.machineId || sale.machineId}</p>
                      {sale.machine?.location?.address && (
                        <p className="text-xs text-gray-500">{sale.machine.location.address}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{sale.total.toLocaleString('ru-RU')} ₸</p>
                    <p className="text-sm text-gray-500">{format(new Date(sale.paidAt), 'yyyy-MM-dd HH:mm')}</p>
                  </div>
                  <Badge variant="default">Завершена</Badge>
                </div>
              ))
            )}
          </div>
          {/* Пагинация */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
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
        </CardContent>
      </Card>
    </div>
  )
}
