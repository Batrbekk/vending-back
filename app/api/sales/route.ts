import { withAuth, AuthenticatedRequest, createErrorResponse, createSuccessResponse } from '@/lib/auth/middleware';
import { SalesFiltersSchema } from '@/lib/validation/common';
import { Sale, VendingMachine, Product } from '@/entities';
import dbConnect from '@/lib/database/connection';
import mongoose from 'mongoose';

// GET /api/sales - список продаж с фильтрами и пагинацией
async function handleListSales(request: AuthenticatedRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);

    // Пагинация
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 200);
    const skip = (page - 1) * limit;

    // Фильтры
    const rawFilters = Object.fromEntries(Array.from(searchParams.entries()));
    const filters = SalesFiltersSchema.parse(rawFilters);

    const mongoFilter: Record<string, unknown> = {};

    if (filters.machineId) {
      mongoFilter.machineId = new mongoose.Types.ObjectId(filters.machineId);
    }
    if (filters.sku) {
      mongoFilter.sku = { $regex: filters.sku, $options: 'i' };
    }
    if (filters.from || filters.to) {
      mongoFilter.paidAt = {} as Record<string, unknown>;
      if (filters.from) (mongoFilter.paidAt as Record<string, unknown>).$gte = filters.from;
      if (filters.to) (mongoFilter.paidAt as Record<string, unknown>).$lte = filters.to;
    }

    const [items, totalCount] = await Promise.all([
      Sale.find(mongoFilter)
        .sort({ paidAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean({ virtuals: true }),
      Sale.countDocuments(mongoFilter),
    ]);

    // Дополнительно подтянем данные автомата (machineId, location) для отображения
    const machineIds = Array.from(new Set(items.map((s) => String(s.machineId)))).map((id) => new mongoose.Types.ObjectId(id));
    const machines = await VendingMachine.find({ _id: { $in: machineIds } })
      .populate('location', 'name address')
      .select('machineId locationId')
      .lean({ virtuals: true });

    const machinesById = new Map(machines.map((m) => [String(m._id), m]));

    // Получаем данные о продуктах по SKU (которые являются _id продуктов)
    const skus = Array.from(new Set(items.map((s) => s.sku)));
    const validObjectIds = skus.filter(sku => mongoose.Types.ObjectId.isValid(sku));
    const products = await Product.find({ _id: { $in: validObjectIds.map(id => new mongoose.Types.ObjectId(id)) } })
      .select('name _id')
      .lean();

    const productsById = new Map(products.map((p) => [String(p._id), p]));

    console.log('Sales items count:', items.length);
    console.log('Products found:', products.length);
    console.log('Sample SKU:', items[0]?.sku);
    console.log('Sample product:', products[0]);

    const dto = items.map((s) => {
      const m = machinesById.get(String(s.machineId));
      const product = productsById.get(s.sku);
      return {
        _id: String(s._id),
        machineId: String(s.machineId),
        sku: s.sku,
        productName: product?.name || s.sku,
        price: s.price,
        qty: s.qty,
        total: s.total,
        paidAt: new Date(s.paidAt).toISOString(),
        paymentMethod: s.paymentMethod ?? null,
        receiptId: s.receiptId ?? null,
        machine: m
          ? {
              _id: String(m._id),
              machineId: m.machineId,
              location: m.location
                ? { _id: String(m.location._id), name: m.location.name, address: m.location.address }
                : undefined,
            }
          : undefined,
      };
    });

    return createSuccessResponse({
      sales: dto,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNext: page * limit < totalCount,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error('Ошибка получения продаж:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return createErrorResponse('Некорректные параметры фильтрации', 400);
    }
    return createErrorResponse('Ошибка получения продаж', 500);
  }
}

export const GET = withAuth(handleListSales);
