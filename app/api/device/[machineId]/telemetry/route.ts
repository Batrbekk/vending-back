import { NextRequest } from 'next/server';
import { createSuccessResponse, createErrorResponse } from '@/lib/auth/middleware';
import { TelemetrySchema } from '@/lib/validation/common';
import { Device, VendingMachine, Alert } from '@/entities';
import { AlertType, MachineStatus } from '@/types';
import dbConnect from '@/lib/database/connection';
import mongoose from 'mongoose';

// Получение телеметрии от устройства автомата
export async function POST(
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

    // Валидируем телеметрию
    const body = await request.json();
    const telemetryData = TelemetrySchema.parse(body);

    // Находим автомат
    const machine = await VendingMachine.findById(params.machineId);
    if (!machine) {
      return createErrorResponse('Автомат не найден', 404);
    }

    let hasChanges = false;
    const changes: Record<string, { old: unknown; new: unknown; }> = {};

    // Обновляем время последней телеметрии
    machine.lastTelemetryAt = new Date();
    await device.updateHeartbeat();

    // Обрабатываем обновление остатка
    if (telemetryData.stock !== undefined) {
      const oldTotalStock = machine.stock;
      const newTotalStock = telemetryData.stock;
      
      // Проверяем на значительное расхождение (drift)
      const stockDifference = Math.abs(oldTotalStock - newTotalStock);
      const driftThreshold = Math.max(5, Math.ceil(machine.capacity * 0.05)); // 5% от вместимости или минимум 5
      
      if (stockDifference >= driftThreshold) {
        await Alert.createIfNotExists(
          machine._id as mongoose.Types.ObjectId,
          AlertType.DRIFT,
          `Обнаружено расхождение в остатках: система показывала ${oldTotalStock}, устройство сообщает ${newTotalStock} (расхождение: ${stockDifference})`
        );
      }

      // Обновляем productStock пропорционально
      if (newTotalStock > 0) {
        const currentProductStock = machine.getProductStockObject();
        const productIds = Object.keys(currentProductStock);
        
        if (productIds.length > 0) {
          // Если есть текущие остатки, распределяем пропорционально
          if (oldTotalStock > 0) {
            const ratio = newTotalStock / oldTotalStock;
            productIds.forEach(productId => {
              const newProductStock = Math.floor(currentProductStock[productId] * ratio);
              machine.setProductStock(productId, newProductStock);
            });
          } else {
            // Если остатков не было, распределяем равномерно
            const stockPerProduct = Math.floor(newTotalStock / productIds.length);
            const remainder = newTotalStock % productIds.length;
            
            productIds.forEach((productId, index) => {
              const stock = stockPerProduct + (index < remainder ? 1 : 0);
              machine.setProductStock(productId, stock);
            });
          }
        }
      } else {
        // Если остаток 0, обнуляем все продукты
        const currentProductStock = machine.getProductStockObject();
        Object.keys(currentProductStock).forEach(productId => {
          machine.setProductStock(productId, 0);
        });
      }

      changes.stock = { old: oldTotalStock, new: machine.stock };
      hasChanges = true;

      // Пересчитываем статус
      const oldStatus = machine.status;
      machine.updateStatus();
      
      if (oldStatus !== machine.status) {
        changes.status = { old: oldStatus, new: machine.status };
        
        // Создаем алерты при изменении статуса
        if (machine.status === 'LOW_STOCK') {
          await Alert.createIfNotExists(machine._id as mongoose.Types.ObjectId, AlertType.LOW_STOCK);
        } else if (machine.status === 'OUT_OF_STOCK') {
          await Alert.createIfNotExists(machine._id as mongoose.Types.ObjectId, AlertType.OUT_OF_STOCK);
        }
      }
    }

    // Обрабатываем коды ошибок
    if (telemetryData.errorCode) {
      const oldStatus = machine.status;
      machine.status = MachineStatus.ERROR;
      
      await Alert.createIfNotExists(
        machine._id as mongoose.Types.ObjectId,
        AlertType.ERROR,
        `Ошибка устройства: ${telemetryData.errorCode}`
      );

      if (oldStatus !== machine.status) {
        changes.status = { old: oldStatus, new: machine.status };
        hasChanges = true;
      }
    }

    // Сохраняем изменения
    if (hasChanges) {
      await machine.save();
    }

    // Логируем телеметрию
    console.log(`Телеметрия от автомата ${machine.machineId}:`, {
      deviceId: device._id,
      telemetryData,
      changes,
      machineStatus: machine.status,
      timestamp: new Date()
    });

    // Здесь можно добавить отправку WebSocket события о изменениях
    // if (hasChanges) {
    //   await broadcastMachineUpdate(machine._id, changes);
    // }

    return createSuccessResponse({
      status: 'ok',
      processed: telemetryData,
      changes,
      machineStatus: machine.status,
      timestamp: new Date()
    });

  } catch (error) {
    console.error('Ошибка обработки телеметрии:', error);

    if (error instanceof Error) {
      if (error.name === 'ZodError') {
        return createErrorResponse('Некорректные данные телеметрии', 400);
      }
      
      return createErrorResponse(error.message, 400);
    }

    return createErrorResponse('Ошибка обработки телеметрии', 500);
  }
}
