import { type ObjectIdString } from '@/lib/api/machines'

export type SalesListFilters = {
  machineId?: ObjectIdString
  sku?: string
  from?: string // ISO date
  to?: string // ISO date
  page?: number
  limit?: number
}

export type SaleDTO = {
  _id: string
  machineId: string
  sku: string
  productName: string
  price: number
  qty: number
  total: number
  paidAt: string
  paymentMethod?: string | null
  receiptId?: string | null
  machine?: {
    _id: string
    machineId: string
    location?: { _id: string; name: string; address: string }
  }
}

export type SalesListResponse = {
  success: true
  data: { sales: SaleDTO[]; pagination: { page: number; limit: number; totalCount: number; totalPages: number; hasNext: boolean; hasPrev: boolean } }
}

export type SalesStatsResponse = {
  success: true
  data: {
    totals: { totalSales: number; totalRevenue: number; totalItems: number; avgOrderValue: number; uniqueMachinesCount: number }
    daily: Array<{ date: string; totalSales: number; totalRevenue: number; totalItems: number }>
    topProducts: Array<{ _id: string; totalSold: number; totalRevenue: number; salesCount: number; avgPrice: number }>
    machines: Array<{ _id: string; totalSales: number; totalRevenue: number; totalItems: number; avgOrderValue: number; lastSale: string; machine?: Array<{ _id: ObjectIdString; machineId: string; locationId?: ObjectIdString }>; location?: Array<{ _id: ObjectIdString; name: string; address: string }> }>
  }
}

export class SalesApiClient {
  constructor(private baseUrl: string = '') {}
  private get headers(): HeadersInit { return { 'Content-Type': 'application/json' } }

  async list(filters: SalesListFilters = {}): Promise<SalesListResponse> {
    const params = new URLSearchParams()
    if (filters.machineId) params.set('machineId', filters.machineId)
    if (filters.sku) params.set('sku', filters.sku)
    if (filters.from) params.set('from', filters.from)
    if (filters.to) params.set('to', filters.to)
    if (filters.page) params.set('page', String(filters.page))
    if (filters.limit) params.set('limit', String(filters.limit))

    const res = await fetch(`${this.baseUrl}/api/sales?${params.toString()}`, { headers: this.headers })
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string }
      throw new Error(err.error || 'Ошибка загрузки продаж')
    }
    return res.json() as Promise<SalesListResponse>
  }

  async stats(filters: Pick<SalesListFilters, 'from'|'to'|'machineId'> = {}): Promise<SalesStatsResponse> {
    const params = new URLSearchParams()
    if (filters.machineId) params.set('machineId', filters.machineId)
    if (filters.from) params.set('from', filters.from)
    if (filters.to) params.set('to', filters.to)

    const res = await fetch(`${this.baseUrl}/api/sales/stats?${params.toString()}`, { headers: this.headers })
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string }
      throw new Error(err.error || 'Ошибка загрузки статистики')
    }
    return res.json() as Promise<SalesStatsResponse>
  }

  async export(filters: SalesListFilters = {}): Promise<Blob> {
    const params = new URLSearchParams()
    if (filters.machineId) params.set('machineId', filters.machineId)
    if (filters.sku) params.set('sku', filters.sku)
    if (filters.from) params.set('from', filters.from)
    if (filters.to) params.set('to', filters.to)

    const res = await fetch(`${this.baseUrl}/api/sales/export?${params.toString()}`, {
      headers: this.headers,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string }
      throw new Error(err.error || 'Ошибка экспорта продаж')
    }
    return res.blob()
  }
}

export const salesApi = new SalesApiClient()
