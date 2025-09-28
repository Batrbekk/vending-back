export type ProductDTO = {
  _id: string
  name: string
  image?: string
  price: number
}

export type ProductsListResponse = {
  success: true
  data: {
    products: ProductDTO[]
    pagination: { page: number; limit: number; totalCount: number; totalPages: number; hasNext: boolean; hasPrev: boolean }
  }
}

export type ProductCreateResponse = {
  success: true
  data: { product: ProductDTO }
}

export class ProductsApiClient {
  constructor(private baseUrl: string = '') {}
  private get headers(): HeadersInit { return { 'Content-Type': 'application/json' } }

  async list(params: { search?: string; page?: number; limit?: number } = {}): Promise<ProductsListResponse> {
    const q = new URLSearchParams()
    if (params.search) q.set('search', params.search)
    if (params.page) q.set('page', String(params.page))
    if (params.limit) q.set('limit', String(params.limit))
    const res = await fetch(`${this.baseUrl}/api/products?${q.toString()}`, { headers: this.headers })
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string }
      throw new Error(err.error || 'Ошибка получения продуктов')
    }
    return res.json() as Promise<ProductsListResponse>
  }

  async create(data: { name: string; price: number; imageFile?: File | null; image?: string }): Promise<ProductCreateResponse> {
    let res: Response
    if (data.imageFile) {
      const form = new FormData()
      form.append('name', data.name)
      form.append('price', String(Math.round(data.price)))
      form.append('image', data.imageFile)
      res = await fetch(`${this.baseUrl}/api/products`, { method: 'POST', body: form as unknown as BodyInit })
    } else {
      res = await fetch(`${this.baseUrl}/api/products`, { method: 'POST', headers: this.headers, body: JSON.stringify({ name: data.name, image: data.image, price: Math.round(data.price) }) })
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string }
      throw new Error(err.error || 'Ошибка создания продукта')
    }
    return res.json() as Promise<ProductCreateResponse>
  }

  async update(id: string, data: { name?: string; price?: number; imageFile?: File | null; image?: string }) {
    let res: Response
    if (data.imageFile) {
      const form = new FormData()
      if (data.name) form.append('name', data.name)
      if (typeof data.price === 'number') form.append('price', String(Math.round(data.price)))
      form.append('image', data.imageFile)
      res = await fetch(`${this.baseUrl}/api/products/${id}`, { method: 'PATCH', body: form as unknown as BodyInit })
    } else {
      res = await fetch(`${this.baseUrl}/api/products/${id}`, { method: 'PATCH', headers: this.headers, body: JSON.stringify({ name: data.name, image: data.image, price: typeof data.price === 'number' ? Math.round(data.price) : undefined }) })
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string }
      throw new Error(err.error || 'Ошибка обновления продукта')
    }
    return res.json() as Promise<{ success: true; data: { product: ProductDTO } }>
  }

  async remove(id: string) {
    const res = await fetch(`${this.baseUrl}/api/products/${id}`, { method: 'DELETE', headers: this.headers })
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string }
      throw new Error(err.error || 'Ошибка удаления продукта')
    }
    return res.json() as Promise<{ success: true; data: { message: string; id: string } }>
  }
}

export const productsApi = new ProductsApiClient()
