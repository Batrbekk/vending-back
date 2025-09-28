import { 
  withAuth, 
  withAdminRole,
  AuthenticatedRequest, 
  createSuccessResponse, 
  createErrorResponse 
} from '@/lib/auth/middleware';
import { UpdateMachineSchema } from '@/lib/validation/common';
import { VendingMachine, User } from '@/entities';
import { UserRole, MachineStatus } from '@/types';
import dbConnect from '@/lib/database/connection';
import mongoose from 'mongoose';

// Получение автомата по ID
async function handleGetMachine(request: AuthenticatedRequest) {
  const { pathname } = new URL(request.url);
  const id = pathname.split('/').slice(-1)[0]; // Извлекаем ID из URL
  try {
    await dbConnect();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return createErrorResponse('Некорректный ID автомата', 400);
    }

    const user = request.user!;
    
    // Базовый фильтр
    const filter: Record<string, unknown> = { _id: id };
    
    // Если пользователь - менеджер, проверяем доступ
    if (user.role === UserRole.MANAGER) {
      filter.assignedManagerId = new mongoose.Types.ObjectId(user.userId);
    }

    const machine = await VendingMachine.findOne(filter)
      .populate('location', 'name address geo')
      .populate('assignedManager', 'name email phone');

    if (!machine) {
      return createErrorResponse('Автомат не найден или нет доступа', 404);
    }

    // Обогащаем данные
    const enrichedMachine = {
      ...machine.toObject(),
      stockPercentage: Math.round((machine.stock / machine.capacity) * 100),
      needsRefill: machine.stock < machine.capacity * 0.5,
      isEmpty: machine.stock === 0,
      canStartRefill: machine.status !== MachineStatus.IN_SERVICE && machine.status !== MachineStatus.INACTIVE
    };

    return createSuccessResponse({ machine: enrichedMachine });

  } catch (error) {
    console.error('Ошибка получения автомата:', error);
    return createErrorResponse('Ошибка получения автомата', 500);
  }
}

// Обновление автомата (только админы)
async function handleUpdateMachine(request: AuthenticatedRequest) {
  const { pathname } = new URL(request.url);
  const id = pathname.split('/').slice(-1)[0]; // Извлекаем ID из URL
  try {
    await dbConnect();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return createErrorResponse('Некорректный ID автомата', 400);
    }

    const body = await request.json();
    const validatedData = UpdateMachineSchema.parse(body);

    const machine = await VendingMachine.findById(id);
    if (!machine) {
      return createErrorResponse('Автомат не найден', 404);
    }

    // Проверяем локацию если указана
    if (validatedData.locationId) {
      const db = mongoose.connection.db;
      if (!db) throw new Error('База данных недоступна');
      const location = await db.collection('locations').findOne({
        _id: new mongoose.Types.ObjectId(validatedData.locationId)
      });
      
      if (!location) {
        return createErrorResponse('Локация не найдена', 404);
      }
    }

    // Проверяем менеджера если указан
    if (validatedData.assignedManagerId !== undefined) {
      if (validatedData.assignedManagerId) {
        const manager = await User.findOne({
          _id: validatedData.assignedManagerId,
          role: UserRole.MANAGER,
          isActive: true
        });
        
        if (!manager) {
          return createErrorResponse('Указанный менеджер не найден или неактивен', 404);
        }
      }
    }

    // Проверяем что общий остаток productStock не больше capacity при изменении capacity
    const newCapacity = validatedData.capacity || machine.capacity;
    const currentTotalStock = machine.getTotalStock();
    
    if (currentTotalStock > newCapacity) {
      return createErrorResponse('Текущий остаток превышает новую вместимость', 400);
    }

    // Обновляем поля
    Object.assign(machine, validatedData);
    
    // Пересчитываем статус
    machine.updateStatus();

    await machine.save();

    // Возвращаем обновленный автомат
    await machine.populate('location', 'name address');
    await machine.populate('assignedManager', 'name email phone');

    const totalStock = machine.getTotalStock();
    const enrichedMachine = {
      ...machine.toObject(),
      stockPercentage: Math.round((totalStock / machine.capacity) * 100),
      needsRefill: totalStock < machine.capacity * 0.5,
      isEmpty: totalStock === 0,
      canStartRefill: machine.status !== MachineStatus.IN_SERVICE && machine.status !== MachineStatus.INACTIVE
    };

    return createSuccessResponse({ machine: enrichedMachine });

  } catch (error) {
    console.error('Ошибка обновления автомата:', error);

    if (error instanceof Error) {
      if (error.name === 'ZodError') {
        return createErrorResponse('Некорректные данные формы', 400);
      }
      
      return createErrorResponse(error.message, 400);
    }

    return createErrorResponse('Ошибка обновления автомата', 500);
  }
}

// Удаление автомата (только админы)
async function handleDeleteMachine(request: AuthenticatedRequest) {
  const { pathname } = new URL(request.url);
  const id = pathname.split('/').slice(-1)[0]; // Извлекаем ID из URL
  try {
    await dbConnect();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return createErrorResponse('Некорректный ID автомата', 400);
    }

    const db = mongoose.connection.db;
    if (!db) throw new Error('База данных недоступна');

    // Жесткое удаление в транзакции: удаляем связанные записи и сам автомат
    const session = await mongoose.startSession();
    try {
      let deletedCounts = { refills: 0, sales: 0, alerts: 0, devices: 0 };
      let removedMachineId: string | null = null;

      await session.withTransaction(async () => {
        const mId = new mongoose.Types.ObjectId(id);
        const [refillsRes, salesRes, alertsRes, devicesRes] = await Promise.all([
          db.collection('refilllogs').deleteMany({ machineId: mId }, { session }),
          db.collection('sales').deleteMany({ machineId: mId }, { session }),
          db.collection('alerts').deleteMany({ machineId: mId }, { session }),
          db.collection('devices').deleteMany({ machineId: mId }, { session }),
        ]);

        const machine = await VendingMachine.findByIdAndDelete(id, { session });
        if (!machine) {
          throw new Error('NOT_FOUND');
        }

        deletedCounts = {
          refills: refillsRes.deletedCount ?? 0,
          sales: salesRes.deletedCount ?? 0,
          alerts: alertsRes.deletedCount ?? 0,
          devices: devicesRes.deletedCount ?? 0,
        };
        removedMachineId = machine.machineId;
      });

      if (!removedMachineId) {
        return createErrorResponse('Автомат не найден', 404);
      }

      return createSuccessResponse({
        message: 'Автомат и все связанные данные полностью удалены',
        machineId: removedMachineId,
        deleted: deletedCounts,
      });
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error('Ошибка удаления автомата:', error);
    return createErrorResponse('Ошибка удаления автомата', 500);
  }
}

export const GET = withAuth(handleGetMachine);
export const PATCH = withAdminRole(handleUpdateMachine);
export const DELETE = withAdminRole(handleDeleteMachine);
