import { 
  withAuth,
  AuthenticatedRequest, 
  createSuccessResponse, 
  createErrorResponse 
} from '@/lib/auth/middleware';
import { RefillLog, VendingMachine } from '@/entities';
import { UserRole } from '@/types';
import dbConnect from '@/lib/database/connection';
import mongoose from 'mongoose';

// Получение истории пополнений автомата
async function handleGetRefillHistory(request: AuthenticatedRequest) {
  const { pathname } = new URL(request.url);
  const id = pathname.split('/').slice(-2, -1)[0]; // Извлекаем ID из URL
  try {
    await dbConnect();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return createErrorResponse('Некорректный ID автомата', 400);
    }

    const user = request.user!;
    const { searchParams } = new URL(request.url);

    // Проверяем доступ к автомату
    const machine = await VendingMachine.findById(id);
    if (!machine) {
      return createErrorResponse('Автомат не найден', 404);
    }

    // Для менеджеров проверяем назначение
    if (user.role === UserRole.MANAGER) {
      if (!machine.assignedManagerId || machine.assignedManagerId.toString() !== user.userId) {
        return createErrorResponse('У вас нет доступа к этому автомату', 403);
      }
    }

    // Параметры фильтрации
    const fromDate = searchParams.get('from') ? new Date(searchParams.get('from')!) : null;
    const toDate = searchParams.get('to') ? new Date(searchParams.get('to')!) : null;
    const managerId = searchParams.get('managerId');

    // Пагинация
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const skip = (page - 1) * limit;

    // Построение фильтра
    const filter: Record<string, unknown> = { machineId: machine._id };

    if (fromDate || toDate) {
      filter.finishedAt = {} as Record<string, unknown>;
      if (fromDate) (filter.finishedAt as Record<string, unknown>).$gte = fromDate;
      if (toDate) (filter.finishedAt as Record<string, unknown>).$lte = toDate;
    }

    if (managerId && mongoose.Types.ObjectId.isValid(managerId)) {
      filter.managerId = new mongoose.Types.ObjectId(managerId);
    }

    // Получаем записи пополнений
    const [refills, totalCount] = await Promise.all([
      RefillLog.find(filter)
        .populate('manager', 'name email')
        .sort({ finishedAt: -1 })
        .skip(skip)
        .limit(limit),
      RefillLog.countDocuments(filter)
    ]);

    // Обогащаем данные дополнительной информацией
    const enrichedRefills = refills.map(refill => {
      const refillObj = refill.toObject();
      const durationMs = refill.finishedAt.getTime() - refill.startedAt.getTime();
      
      return {
        ...refillObj,
        duration: Math.round(durationMs / (1000 * 60)), // в минутах
        actualAdded: refill.after - refill.before,
        efficiency: Math.round(((refill.after - refill.before) / refill.added) * 100),
        stockPercentageBefore: Math.round((refill.before / machine.capacity) * 100),
        stockPercentageAfter: Math.round((refill.after / machine.capacity) * 100)
      };
    });

    // Статистика для периода
    const stats = await RefillLog.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalRefills: { $sum: 1 },
          totalAdded: { $sum: '$added' },
          totalActualAdded: { $sum: { $subtract: ['$after', '$before'] } },
          avgDuration: { $avg: { $subtract: ['$finishedAt', '$startedAt'] } },
          avgEfficiency: {
            $avg: {
              $multiply: [
                { $divide: [{ $subtract: ['$after', '$before'] }, '$added'] },
                100
              ]
            }
          },
          minStock: { $min: '$before' },
          maxStock: { $max: '$after' }
        }
      }
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return createSuccessResponse({
      refills: enrichedRefills,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      stats: stats[0] ? {
        ...stats[0],
        avgDuration: Math.round((stats[0].avgDuration || 0) / (1000 * 60)), // в минутах
        avgEfficiency: Math.round(stats[0].avgEfficiency || 0)
      } : {
        totalRefills: 0,
        totalAdded: 0,
        totalActualAdded: 0,
        avgDuration: 0,
        avgEfficiency: 0
      }
    });

  } catch (error) {
    console.error('Ошибка получения истории пополнений:', error);
    return createErrorResponse('Ошибка получения истории пополнений', 500);
  }
}

export const GET = withAuth(handleGetRefillHistory);
