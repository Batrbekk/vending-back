import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { salesApi, type SaleDTO, type SalesListResponse, type SalesStatsResponse } from '@/lib/api/sales'

export type SalesFiltersState = {
  machineId?: string
  sku?: string
  from?: string // ISO
  to?: string   // ISO
}

export type SalesState = {
  items: SaleDTO[]
  pagination: SalesListResponse['data']['pagination'] | null
  stats: SalesStatsResponse['data'] | null
  loading: boolean
  loadingStats: boolean
  error: string | null
  filters: SalesFiltersState
}

export type SalesActions = {
  setFilters: (patch: Partial<SalesFiltersState>) => void
  fetch: (page?: number, limit?: number) => Promise<void>
  fetchStats: () => Promise<void>
  export: () => Promise<void>
}

export type SalesStore = SalesState & { actions: SalesActions }

const initialState: SalesState = {
  items: [],
  pagination: null,
  stats: null,
  loading: false,
  loadingStats: false,
  error: null,
  filters: {},
}

export const useSalesStore = create<SalesStore>()(
  devtools((set, get) => ({
    ...initialState,
    actions: {
      setFilters: (patch) => set((state) => ({ filters: { ...state.filters, ...patch } }), false, 'sales:setFilters'),

      fetch: async (page = 1, limit = 20) => {
        set({ loading: true, error: null }, false, 'sales:fetch:start')
        try {
          const { filters } = get()
          const res = await salesApi.list({ ...filters, page, limit })
          set({ items: res.data.sales, pagination: res.data.pagination, loading: false }, false, 'sales:fetch:success')
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Ошибка загрузки продаж'
          set({ loading: false, error: message }, false, 'sales:fetch:error')
        }
      },

      fetchStats: async () => {
        set({ loadingStats: true, error: null }, false, 'sales:stats:start')
        try {
          const { filters } = get()
          const res = await salesApi.stats({ from: filters.from, to: filters.to, machineId: filters.machineId })
          set({ stats: res.data, loadingStats: false }, false, 'sales:stats:success')
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Ошибка загрузки статистики'
          set({ loadingStats: false, error: message }, false, 'sales:stats:error')
        }
      },

      export: async () => {
        try {
          const { filters } = get()
          const blob = await salesApi.export(filters)
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = 'sales_export.xlsx'
          document.body.appendChild(a)
          a.click()
          a.remove()
          URL.revokeObjectURL(url)
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Ошибка экспорта'
          set({ error: message }, false, 'sales:export:error')
        }
      },
    },
  }))
)
