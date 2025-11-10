'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar as CalendarIcon, ChevronDown, ChevronUp } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useTransactionsStore } from '@/hooks/useTransactionsStore'
import { useShallow } from 'zustand/react/shallow'
import { Calendar } from '@/components/ui/calendar'
import type { DateRange, SelectRangeEventHandler } from 'react-day-picker'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { ChartContainer } from '@/components/ui/chart'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { TransactionDTO } from '@/lib/api/transactions'

export default function SalesPage() {
  const { items, pagination, stats, loading, loadingStats, error, filters, actions } = useTransactionsStore(
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
  const [expandedTransactions, setExpandedTransactions] = useState<Set<string>>(new Set())

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

  const toggleTransaction = (transactionId: string) => {
    setExpandedTransactions((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(transactionId)) {
        newSet.delete(transactionId)
      } else {
        newSet.add(transactionId)
      }
      return newSet
    })
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
            <Skeleton className="h-[200px] w-full" />
          ) : (
            <ChartContainer config={{
              revenue: { label: 'Выручка', color: '#3b82f6' }
            }}>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={stats?.daily ?? []} margin={{ left: 0, right: 0, top: 5, bottom: 5 }}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8}/>
                      <stop offset="50%" stopColor="#3b82f6" stopOpacity={0.4}/>
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.3} vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      return format(date, 'dd.MM', { locale: ru });
                    }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    width={50}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => {
                      if (value >= 1000) return `${Math.round(value / 1000)}k`;
                      return value;
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.98)',
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                      padding: '12px 16px'
                    }}
                    labelStyle={{
                      color: '#111827',
                      fontWeight: 600,
                      marginBottom: '4px'
                    }}
                    labelFormatter={(value) => {
                      const date = new Date(value);
                      return format(date, 'dd MMMM yyyy', { locale: ru });
                    }}
                    formatter={(value: any) => {
                      return [`${Number(value).toLocaleString('ru-RU')} ₸`, 'Выручка'];
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="totalRevenue"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    fill="url(#revenueGradient)"
                    name="Выручка"
                    animationDuration={800}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Список транзакций */}
      <Card>
        <CardHeader>
          <CardTitle>Последние транзакции</CardTitle>
          <CardDescription>
            История продаж{range?.from && range?.to ? ` за период ${format(range.from, 'dd.MM.yyyy')}–${format(range.to, 'dd.MM.yyyy')}` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="border rounded-lg p-4">
                    <Skeleton className="h-5 w-full mb-2" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="text-sm text-gray-600">Нет данных</div>
            ) : (
              items.map((transaction) => {
                const isExpanded = expandedTransactions.has(transaction._id)
                return (
                  <div key={transaction._id} className="border rounded-lg overflow-hidden">
                    {/* Accordion Header */}
                    <button
                      onClick={() => toggleTransaction(transaction._id)}
                      className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                          <span className="text-green-600 font-semibold text-sm">₸</span>
                        </div>
                        <div className="text-left">
                          <div className="flex items-center gap-3 mb-1">
                            <p className="font-semibold text-gray-900">Заказ #{transaction.orderNumber}</p>
                            <span className="text-sm text-gray-500">•</span>
                            <p className="text-sm text-gray-600">Чек #{transaction.receiptNumber}</p>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-gray-500">
                            <span>Автомат #{transaction.machine?.machineId || transaction.machineId}</span>
                            {transaction.machine?.location?.address && (
                              <>
                                <span>•</span>
                                <span className="text-xs">{transaction.machine.location.address}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-bold text-lg text-gray-900">{transaction.totalAmount.toLocaleString('ru-RU')} ₸</p>
                          <p className="text-sm text-gray-500">{format(new Date(transaction.paidAt), 'dd.MM.yyyy HH:mm')}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="default">Завершена</Badge>
                          {isExpanded ? (
                            <ChevronUp className="h-5 w-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-gray-400" />
                          )}
                        </div>
                      </div>
                    </button>

                    {/* Accordion Content */}
                    {isExpanded && (
                      <div className="border-t bg-gray-50 p-4">
                        <h4 className="font-semibold text-sm text-gray-700 mb-3">Товары в заказе:</h4>
                        <div className="space-y-2">
                          {transaction.items.map((item, index) => (
                            <div key={index} className="flex items-center justify-between bg-white p-3 rounded-md">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center">
                                  <span className="text-xs font-medium text-gray-600">{item.quantity}x</span>
                                </div>
                                <div>
                                  <p className="font-medium text-sm text-gray-900">{item.name}</p>
                                  <p className="text-xs text-gray-500">{item.price.toLocaleString('ru-RU')} ₸ за шт.</p>
                                </div>
                              </div>
                              <p className="font-semibold text-gray-900">{item.subtotal.toLocaleString('ru-RU')} ₸</p>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-700">Итого:</span>
                          <span className="text-lg font-bold text-gray-900">{transaction.totalAmount.toLocaleString('ru-RU')} ₸</span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
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
