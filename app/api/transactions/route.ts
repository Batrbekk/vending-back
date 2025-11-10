import { withAuth, AuthenticatedRequest, createErrorResponse, createSuccessResponse } from '@/lib/auth/middleware';
import { SalesFiltersSchema } from '@/lib/validation/common';
import { Transaction, VendingMachine } from '@/entities';
import dbConnect from '@/lib/database/connection';
import mongoose from 'mongoose';

// GET /api/transactions - список транзакций с фильтрами и пагинацией
async function handleListTransactions(request: AuthenticatedRequest) {
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
    if (filters.from || filters.to) {
      mongoFilter.paidAt = {} as Record<string, unknown>;
      if (filters.from) (mongoFilter.paidAt as Record<string, unknown>).$gte = filters.from;
      if (filters.to) (mongoFilter.paidAt as Record<string, unknown>).$lte = filters.to;
    }

    const [items, totalCount] = await Promise.all([
      Transaction.find(mongoFilter)
        .sort({ paidAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean({ virtuals: true }),
      Transaction.countDocuments(mongoFilter),
    ]);

    // Дополнительно подтянем данные автомата (machineId, location) для отображения
    const machineIds = Array.from(new Set(items.map((t) => String(t.machineId)))).map((id) => new mongoose.Types.ObjectId(id));
    const machines = await VendingMachine.find({ _id: { $in: machineIds } })
      .populate('location', 'name address')
      .select('machineId locationId')
      .lean({ virtuals: true });

    const machinesById = new Map(machines.map((m) => [String(m._id), m]));

    const dto = items.map((t) => {
      const m = machinesById.get(String(t.machineId));
      return {
        _id: String(t._id),
        machineId: String(t.machineId),
        receiptNumber: t.receiptNumber,
        orderNumber: t.orderNumber,
        items: t.items,
        totalAmount: t.totalAmount,
        paidAt: new Date(t.paidAt).toISOString(),
        paymentMethod: t.paymentMethod ?? null,
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
      transactions: dto,
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
    console.error('Ошибка получения транзакций:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return createErrorResponse('Некорректные параметры фильтрации', 400);
    }
    return createErrorResponse('Ошибка получения транзакций', 500);
  }
}

export const GET = withAuth(handleListTransactions);
