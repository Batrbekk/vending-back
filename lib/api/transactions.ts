import { type ObjectIdString } from '@/lib/api/machines'

export type TransactionsListFilters = {
  machineId?: ObjectIdString
  from?: string // ISO date
  to?: string // ISO date
  page?: number
  limit?: number
}

export type TransactionItemDTO = {
  productId: string
  sku: string
  name: string
  price: number
  quantity: number
  subtotal: number
}

export type TransactionDTO = {
  _id: string
  machineId: string
  receiptNumber: number
  orderNumber: number
  items: TransactionItemDTO[]
  totalAmount: number
  paidAt: string
  paymentMethod?: string | null
  machine?: {
    _id: string
    machineId: string
    location?: { _id: string; name: string; address: string }
  }
}

export type TransactionsListResponse = {
  success: true
  data: {
    transactions: TransactionDTO[]
    pagination: {
      page: number
      limit: number
      totalCount: number
      totalPages: number
      hasNext: boolean
      hasPrev: boolean
    }
  }
}

export type TransactionsStatsResponse = {
  success: true
  data: {
    totals: {
      totalSales: number
      totalRevenue: number
      totalItems: number
      avgOrderValue: number
      uniqueMachinesCount: number
    }
    daily: Array<{
      date: string
      totalSales: number
      totalRevenue: number
      totalItems: number
    }>
  }
}

export class TransactionsApiClient {
  constructor(private baseUrl: string = '') {}
  private get headers(): HeadersInit { return { 'Content-Type': 'application/json' } }

  async list(filters: TransactionsListFilters = {}): Promise<TransactionsListResponse> {
    const params = new URLSearchParams()
    if (filters.machineId) params.set('machineId', filters.machineId)
    if (filters.from) params.set('from', filters.from)
    if (filters.to) params.set('to', filters.to)
    if (filters.page) params.set('page', String(filters.page))
    if (filters.limit) params.set('limit', String(filters.limit))

    const res = await fetch(`${this.baseUrl}/api/transactions?${params.toString()}`, { headers: this.headers })
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string }
      throw new Error(err.error || 'Ошибка загрузки транзакций')
    }
    return res.json() as Promise<TransactionsListResponse>
  }

  async stats(filters: Pick<TransactionsListFilters, 'from'|'to'|'machineId'> = {}): Promise<TransactionsStatsResponse> {
    const params = new URLSearchParams()
    if (filters.machineId) params.set('machineId', filters.machineId)
    if (filters.from) params.set('from', filters.from)
    if (filters.to) params.set('to', filters.to)

    const res = await fetch(`${this.baseUrl}/api/transactions/stats?${params.toString()}`, { headers: this.headers })
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string }
      throw new Error(err.error || 'Ошибка загрузки статистики')
    }
    return res.json() as Promise<TransactionsStatsResponse>
  }
}

export const transactionsApi = new TransactionsApiClient()
