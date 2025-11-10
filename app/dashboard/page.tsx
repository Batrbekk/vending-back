'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { CheckCircle2, AlertTriangle, XCircle, Wrench, CreditCard, ShoppingCart, Receipt, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react'
import { useMachinesStore } from '@/hooks/useMachinesStore'
import { useTransactionsStore } from '@/hooks/useTransactionsStore'
import { useProductsStore } from '@/hooks/useProductsStore'
import { useShallow } from 'zustand/react/shallow'
import { Skeleton } from '@/components/ui/skeleton'
import { MachineStatus } from '@/types'

export default function DashboardPage() {
  const { isAuthenticated } = useAuthStore()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  // stores
  const { items: machines, loading: machinesLoading, actions: machinesActions } = useMachinesStore(
    useShallow((s) => ({ items: s.items, loading: s.loading, actions: s.actions }))
  )
  const {
    items: transactionsItems,
    stats: transactionsStats,
    loading: transactionsLoading,
    loadingStats: transactionsStatsLoading,
    actions: transactionsActions,
  } = useTransactionsStore(
    useShallow((s) => ({ items: s.items, stats: s.stats, loading: s.loading, loadingStats: s.loadingStats, actions: s.actions }))
  )
  const [expandedTransactions, setExpandedTransactions] = useState<Set<string>>(new Set())
  const { items: products, loading: productsLoading, actions: productsActions } = useProductsStore(
    useShallow((s) => ({ items: s.items, loading: s.loading, actions: s.actions }))
  )

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted && !isAuthenticated) {
      console.log('❌ User not authenticated, redirecting to login')
      router.push('/')
    }
  }, [mounted, isAuthenticated, router])

  // initial data load (brief summaries)
  useEffect(() => {
    if (!mounted || !isAuthenticated) return
    
    // Устанавливаем фильтр на текущий месяц для статистики
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    
    const fromISO = startOfMonth.toISOString()
    const toISO = endOfMonth.toISOString()
    
    console.log('🗓️ Setting current month filters:', { fromISO, toISO })
    
    // Устанавливаем фильтры и затем загружаем данные
    transactionsActions.setFilters({ from: fromISO, to: toISO })

    // Загружаем данные
    void machinesActions.fetch(1, 50)
    void transactionsActions.fetch(1, 5)
    void productsActions.fetch(1, 50)

    // Загружаем статистику после установки фильтров
    setTimeout(() => {
      void transactionsActions.fetchStats()
    }, 100)
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, isAuthenticated])

  const machineCounts = useMemo(() => {
    const counts = {
      total: machines.length,
      working: 0,
      low: 0,
      out: 0,
      service: 0,
      needsRefill: 0,
    }
    for (const m of machines) {
      if (m.needsRefill) counts.needsRefill += 1
      switch (m.status) {
        case MachineStatus.WORKING: counts.working += 1; break
        case MachineStatus.LOW_STOCK: counts.low += 1; break
        case MachineStatus.OUT_OF_STOCK: counts.out += 1; break
        case MachineStatus.IN_SERVICE: counts.service += 1; break
      }
    }
    return counts
  }, [machines])

  const totalRevenue = useMemo(() => transactionsStats?.totals.totalRevenue ?? 0, [transactionsStats])
  const totalSales = useMemo(() => transactionsStats?.totals.totalSales ?? 0, [transactionsStats])
  const avgOrder = useMemo(() => transactionsStats?.totals.avgOrderValue ?? 0, [transactionsStats])

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

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Загрузка...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Перенаправление на страницу входа...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Добро пожаловать!</h1>
          <p className="mt-2 text-muted-foreground">Управляйте вашими вендинговыми автоматами из единого интерфейса</p>
        </div>

        {/* Верхняя сетка метрик и сводок */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Работают */}
          <Card className="hover:shadow-sm transition">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Работают</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              {machinesLoading ? (
                <Skeleton className="h-7 w-10" />
              ) : (
                <div className="text-2xl font-bold text-green-600">{machineCounts.working}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">активные автоматы</p>
            </CardContent>
          </Card>

          {/* Низкий запас */}
          <Card className="hover:shadow-sm transition">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Низкий запас</CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              {machinesLoading ? (
                <Skeleton className="h-7 w-10" />
              ) : (
                <div className="text-2xl font-bold text-yellow-600">{machineCounts.low}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">требует внимания</p>
            </CardContent>
          </Card>

          {/* Нет товара */}
          <Card className="hover:shadow-sm transition">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Нет товара</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              {machinesLoading ? (
                <Skeleton className="h-7 w-10" />
              ) : (
                <div className="text-2xl font-bold text-red-600">{machineCounts.out}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">нужны поставки</p>
            </CardContent>
          </Card>

          {/* Обслуживание */}
          <Card className="hover:shadow-sm transition">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Обслуживание</CardTitle>
              <Wrench className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              {machinesLoading ? (
                <Skeleton className="h-7 w-10" />
              ) : (
                <div className="text-2xl font-bold text-blue-600">{machineCounts.service}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">в процессе</p>
            </CardContent>
          </Card>
        </div>

        {/* Второй ряд: сводка продаж + быстрые действия */}
        <div className="grid gap-6 md:grid-cols-2 mt-6">
          <Card className="hover:shadow-sm transition">
            <CardHeader>
              <CardTitle>Сводка продаж</CardTitle>
              <CardDescription>Коротко за период</CardDescription>
            </CardHeader>
            <CardContent>
              {transactionsStatsLoading ? (
                <div className="grid gap-4 sm:grid-cols-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="p-3 rounded-md border">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>Выручка</span>
                      <CreditCard className="h-4 w-4" />
                    </div>
                    <div className="mt-1 text-xl font-semibold">{totalRevenue.toLocaleString('ru-RU')} ₸</div>
                  </div>
                  <div className="p-3 rounded-md border">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>Количество</span>
                      <ShoppingCart className="h-4 w-4" />
                    </div>
                    <div className="mt-1 text-xl font-semibold">{totalSales}</div>
                  </div>
                  <div className="p-3 rounded-md border">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>Средний чек</span>
                      <Receipt className="h-4 w-4" />
                    </div>
                    <div className="mt-1 text-xl font-semibold">{Math.round(avgOrder).toLocaleString('ru-RU')} ₸</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Быстрые действия */}
          <Card className="hover:shadow-sm transition">
            <CardHeader>
              <CardTitle>Быстрые действия</CardTitle>
              <CardDescription>Часто используемые функции</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Link href="/dashboard/machines">
                  <Button variant="outline" className="group">
                    Автоматы <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-0.5 transition" />
                  </Button>
                </Link>
                <Link href="/dashboard/products">
                  <Button variant="outline" className="group">
                    Продукты <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-0.5 transition" />
                  </Button>
                </Link>
                <Link href="/dashboard/sales">
                  <Button variant="outline" className="group">
                    Продажи <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-0.5 transition" />
                  </Button>
                </Link>
                <Link href="/dashboard/managers">
                  <Button variant="outline" className="group">
                    Менеджеры <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-0.5 transition" />
                  </Button>
                </Link>
              </div>
              {!machinesLoading && (
                <p className="text-xs text-muted-foreground">Нуждаются в пополнении: <span className="font-medium">{machineCounts.needsRefill}</span></p>
              )}
              {!productsLoading && (
                <p className="text-xs text-muted-foreground">Продуктов всего: <span className="font-medium">{products.length}</span></p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Последние события (продажи кратко) */}
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Последние события</CardTitle>
              <CardDescription>Недавние продажи</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {transactionsLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="flex items-center justify-between p-4 border rounded-lg hover:shadow-sm transition">
                        <div className="flex items-center gap-4">
                          <Skeleton className="w-10 h-10 rounded-full" />
                          <div>
                            <Skeleton className="h-4 w-40 mb-2" />
                            <Skeleton className="h-3 w-56" />
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <Skeleton className="h-4 w-20 mb-2" />
                            <Skeleton className="h-3 w-28" />
                          </div>
                          <Badge variant="default">Завершена</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : transactionsItems.length === 0 ? (
                  <div className="text-sm text-gray-600">Нет данных</div>
                ) : (
                  transactionsItems.slice(0, 5).map((transaction) => {
                    const isExpanded = expandedTransactions.has(transaction._id)
                    return (
                      <div key={transaction._id} className="border rounded-lg overflow-hidden">
                        <button
                          onClick={() => toggleTransaction(transaction._id)}
                          className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                              <span className="text-green-600 font-semibold text-xs">₸</span>
                            </div>
                            <div className="text-left">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm">Заказ #{transaction.orderNumber}</p>
                                <span className="text-xs text-muted-foreground">• Чек #{transaction.receiptNumber}</span>
                              </div>
                              <p className="text-xs text-muted-foreground">Автомат #{transaction.machine?.machineId || transaction.machineId}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="font-semibold text-sm">{transaction.totalAmount.toLocaleString('ru-RU')} ₸</p>
                              <p className="text-xs text-muted-foreground">{new Date(transaction.paidAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-gray-400" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-gray-400" />
                            )}
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="border-t bg-gray-50 p-3">
                            <div className="space-y-2">
                              {transaction.items.map((item, index) => (
                                <div key={index} className="flex items-center justify-between bg-white p-2 rounded text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className="w-6 h-6 bg-gray-100 rounded flex items-center justify-center text-xs font-medium">{item.quantity}x</span>
                                    <span className="font-medium">{item.name}</span>
                                  </div>
                                  <span className="font-semibold">{item.subtotal.toLocaleString('ru-RU')} ₸</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>
    </div>
  )
}
