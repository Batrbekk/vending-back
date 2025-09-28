import { 
  withAuth,
  AuthenticatedRequest, 
  createSuccessResponse, 
  createErrorResponse 
} from '@/lib/auth/middleware';
import { FinishRefillSchema } from '@/lib/validation/common';
import { VendingMachine, RefillLog, Alert } from '@/entities';
import { MachineStatus, UserRole, AlertType } from '@/types';
import dbConnect from '@/lib/database/connection';
import mongoose from 'mongoose';

// Завершение сессии пополнения
async function handleFinishRefill(request: AuthenticatedRequest) {
  const { pathname } = new URL(request.url);
  const id = pathname.split('/').slice(-3, -2)[0]; // Извлекаем ID из URL
  try {
    await dbConnect();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return createErrorResponse('Некорректный ID автомата', 400);
    }

    const body = await request.json();
    const validatedData = FinishRefillSchema.parse(body);
    const user = request.user!;

    // Находим автомат
    const machine = await VendingMachine.findById(id)
      .populate('location', 'name address')
      .populate('assignedManager', 'name email');

    if (!machine) {
      return createErrorResponse('Автомат не найден', 404);
    }

    // Проверяем что автомат находится в процессе обслуживания
    if (machine.status !== MachineStatus.IN_SERVICE) {
      return createErrorResponse('Автомат не находится в состоянии обслуживания', 409);
    }

    // Проверяем права доступа
    if (user.role === UserRole.MANAGER) {
      if (!machine.assignedManagerId || machine.assignedManagerId.toString() !== user.userId) {
        return createErrorResponse('У вас нет доступа к этому автомату', 403);
      }
    }

    // Находим активную сессию пополнения
    if (!mongoose.connection.db) throw new Error('База данных недоступна');
    const activeSession = await mongoose.connection.db.collection('active_refill_sessions')
      .findOne({
        machineId: machine._id as mongoose.Types.ObjectId,
        status: 'IN_PROGRESS'
      });

    if (!activeSession) {
      return createErrorResponse('Активная сессия пополнения не найдена', 404);
    }

    // Если запрос не от менеджера, который начал сессию
    if (user.role === UserRole.MANAGER && activeSession.managerId.toString() !== user.userId) {
      return createErrorResponse('Сессию может завершить только менеджер, который её начал', 403);
    }

    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        // Данные до пополнения
        const stockBefore = activeSession.initialStock;
        const initialProductStock = activeSession.initialProductStock || {};
        const addedAmount = validatedData.added;
        
        // Рассчитываем остаток после пополнения (не больше вместимости)
        const stockAfter = Math.min(stockBefore + addedAmount, machine.capacity);
        const actuallyAdded = stockAfter - stockBefore;
        
        // Если можем добавить товары, распределяем их равномерно между продуктами
        if (actuallyAdded > 0) {
          const productStock = machine.getProductStockObject();
          const productIds = Object.keys(productStock);
          
          if (productIds.length > 0) {
            const addedPerProduct = Math.floor(actuallyAdded / productIds.length);
            const remainder = actuallyAdded % productIds.length;
            
            // Распределяем основную часть равномерно
            productIds.forEach(productId => {
              machine.setProductStock(productId, productStock[productId] + addedPerProduct);
            });
            
            // Остаток добавляем к первым продуктам
            for (let i = 0; i < remainder; i++) {
              const productId = productIds[i];
              machine.setProductStock(productId, productStock[productId] + addedPerProduct + 1);
            }
          }
        }

        machine.lastServiceAt = new Date();
        
        // Пересчитываем статус на основе нового остатка
        machine.updateStatus();

        await machine.save();

        // Создаем запись в журнале пополнений
        const refillLog = new RefillLog({
          machineId: machine._id as mongoose.Types.ObjectId,
          managerId: new mongoose.Types.ObjectId(user.userId),
          startedAt: activeSession.startedAt,
          finishedAt: new Date(),
          before: stockBefore,
          added: addedAmount,
          after: machine.stock,
          comment: validatedData.comment
        });

        await refillLog.save({ session });

        // Удаляем активную сессию пополнения
        await mongoose.connection.db!.collection('active_refill_sessions')
          .deleteOne({ _id: activeSession._id }, { session });

        // Если автомат был переполнен, создаем предупреждение
        if (addedAmount > actuallyAdded) {
          await Alert.createIfNotExists(
            machine._id as mongoose.Types.ObjectId,
            AlertType.ERROR,
            `Попытка добавить ${addedAmount} банок, но поместилось только ${actuallyAdded} (превышена вместимость)`
          );
        }

        // Если автомат всё ещё нуждается в пополнении после обслуживания, создаем алерт
        if (machine.stock < machine.capacity * 0.5) {
          await Alert.createIfNotExists(
            machine._id as mongoose.Types.ObjectId,
            AlertType.LOW_STOCK,
            `Автомат по-прежнему нуждается в пополнении (остаток: ${machine.stock})`
          );
        }

        // Логируем завершение пополнения
        console.log(`Завершено пополнение автомата ${machine.machineId}:`, {
          managerId: user.userId,
          managerName: user.name,
          machineId: machine.machineId,
          location: machine.location?.name,
          stockBefore,
          addedAmount,
          actuallyAdded,
          stockAfter: machine.stock,
          newStatus: machine.status,
          duration: new Date().getTime() - activeSession.startedAt.getTime(),
          comment: validatedData.comment,
          timestamp: new Date()
        });
      });

      // Подготавливаем ответ с обновленными данными
      const enrichedMachine = {
        ...machine.toObject(),
        stockPercentage: Math.round((machine.stock / machine.capacity) * 100),
        needsRefill: machine.stock < machine.capacity * 0.5,
        isEmpty: machine.stock === 0,
        canStartRefill: true // Теперь можно начать новую сессию
      };

      const refillSummary = {
        managerId: user.userId,
        managerName: user.name,
        startedAt: activeSession.startedAt,
        finishedAt: new Date(),
        duration: Math.round((new Date().getTime() - activeSession.startedAt.getTime()) / (1000 * 60)), // минуты
        stockBefore: activeSession.initialStock,
        addedRequested: validatedData.added,
        stockAfter: machine.stock,
        actuallyAdded: machine.stock - activeSession.initialStock,
        efficiency: Math.round((machine.stock - activeSession.initialStock) / validatedData.added * 100), // %
        comment: validatedData.comment
      };

      return createSuccessResponse({ 
        machine: enrichedMachine,
        refillSummary,
        message: 'Пополнение завершено успешно'
      });

    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }

  } catch (error) {
    console.error('Ошибка завершения пополнения:', error);

    if (error instanceof Error) {
      if (error.name === 'ZodError') {
        return createErrorResponse('Некорректные данные формы', 400);
      }
      
      return createErrorResponse(error.message, 400);
    }

    return createErrorResponse('Ошибка завершения пополнения', 500);
  }
}

export const POST = withAuth(handleFinishRefill);
