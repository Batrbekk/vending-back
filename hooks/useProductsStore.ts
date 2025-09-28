import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { productsApi, type ProductDTO, type ProductsListResponse } from '@/lib/api/products'

export type ProductsFiltersState = {
  search?: string
}

export type ProductsState = {
  items: ProductDTO[]
  pagination: ProductsListResponse['data']['pagination'] | null
  loading: boolean
  error: string | null
  filters: ProductsFiltersState
}

export type ProductsActions = {
  setFilters: (patch: Partial<ProductsFiltersState>) => void
  fetch: (page?: number, limit?: number) => Promise<void>
  update: (id: string, data: { name?: string; price?: number; imageFile?: File | null; image?: string }) => Promise<ProductDTO>
  remove: (id: string) => Promise<void>
  create: (data: { name: string; price: number; imageFile?: File | null; image?: string }) => Promise<ProductDTO>
}

export type ProductsStore = ProductsState & { actions: ProductsActions }

const initialState: ProductsState = {
  items: [],
  pagination: null,
  loading: false,
  error: null,
  filters: {},
}

export const useProductsStore = create<ProductsStore>()(
  devtools((set, get) => ({
    ...initialState,
    actions: {
      setFilters: (patch) => set((state) => ({ filters: { ...state.filters, ...patch } }), false, 'products:setFilters'),

      fetch: async (page = 1, limit = 20) => {
        set({ loading: true, error: null }, false, 'products:fetch:start')
        try {
          const { filters } = get()
          const res = await productsApi.list({ search: filters.search, page, limit })
          set({ items: res.data.products, pagination: res.data.pagination, loading: false }, false, 'products:fetch:success')
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Ошибка загрузки продуктов'
          set({ loading: false, error: message }, false, 'products:fetch:error')
        }
      },

      update: async (id, data) => {
        set({ loading: true, error: null }, false, 'products:update:start')
        try {
          const res = await productsApi.update(id, data)
          const updated = res.data.product
          set((state) => ({
            items: state.items.map((p) => (p._id === id ? updated : p)),
            loading: false,
          }), false, 'products:update:success')
          return updated
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Ошибка сохранения продукта'
          set({ loading: false, error: message }, false, 'products:update:error')
          throw e
        }
      },

      remove: async (id) => {
        set({ loading: true, error: null }, false, 'products:remove:start')
        try {
          await productsApi.remove(id)
          set((state) => ({ items: state.items.filter((p) => p._id !== id), loading: false }), false, 'products:remove:success')
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Ошибка удаления продукта'
          set({ loading: false, error: message }, false, 'products:remove:error')
          throw e
        }
      },

      create: async (data) => {
        set({ loading: true, error: null }, false, 'products:create:start')
        try {
          const res = await productsApi.create(data)
          const created = res.data.product
          // refresh list
          const { pagination } = get()
          await get().actions.fetch(pagination?.page ?? 1, pagination?.limit ?? 20)
          set({ loading: false }, false, 'products:create:success')
          return created
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Ошибка создания продукта'
          set({ loading: false, error: message }, false, 'products:create:error')
          throw e
        }
      },
    },
  }))
)
