import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { MachineStatus } from '@/types'
import { machinesApi, type MachineDTO, type MachinesListResponse, type MachineCreatePayload } from '@/lib/api/machines'

export type MachinesFiltersState = {
  status?: MachineStatus
  locationId?: string
  needsRefill?: boolean
  search?: string
}

export type MachinesState = {
  items: MachineDTO[]
  pagination: MachinesListResponse['data']['pagination'] | null
  loading: boolean
  error: string | null
  filters: MachinesFiltersState
  isCreating: boolean
}

export type MachinesActions = {
  setFilters: (patch: Partial<MachinesFiltersState>) => void
  fetch: (page?: number, limit?: number) => Promise<void>
  create: (payload: MachineCreatePayload, activateAfter?: boolean) => Promise<MachineDTO>
  activate: (id: string, capacity: number) => Promise<MachineDTO>
  setStatus: (id: string, status: MachineStatus) => Promise<MachineDTO>
  remove: (id: string) => Promise<void>
}

export type MachinesStore = MachinesState & { actions: MachinesActions }

const initialState: MachinesState = {
  items: [],
  pagination: null,
  loading: false,
  error: null,
  filters: {},
  isCreating: false,
}

export const useMachinesStore = create<MachinesStore>()(
  devtools((set, get) => ({
    ...initialState,
    actions: {
      setFilters: (patch) => set((state) => ({ filters: { ...state.filters, ...patch } }), false, 'machines:setFilters'),

      fetch: async (page = 1, limit = 20) => {
        set({ loading: true, error: null }, false, 'machines:fetch:start')
        try {
          const { filters } = get()
          const res = await machinesApi.list({ ...filters, page, limit })
          set({ items: res.data.machines, pagination: res.data.pagination, loading: false }, false, 'machines:fetch:success')
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Ошибка загрузки'
          set({ error: message, loading: false }, false, 'machines:fetch:error')
        }
      },

      create: async (payload, activateAfter = true) => {
        set({ isCreating: true, error: null }, false, 'machines:create:start')
        try {
          const res = await machinesApi.create(payload)
          let created = res.data.machine

          if (activateAfter) {
            const capacity = payload.capacity ?? 360
            const r2 = await machinesApi.activateToCapacity(created._id, capacity)
            created = r2.data.machine
          }

          // Refresh list
          const { pagination } = get()
          await get().actions.fetch(pagination?.page ?? 1, pagination?.limit ?? 20)

          set({ isCreating: false }, false, 'machines:create:success')
          return created
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Ошибка создания'
          set({ isCreating: false, error: message }, false, 'machines:create:error')
          throw e
        }
      },

      activate: async (id, capacity) => {
        set({ loading: true, error: null }, false, 'machines:activate:start')
        try {
          const res = await machinesApi.activateToCapacity(id, capacity)
          // Update in-place
          set((state) => ({
            items: state.items.map((m) => (m._id === id ? res.data.machine : m)),
            loading: false,
          }), false, 'machines:activate:success')
          return res.data.machine
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Ошибка активации'
          set({ loading: false, error: message }, false, 'machines:activate:error')
          throw e
        }
      },

      setStatus: async (id, status) => {
        set({ loading: true, error: null }, false, 'machines:setStatus:start')
        try {
          const res = await machinesApi.setStatus(id, status)
          set((state) => ({
            items: state.items.map((m) => (m._id === id ? res.data.machine : m)),
            loading: false,
          }), false, 'machines:setStatus:success')
          return res.data.machine
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Ошибка обновления статуса'
          set({ loading: false, error: message }, false, 'machines:setStatus:error')
          throw e
        }
      },

      remove: async (id) => {
        set({ loading: true, error: null }, false, 'machines:remove:start')
        try {
          await machinesApi.remove(id)
          set((state) => ({
            items: state.items.filter((m) => m._id !== id),
            loading: false,
          }), false, 'machines:remove:success')
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Ошибка удаления'
          set({ loading: false, error: message }, false, 'machines:remove:error')
          throw e
        }
      },
    },
  }))
)
