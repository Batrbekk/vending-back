import { NextRequest } from 'next/server';
import { createSuccessResponse, createErrorResponse } from '@/lib/auth/middleware';
import { Device, VendingMachine } from '@/entities';
import { MachineStatus } from '@/types';
import dbConnect from '@/lib/database/connection';
import mongoose from 'mongoose';

// Callback после успешного подключения планшета
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ machineId: string }> }
) {
  try {
    console.log('🔔 [DEVICE CONNECTED] Callback received');

    await dbConnect();

    const { machineId } = await params;
    console.log('🔔 [DEVICE CONNECTED] Machine ID:', machineId);

    if (!mongoose.Types.ObjectId.isValid(machineId)) {
      return createErrorResponse('Некорректный ID автомата', 400);
    }

    // Проверяем API ключ
    const apiKey = request.headers.get('X-API-KEY');
    console.log('🔔 [DEVICE CONNECTED] API Key:', apiKey ? 'present' : 'missing');

    if (!apiKey) {
      return createErrorResponse('API ключ отсутствует', 401);
    }

    // Находим устройство для проверки авторизации
    const device = await Device.findByApiKey(apiKey);
    console.log('🔔 [DEVICE CONNECTED] Device found:', device ? 'Yes' : 'No');

    if (!device) {
      return createErrorResponse('Недействительный API ключ', 401);
    }

    // Проверяем что устройство привязано к этому автомату
    if (device.machineId.toString() !== machineId) {
      console.log('❌ [DEVICE CONNECTED] Device machineId mismatch:', {
        deviceMachineId: device.machineId.toString(),
        requestMachineId: machineId
      });
      return createErrorResponse('Устройство не привязано к этому автомату', 403);
    }

    // Находим автомат
    const machine = await VendingMachine.findById(machineId);
    if (!machine) {
      return createErrorResponse('Автомат не найден', 404);
    }

    console.log('🔔 [DEVICE CONNECTED] Current machine status:', machine.status);

    // Обновляем статус машины на WORKING если она была UNPAIRED или в другом статусе
    const previousStatus = machine.status;
    machine.status = MachineStatus.WORKING;
    await machine.save();

    console.log('✅ [DEVICE CONNECTED] Machine status updated:', {
      machineId: machine.machineId,
      previousStatus,
      newStatus: machine.status
    });

    // Обновляем lastSeen устройства
    device.lastSeen = new Date();
    await device.save();

    return createSuccessResponse({
      message: 'Устройство успешно подключено',
      machine: {
        _id: machine._id,
        machineId: machine.machineId,
        status: machine.status,
      },
      device: {
        _id: device._id,
        lastSeen: device.lastSeen,
      }
    });
  } catch (error) {
    console.error('❌ [DEVICE CONNECTED] Error:', error);
    console.error('❌ [DEVICE CONNECTED] Error stack:', error instanceof Error ? error.stack : 'No stack');
    return createErrorResponse('Ошибка обработки подключения', 500);
  }
}
