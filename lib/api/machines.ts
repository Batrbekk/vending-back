import { MachineStatus } from '@/types'

export type ObjectIdString = string // 24-hex string enforced by backend

export type MachineListFilters = {
  status?: MachineStatus
  locationId?: ObjectIdString
  assignedManagerId?: ObjectIdString
  needsRefill?: boolean
  search?: string
  page?: number
  limit?: number
}

export type Pagination = {
  page: number
  limit: number
  totalCount: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

// Frontend-friendly DTO (serialized)
export type MachineDTO = {
  _id: ObjectIdString
  machineId: string
  locationId: ObjectIdString
  capacity: number
  stock: number
  status: MachineStatus
  assignedManagerId?: ObjectIdString
  lastServiceAt?: string
  lastTelemetryAt?: string
  notes?: string
  createdAt: string
  updatedAt: string
  // Enriched
  stockPercentage: number
  needsRefill: boolean
  isEmpty: boolean
  canStartRefill: boolean
  location?: {
    _id: ObjectIdString
    name: string
    address: string
  }
  assignedManager?: {
    _id: ObjectIdString
    name: string
    email: string
  }
}

export type MachinesListResponse = {
  success: true
  data: {
    machines: MachineDTO[]
    pagination: Pagination
  }
}

export type MachineCreatePayload = {
  machineId: string
  // Allow either a locationId or a free-text locationName
  locationId?: ObjectIdString
  locationName?: string
  capacity?: number // default 360 on server
  stock?: number // default 0 on server
  assignedManagerId?: ObjectIdString
  notes?: string
}

export type MachineCreateResponse = {
  success: true
  data: { machine: MachineDTO }
}

export type MachineGetResponse = {
  success: true
  data: { machine: MachineDTO }
}

export type MachineUpdatePayload = Partial<{
  locationId: ObjectIdString
  capacity: number
  stock: number
  status: MachineStatus
  assignedManagerId: ObjectIdString | null
  notes: string | null
}>

export type PairingStartResponse = {
  success: true
  data: { code: string; expiresAt: string; machine: { _id: ObjectIdString; machineId: string } }
}

export class MachinesApiClient {
  private baseUrl: string
  private get authHeaders(): HeadersInit {
    return { 'Content-Type': 'application/json' }
  }

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl
  }

  async list(filters: MachineListFilters = {}): Promise<MachinesListResponse> {
    const params = new URLSearchParams()
    if (filters.status) params.set('status', filters.status)
    if (filters.locationId) params.set('locationId', filters.locationId)
    if (filters.assignedManagerId) params.set('assignedManagerId', filters.assignedManagerId)
    if (filters.needsRefill !== undefined) params.set('needsRefill', String(filters.needsRefill))
    if (filters.search) params.set('search', filters.search)
    if (filters.page) params.set('page', String(filters.page))
    if (filters.limit) params.set('limit', String(filters.limit))

    const res = await fetch(`${this.baseUrl}/api/machines?${params.toString()}`, {
      method: 'GET',
      headers: this.authHeaders,
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string }
      throw new Error(err.error || 'Ошибка получения списка автоматов')
    }

    return res.json() as Promise<MachinesListResponse>
  }

  async create(payload: MachineCreatePayload): Promise<MachineCreateResponse> {
    const res = await fetch(`${this.baseUrl}/api/machines`, {
      method: 'POST',
      headers: this.authHeaders,
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string }
      throw new Error(err.error || 'Ошибка создания автомата')
    }

    return res.json() as Promise<MachineCreateResponse>
  }

  async get(id: ObjectIdString): Promise<MachineGetResponse> {
    const res = await fetch(`${this.baseUrl}/api/machines/${id}`, {
      method: 'GET',
      headers: this.authHeaders,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string }
      throw new Error(err.error || 'Ошибка получения автомата')
    }
    return res.json() as Promise<MachineGetResponse>
  }

  async update(id: ObjectIdString, patch: MachineUpdatePayload): Promise<MachineGetResponse> {
    const res = await fetch(`${this.baseUrl}/api/machines/${id}`, {
      method: 'PATCH',
      headers: this.authHeaders,
      body: JSON.stringify(patch),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string }
      throw new Error(err.error || 'Ошибка обновления автомата')
    }
    return res.json() as Promise<MachineGetResponse>
  }

  async activateToCapacity(id: ObjectIdString, capacity: number): Promise<MachineGetResponse> {
    // Sets stock to capacity to mark as filled and let backend update status accordingly
    return this.update(id, { stock: capacity })
  }

  async setStatus(id: ObjectIdString, status: MachineUpdatePayload['status']): Promise<MachineGetResponse> {
    return this.update(id, { status })
  }

  async remove(id: ObjectIdString): Promise<{ success: true; data: { message: string; machineId: string; deleted?: { refills: number; sales: number; alerts: number; devices: number } } }> {
    const res = await fetch(`${this.baseUrl}/api/machines/${id}`, {
      method: 'DELETE',
      headers: this.authHeaders,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string }
      throw new Error(err.error || 'Ошибка удаления автомата')
    }
    return res.json() as Promise<{ success: true; data: { message: string; machineId: string; deleted?: { refills: number; sales: number; alerts: number; devices: number } } }>
  }

  async pairingStart(id: ObjectIdString): Promise<PairingStartResponse> {
    const res = await fetch(`${this.baseUrl}/api/machines/${id}/pairing/start`, {
      method: 'POST',
      headers: this.authHeaders,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string }
      throw new Error(err.error || 'Ошибка генерации кода пейринга')
    }
    return res.json() as Promise<PairingStartResponse>
  }
}

export const machinesApi = new MachinesApiClient()