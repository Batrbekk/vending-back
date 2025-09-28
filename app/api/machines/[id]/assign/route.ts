import { 
  withAdminRole,
  AuthenticatedRequest, 
  createSuccessResponse, 
  createErrorResponse 
} from '@/lib/auth/middleware';
import { AssignManagerSchema } from '@/lib/validation/common';
import { VendingMachine, User } from '@/entities';
import { UserRole } from '@/types';
import dbConnect from '@/lib/database/connection';
import mongoose from 'mongoose';

// Назначение менеджера автомату
async function handleAssignManager(request: AuthenticatedRequest) {
  const { pathname } = new URL(request.url);
  const id = pathname.split('/').slice(-2, -1)[0]; // Извлекаем ID из URL
  try {
    await dbConnect();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return createErrorResponse('Некорректный ID автомата', 400);
    }

    const body = await request.json();
    const validatedData = AssignManagerSchema.parse(body);

    // Находим автомат
    const machine = await VendingMachine.findById(id);
    if (!machine) {
      return createErrorResponse('Автомат не найден', 404);
    }

    let manager = null;

    // Если указан менеджер, проверяем что он существует и активен
    if (validatedData.managerId) {
      manager = await User.findOne({
        _id: validatedData.managerId,
        role: UserRole.MANAGER,
        isActive: true
      });

      if (!manager) {
        return createErrorResponse('Менеджер не найден или неактивен', 404);
      }
    }

    // Сохраняем предыдущего менеджера для логирования
    const previousManagerId = machine.assignedManagerId;

    // Назначаем нового менеджера (или снимаем назначение)
    machine.assignedManagerId = validatedData.managerId 
      ? new mongoose.Types.ObjectId(validatedData.managerId)
      : undefined;

    await machine.save();

    // Загружаем обновленные данные с populate
    await machine.populate('location', 'name address');
    await machine.populate('assignedManager', 'name email phone');

    // Логируем изменение для аудита
    console.log(`Автомат ${machine.machineId} переназначен:`, {
      previousManager: previousManagerId?.toString(),
      newManager: validatedData.managerId,
      assignedBy: request.user!.userId,
      timestamp: new Date()
    });

    const enrichedMachine = {
      ...machine.toObject(),
      stockPercentage: Math.round((machine.stock / machine.capacity) * 100),
      needsRefill: machine.stock < 150,
      isEmpty: machine.stock === 0,
      canStartRefill: machine.status !== 'IN_SERVICE'
    };

    return createSuccessResponse({ 
      machine: enrichedMachine,
      message: manager 
        ? `Автомат назначен менеджеру ${manager.name}`
        : 'Назначение менеджера снято'
    });

  } catch (error) {
    console.error('Ошибка назначения менеджера:', error);

    if (error instanceof Error) {
      if (error.name === 'ZodError') {
        return createErrorResponse('Некорректные данные формы', 400);
      }
      
      return createErrorResponse(error.message, 400);
    }

    return createErrorResponse('Ошибка назначения менеджера', 500);
  }
}

export const POST = withAdminRole(handleAssignManager);
