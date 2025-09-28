import { 
  withAuth,
  AuthenticatedRequest, 
  createSuccessResponse, 
  createErrorResponse 
} from '@/lib/auth/middleware';
import { VendingMachine } from '@/entities';
import { MachineStatus, UserRole } from '@/types';
import dbConnect from '@/lib/database/connection';
import mongoose from 'mongoose';

// Начало сессии пополнения
async function handleStartRefill(request: AuthenticatedRequest) {
  const { pathname } = new URL(request.url);
  const id = pathname.split('/').slice(-3, -2)[0]; // Извлекаем ID из URL
  try {
    await dbConnect();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return createErrorResponse('Некорректный ID автомата', 400);
    }

    const user = request.user!;

    // Находим автомат
    const machine = await VendingMachine.findById(id)
      .populate('location', 'name address')
      .populate('assignedManager', 'name email');

    if (!machine) {
      return createErrorResponse('Автомат не найден', 404);
    }

    // Проверяем права доступа
    if (user.role === UserRole.MANAGER) {
      // Менеджер может обслуживать только назначенные ему автоматы
      if (!machine.assignedManagerId || machine.assignedManagerId.toString() !== user.userId) {
        return createErrorResponse('У вас нет доступа к этому автомату', 403);
      }
    }

    // Проверяем что автомат можно обслуживать
    if (machine.status === MachineStatus.IN_SERVICE) {
      return createErrorResponse('Автомат уже обслуживается', 409);
    }

    if (machine.status === MachineStatus.ERROR) {
      return createErrorResponse('Автомат в состоянии ошибки, обслуживание невозможно', 409);
    }

    // Начинаем транзакцию для обновления статуса
    const session = await mongoose.startSession();
    
    try {
      await session.withTransaction(async () => {
        // Обновляем статус автомата
        machine.status = MachineStatus.IN_SERVICE;
        machine.lastServiceAt = new Date();
        
        // Если не назначен менеджер и запрос от менеджера - назначаем его
        if (!machine.assignedManagerId && user.role === UserRole.MANAGER) {
          machine.assignedManagerId = new mongoose.Types.ObjectId(user.userId);
        }

        await machine.save({ session });

        // Создаем запись о начале пополнения (в сессии пополнений будет храниться состояние)
        // Это позволит отслеживать "зависшие" сессии пополнений
        const refillSession = {
          machineId: machine._id,
          managerId: new mongoose.Types.ObjectId(user.userId),
          startedAt: new Date(),
          status: 'IN_PROGRESS',
          initialStock: machine.stock,
          initialProductStock: { ...machine.getProductStockObject() }
        };

        // Сохраняем в отдельной коллекции для активных сессий
        await mongoose.connection.db!.collection('active_refill_sessions')
          .insertOne(refillSession, { session });
      });

      // Логируем начало пополнения
      console.log(`Начато пополнение автомата ${machine.machineId}:`, {
        managerId: user.userId,
        managerName: user.name,
        machineId: machine.machineId,
        location: machine.location?.name,
        initialStock: machine.stock,
        capacity: machine.capacity,
        timestamp: new Date()
      });

      // Подготавливаем ответ
      const enrichedMachine = {
        ...machine.toObject(),
        stockPercentage: Math.round((machine.stock / machine.capacity) * 100),
        needsRefill: machine.stock < machine.capacity * 0.5,
        isEmpty: machine.stock === 0,
        canStartRefill: false // Теперь нельзя начать новую сессию
      };

      return createSuccessResponse({ 
        machine: enrichedMachine,
        refillSession: {
          startedAt: new Date(),
          managerId: user.userId,
          managerName: user.name,
          initialStock: machine.stock
        },
        message: 'Сессия пополнения начата успешно'
      });

    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }

  } catch (error) {
    console.error('Ошибка начала пополнения:', error);
    return createErrorResponse('Ошибка начала пополнения', 500);
  }
}

export const POST = withAuth(handleStartRefill);
