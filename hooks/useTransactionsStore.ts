import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { transactionsApi, type TransactionDTO, type TransactionsListResponse, type TransactionsStatsResponse } from '@/lib/api/transactions'

export type TransactionsFiltersState = {
  machineId?: string
  from?: string // ISO
  to?: string   // ISO
}

export type TransactionsState = {
  items: TransactionDTO[]
  pagination: TransactionsListResponse['data']['pagination'] | null
  stats: TransactionsStatsResponse['data'] | null
  loading: boolean
  loadingStats: boolean
  error: string | null
  filters: TransactionsFiltersState
}

export type TransactionsActions = {
  setFilters: (patch: Partial<TransactionsFiltersState>) => void
  fetch: (page?: number, limit?: number) => Promise<void>
  fetchStats: () => Promise<void>
}

export type TransactionsStore = TransactionsState & { actions: TransactionsActions }

const initialState: TransactionsState = {
  items: [],
  pagination: null,
  stats: null,
  loading: false,
  loadingStats: false,
  error: null,
  filters: {},
}

export const useTransactionsStore = create<TransactionsStore>()(
  devtools((set, get) => ({
    ...initialState,
    actions: {
      setFilters: (patch) => set((state) => ({ filters: { ...state.filters, ...patch } }), false, 'transactions:setFilters'),

      fetch: async (page = 1, limit = 20) => {
        set({ loading: true, error: null }, false, 'transactions:fetch:start')
        try {
          const { filters } = get()
          const res = await transactionsApi.list({ ...filters, page, limit })
          set({ items: res.data.transactions, pagination: res.data.pagination, loading: false }, false, 'transactions:fetch:success')
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Ошибка загрузки транзакций'
          set({ loading: false, error: message }, false, 'transactions:fetch:error')
        }
      },

      fetchStats: async () => {
        set({ loadingStats: true, error: null }, false, 'transactions:stats:start')
        try {
          const { filters } = get()
          const res = await transactionsApi.stats({ from: filters.from, to: filters.to, machineId: filters.machineId })
          set({ stats: res.data, loadingStats: false }, false, 'transactions:stats:success')
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Ошибка загрузки статистики'
          set({ loadingStats: false, error: message }, false, 'transactions:stats:error')
        }
      },
    },
  }))
)
