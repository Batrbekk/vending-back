import { withAuth, AuthenticatedRequest, createErrorResponse, createSuccessResponse } from '@/lib/auth/middleware';
import { SalesFiltersSchema } from '@/lib/validation/common';
import { Sale } from '@/entities';
import dbConnect from '@/lib/database/connection';
import mongoose from 'mongoose';

// GET /api/sales/stats - агрегаты и временные ряды
async function handleSalesStats(request: AuthenticatedRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const rawFilters = Object.fromEntries(Array.from(searchParams.entries()));
    const filters = SalesFiltersSchema.parse(rawFilters);

    const from = filters.from;
    const to = filters.to;
    const machineId = filters.machineId ? new mongoose.Types.ObjectId(filters.machineId) : undefined;

    // Преобразуем строки дат в объекты Date
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;

    const [statsAgg, daily, topProducts, machines] = await Promise.all([
      Sale.getSalesStats(from, to, machineId),
      Sale.getDailySales(30, machineId, fromDate, toDate),
      Sale.getTopProducts(10, from, to),
      Sale.getMachinePerformance(from, to),
    ]);

    const totals = Array.isArray(statsAgg) && statsAgg[0]
      ? {
          totalSales: statsAgg[0].totalSales ?? 0,
          totalRevenue: statsAgg[0].totalRevenue ?? 0,
          totalItems: statsAgg[0].totalItems ?? 0,
          avgOrderValue: statsAgg[0].avgOrderValue ?? 0,
          uniqueMachinesCount: statsAgg[0].uniqueMachinesCount ?? 0,
        }
      : { totalSales: 0, totalRevenue: 0, totalItems: 0, avgOrderValue: 0, uniqueMachinesCount: 0 };

    return createSuccessResponse({
      totals,
      daily, // {date, totalSales, totalRevenue, totalItems}
      topProducts, // {_id: sku, totalSold, totalRevenue, salesCount, avgPrice}
      machines, // per-machine performance
    });
  } catch (error) {
    console.error('Ошибка получения статистики продаж:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return createErrorResponse('Некорректные параметры фильтрации', 400);
    }
    return createErrorResponse('Ошибка получения статистики продаж', 500);
  }
}

export const GET = withAuth(handleSalesStats);
