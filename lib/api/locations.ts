export type ObjectIdString = string

export type LocationDTO = {
  _id: ObjectIdString
  name: string
  address: string
  timezone?: string
}

export type LocationsListResponse = {
  success: true
  data: {
    locations: LocationDTO[]
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

export class LocationsApiClient {
  private baseUrl: string
  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl
  }

  async list(search?: string, limit: number = 100): Promise<LocationsListResponse> {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    params.set('limit', String(limit))

    const res = await fetch(`${this.baseUrl}/api/locations?${params.toString()}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string }
      throw new Error(err.error || 'Ошибка получения локаций')
    }

    return res.json() as Promise<LocationsListResponse>
  }
}

export const locationsApi = new LocationsApiClient()