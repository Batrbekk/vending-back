import { withAuth, AuthenticatedRequest, createErrorResponse, createSuccessResponse } from '@/lib/auth/middleware';
import { SalesFiltersSchema } from '@/lib/validation/common';
import { Transaction } from '@/entities';
import dbConnect from '@/lib/database/connection';
import mongoose from 'mongoose';

// GET /api/transactions/stats - агрегаты и временные ряды по транзакциям
async function handleTransactionsStats(request: AuthenticatedRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const rawFilters = Object.fromEntries(Array.from(searchParams.entries()));
    const filters = SalesFiltersSchema.parse(rawFilters);

    const from = filters.from;
    const to = filters.to;
    const machineId = filters.machineId ? new mongoose.Types.ObjectId(filters.machineId) : undefined;

    const matchStage: Record<string, unknown> = {};
    if (machineId) {
      matchStage.machineId = machineId;
    }
    if (from || to) {
      matchStage.paidAt = {};
      if (from) (matchStage.paidAt as Record<string, unknown>).$gte = new Date(from);
      if (to) (matchStage.paidAt as Record<string, unknown>).$lte = new Date(to);
    }

    // Основная статистика
    const statsAgg = await Transaction.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
          totalItems: { $sum: { $sum: '$items.quantity' } },
          avgOrderValue: { $avg: '$totalAmount' },
          uniqueMachinesCount: { $addToSet: '$machineId' },
        },
      },
      {
        $project: {
          _id: 0,
          totalSales: 1,
          totalRevenue: 1,
          totalItems: 1,
          avgOrderValue: 1,
          uniqueMachinesCount: { $size: '$uniqueMachinesCount' },
        },
      },
    ]);

    // Динамика по дням (with timezone support for Asia/Almaty)
    const dailyAgg = await Transaction.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt', timezone: 'Asia/Almaty' } },
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
          totalItems: { $sum: { $sum: '$items.quantity' } },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          date: '$_id',
          totalSales: 1,
          totalRevenue: 1,
          totalItems: 1,
        },
      },
    ]);

    const totals = statsAgg[0]
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
      daily: dailyAgg,
    });
  } catch (error) {
    console.error('Ошибка получения статистики транзакций:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return createErrorResponse('Некорректные параметры фильтрации', 400);
    }
    return createErrorResponse('Ошибка получения статистики транзакций', 500);
  }
}

export const GET = withAuth(handleTransactionsStats);
