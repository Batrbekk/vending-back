import { NextRequest } from 'next/server';
import { createSuccessResponse, createErrorResponse } from '@/lib/auth/middleware';
import { CreateSaleSchema } from '@/lib/validation/common';
import { Device, VendingMachine, Sale, Alert, Product } from '@/entities';
import { AlertType, PaymentMethod } from '@/types';
import dbConnect from '@/lib/database/connection';
import mongoose from 'mongoose';

// Регистрация продажи от устройства автомата
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

    // Считываем и подготавливаем данные продажи
    type SaleInput = {
      productId?: string;
      sku?: string;
      price?: number;
      qty?: number;
      paymentMethod?: PaymentMethod;
      receiptId?: string;
    };

    const rawBody = (await request.json().catch(() => ({}))) as SaleInput;

    // Если передали productId — подставляем sku и price из продукта (мок-продажа без эквайринга)
    const preparedBody: SaleInput = { ...rawBody };
    if (rawBody?.productId && mongoose.Types.ObjectId.isValid(String(rawBody.productId))) {
      const product = await Product.findById(String(rawBody.productId)).lean<{ _id: mongoose.Types.ObjectId; price?: number }>();
      if (!product) {
        return createErrorResponse('Продукт не найден', 404);
      }
      preparedBody.sku = String(product._id); // считаем sku = ID продукта для учёта по продуктам
      if (typeof preparedBody.price === 'undefined') {
        preparedBody.price = typeof product.price === 'number' ? product.price : 500; // подставляем цену из продукта (по умолчанию 500)
      }
    }

    // Валидируем данные продажи
    const saleData = CreateSaleSchema.parse({
      ...preparedBody,
      machineId: params.machineId
    });

    // Находим автомат
    const machine = await VendingMachine.findById(params.machineId);
    if (!machine) {
      return createErrorResponse('Автомат не найден', 404);
    }

    // Если автомат не спарен с устройством — блокируем продажу
    if (machine.status === 'UNPAIRED') {
      return createErrorResponse('Автомат не подключён к устройству (UNPAIRED), продажа невозможна', 409);
    }

    // Проверяем что автомат может продавать
    if (machine.status === 'OUT_OF_STOCK') {
      return createErrorResponse('Автомат пустой, продажа невозможна', 409);
    }

    if (machine.status === 'IN_SERVICE') {
      return createErrorResponse('Автомат обслуживается, продажа невозможна', 409);
    }

    if (machine.status === 'ERROR') {
      return createErrorResponse('Автомат в состоянии ошибки, продажа невозможна', 409);
    }

    // Проверяем остаток конкретного продукта
    const productId = saleData.productId || saleData.sku;
    const productStock = machine.getProductStock(productId);
    if (productStock < saleData.qty) {
      return createErrorResponse(`Недостаточно товара. Доступно: ${productStock}`, 400);
    }

    const session = await mongoose.startSession();

    try {
      const result = await session.withTransaction(async () => {
        // Создаем запись о продаже
        const sale = new Sale({
          machineId: machine._id as mongoose.Types.ObjectId,
          sku: saleData.sku,
          price: saleData.price,
          qty: saleData.qty,
          total: saleData.price * saleData.qty,
          paidAt: new Date(),
          paymentMethod: saleData.paymentMethod,
          receiptId: saleData.receiptId
        });

        await sale.save({ session });

        // Сохраняем старые значения для логирования
        const oldTotalStock = machine.getTotalStock();
        const oldStatus = machine.status;

        // Уменьшаем остаток конкретного продукта
        const success = machine.reduceStock(saleData.productId || saleData.sku, saleData.qty);
        if (!success) {
          throw new Error('Не удалось списать товар');
        }

        machine.lastTelemetryAt = new Date();
        await machine.save({ session });

        // Создаем алерты при критических уровнях остатка
        if (machine.status === 'OUT_OF_STOCK' && oldStatus !== 'OUT_OF_STOCK') {
          await Alert.createIfNotExists(machine._id as mongoose.Types.ObjectId, AlertType.OUT_OF_STOCK);
        } else if (machine.status === 'LOW_STOCK' && oldStatus !== 'LOW_STOCK') {
          await Alert.createIfNotExists(machine._id as mongoose.Types.ObjectId, AlertType.LOW_STOCK);
        }

        return {
          sale: sale.toObject(),
          stockChange: {
            before: oldTotalStock,
            after: machine.stock,
            reduced: saleData.qty,
            productId: productId,
            productStockBefore: productStock,
            productStockAfter: machine.getProductStock(productId)
          },
          statusChange: oldStatus !== machine.status ? {
            from: oldStatus,
            to: machine.status
          } : null
        };
      });

      // Обновляем heartbeat устройства
      await device.updateHeartbeat();

      // Логируем продажу
      console.log(`Продажа в автомате ${machine.machineId}:`, {
        deviceId: device._id,
        saleId: result.sale._id,
        sku: saleData.sku,
        price: saleData.price,
        qty: saleData.qty,
        total: result.sale.total,
        paymentMethod: saleData.paymentMethod,
        stockBefore: result.stockChange.before,
        stockAfter: result.stockChange.after,
        newStatus: machine.status,
        timestamp: new Date()
      });

      return createSuccessResponse({
        status: 'ok',
        sale: {
          id: result.sale._id,
          total: result.sale.total,
          timestamp: result.sale.paidAt
        },
        machine: {
          stock: machine.stock,
          status: machine.status,
          stockPercentage: Math.round((machine.stock / machine.capacity) * 100)
        },
        changes: {
          stockReduced: saleData.qty,
          statusChanged: !!result.statusChange
        }
      }, 201);

    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }

  } catch (error) {
    console.error('Ошибка регистрации продажи:', error);

    if (error instanceof Error) {
      if (error.name === 'ZodError') {
        return createErrorResponse('Некорректные данные продажи', 400);
      }
      return createErrorResponse(error.message, 400);
    }

    return createErrorResponse('Ошибка регистрации продажи', 500);
  }
}
