import { NextRequest } from 'next/server';
import { createSuccessResponse, createErrorResponse } from '@/lib/auth/middleware';
import { Device, VendingMachine } from '@/entities';
import dbConnect from '@/lib/database/connection';
import mongoose from 'mongoose';

// Heartbeat от устройства автомата
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ machineId: string }> }
) {
  try {
    await dbConnect();

    const { machineId } = await params;

    if (!mongoose.Types.ObjectId.isValid(machineId)) {
      return createErrorResponse('Некорректный ID автомата', 400);
    }

    // Проверяем API ключ из заголовка
    const apiKey = request.headers.get('X-API-KEY');
    if (!apiKey) {
      return createErrorResponse('API ключ отсутствует', 401);
    }

    // Находим устройство по API ключу
    const device = await Device.findByApiKey(apiKey);
    if (!device) {
      return createErrorResponse('Недействительный API ключ', 401);
    }

    // Проверяем что устройство принадлежит указанному автомату
    if (device.machineId.toString() !== machineId) {
      return createErrorResponse('API ключ не соответствует автомату', 403);
    }

    // Обновляем время последнего heartbeat
    await device.updateHeartbeat();

    // Получаем данные из тела запроса (опционально)
    let telemetryData = {};
    try {
      const body = await request.json();
      telemetryData = body || {};
    } catch {
      // Игнорируем ошибки парсинга JSON для простых heartbeat запросов
    }

    // Логируем heartbeat для мониторинга
    console.log(`Heartbeat от автомата ${device.machine?.machineId || machineId}:`, {
      deviceId: device._id,
      machineId: machineId,
      isOnline: device.isOnline,
      firmwareVersion: device.firmwareVersion,
      telemetryData,
      timestamp: new Date()
    });

    // Возвращаем статус автомата и команды если есть
    const machine = await VendingMachine.findById(machineId);
    
    const response = {
      status: 'ok',
      timestamp: new Date(),
      machineStatus: machine?.status || 'UNKNOWN',
      commands: [] as { type: string; message: string; }[] // Здесь можно передавать команды устройству
    };

    // Добавляем команды основываясь на статусе автомата
    if (machine) {
      switch (machine.status) {
        case 'IN_SERVICE':
          response.commands.push({
            type: 'DISABLE_SALES',
            message: 'Автомат находится в режиме обслуживания'
          });
          break;
        case 'OUT_OF_STOCK':
          response.commands.push({
            type: 'DISABLE_SALES', 
            message: 'Товары закончились'
          });
          break;
        case 'ERROR':
          response.commands.push({
            type: 'SHOW_ERROR',
            message: 'Автомат требует обслуживания'
          });
          break;
      }
    }

    return createSuccessResponse(response);

  } catch (error) {
    console.error('Ошибка обработки heartbeat:', error);
    return createErrorResponse('Ошибка обработки heartbeat', 500);
  }
}
