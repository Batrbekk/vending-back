import { NextRequest } from 'next/server';
import { createSuccessResponse, createErrorResponse } from '@/lib/auth/middleware';
import { Device, VendingMachine } from '@/entities';
import dbConnect from '@/lib/database/connection';
import mongoose from 'mongoose';

// Получение состояния автомата от устройства
export async function GET(
  request: NextRequest,
  { params }: { params: { machineId: string } }
) {
  try {
    await dbConnect();

    if (!mongoose.Types.ObjectId.isValid(params.machineId)) {
      return createErrorResponse('Некорректный ID автомата', 400);
    }

    // Проверяем API ключ
    const apiKey = request.headers.get('X-API-KEY');
    if (!apiKey) {
      return createErrorResponse('API ключ отсутствует', 401);
    }

    // Находим устройство
    const device = await Device.findByApiKey(apiKey);
    if (!device) {
      return createErrorResponse('Недействительный API ключ', 401);
    }

    // Проверяем соответствие устройства автомату
    if (device.machineId.toString() !== params.machineId) {
      return createErrorResponse('API ключ не соответствует автомату', 403);
    }

    // Находим автомат
    const machine = await VendingMachine.findById(params.machineId);
    if (!machine) {
      return createErrorResponse('Автомат не найден', 404);
    }

    // Обновляем heartbeat устройства
    await device.updateHeartbeat();

    return createSuccessResponse({
      machine: {
        _id: machine._id,
        machineId: machine.machineId,
        stock: machine.getTotalStock(),
        capacity: machine.capacity,
        status: machine.status,
        stockPercentage: machine.getStockPercentage(),
        productStock: machine.getProductStockObject(),
        lastSync: new Date().toISOString(),
      }
    }, 200);

  } catch (error) {
    console.error('Ошибка получения состояния автомата:', error);
    return createErrorResponse('Ошибка получения состояния автомата', 500);
  }
}
