import { NextRequest } from 'next/server';
import { createSuccessResponse, createErrorResponse } from '@/lib/auth/middleware';
import { Device, VendingMachine, Sale, Transaction, Alert, Product } from '@/entities';
import { AlertType, PaymentMethod } from '@/types';
import dbConnect from '@/lib/database/connection';
import mongoose from 'mongoose';
import { z } from 'zod';

const PurchaseItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().positive()
});

const PurchaseSchema = z.object({
  items: z.array(PurchaseItemSchema).min(1),
  paymentMethod: z.nativeEnum(PaymentMethod).default(PaymentMethod.CARD)
});

// Обработка покупки корзины как единой транзакции
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
    if (device.machineId.toString() !== machineId) {
      return createErrorResponse('API ключ не соответствует автомату', 403);
    }

    // Валидируем данные покупки
    const rawBody = await request.json();
    const purchaseData = PurchaseSchema.parse(rawBody);

    // Находим автомат
    const machine = await VendingMachine.findById(machineId);
    if (!machine) {
      return createErrorResponse('Автомат не найден', 404);
    }

    // Проверяем статус автомата
    if (machine.status === 'UNPAIRED') {
      return createErrorResponse('Автомат не подключён к устройству (UNPAIRED), покупка невозможна', 409);
    }

    if (machine.status === 'OUT_OF_STOCK') {
      return createErrorResponse('Автомат пустой, покупка невозможна', 409);
    }

    if (machine.status === 'IN_SERVICE') {
      return createErrorResponse('Автомат обслуживается, покупка невозможна', 409);
    }

    if (machine.status === 'ERROR') {
      return createErrorResponse('Автомат в состоянии ошибки, покупка невозможна', 409);
    }

    // Проверяем наличие всех продуктов. Остаток считаем через slotStock
    // (реальные банки в физических слотах), а не deprecated productStock.
    const productDetails = await Promise.all(
      purchaseData.items.map(async (item) => {
        if (!mongoose.Types.ObjectId.isValid(item.productId)) {
          throw new Error(`Некорректный ID продукта: ${item.productId}`);
        }

        const product = await Product.findById(item.productId).lean<{
          _id: mongoose.Types.ObjectId;
          name?: string;
          price?: number;
        }>();

        if (!product) {
          throw new Error(`Продукт не найден: ${item.productId}`);
        }

        const productId = String(product._id);
        const available = machine.getProductQuantity(productId);

        if (available < item.quantity) {
          throw new Error(`Недостаточно товара "${product.name || productId}". Доступно: ${available}`);
        }

        return {
          productId,
          sku: productId,
          name: product.name || 'Без названия',
          price: typeof product.price === 'number' ? product.price : 500,
          quantity: item.quantity,
          subtotal: (typeof product.price === 'number' ? product.price : 500) * item.quantity
        };
      })
    );

    // Вычисляем общую сумму
    const totalAmount = productDetails.reduce((sum, item) => sum + item.subtotal, 0);

    const session = await mongoose.startSession();

    try {
      const result = await session.withTransaction(async () => {
        // Генерируем номера чека и заказа
        const receiptNumber = await Transaction.getNextReceiptNumber(machine._id as mongoose.Types.ObjectId);
        const orderNumber = await Transaction.getNextOrderNumber();

        // Создаем транзакцию
        const transaction = new Transaction({
          machineId: machine._id as mongoose.Types.ObjectId,
          receiptNumber,
          orderNumber,
          items: productDetails,
          totalAmount,
          paymentMethod: purchaseData.paymentMethod,
          paidAt: new Date()
        });

        await transaction.save({ session });

        // Создаём Sale-записи и одновременно резервируем физические слоты
        // под весь заказ — backend сам решает, из каких гнёзд выдавать (по
        // 5 банок на слот, по очереди (row, column)). Возвращает массив
        // позиций ровно в порядке списания — планшет будет слать SHIP в этом
        // же порядке.
        const sales = [];
        const oldTotalStock = machine.getTotalStock();
        const oldStatus = machine.status;

        const dispensePlan = machine.allocateForOrder(
          productDetails.map((p) => ({ productId: p.productId, quantity: p.quantity }))
        );
        if (!dispensePlan) {
          throw new Error('Не удалось зарезервировать слоты под заказ (недостаточно банок в гнёздах)');
        }

        for (const item of productDetails) {
          const sale = new Sale({
            machineId: machine._id as mongoose.Types.ObjectId,
            sku: item.sku,
            price: item.price,
            qty: item.quantity,
            total: item.subtotal,
            paidAt: transaction.paidAt,
            paymentMethod: transaction.paymentMethod,
            receiptId: `T${transaction.orderNumber}-R${transaction.receiptNumber}`
          });

          await sale.save({ session });
          sales.push(sale);
        }

        machine.lastTelemetryAt = new Date();
        machine.updateStatus();
        await machine.save({ session });

        // Создаем алерты при критических уровнях остатка
        if (machine.status === 'OUT_OF_STOCK' && oldStatus !== 'OUT_OF_STOCK') {
          await Alert.createIfNotExists(machine._id as mongoose.Types.ObjectId, AlertType.OUT_OF_STOCK);
        } else if (machine.status === 'LOW_STOCK' && oldStatus !== 'LOW_STOCK') {
          await Alert.createIfNotExists(machine._id as mongoose.Types.ObjectId, AlertType.LOW_STOCK);
        }

        return {
          transaction: transaction.toObject(),
          sales,
          dispensePlan,
          stockChange: {
            before: oldTotalStock,
            after: machine.stock
          },
          statusChange: oldStatus !== machine.status ? {
            from: oldStatus,
            to: machine.status
          } : null
        };
      });

      // Обновляем heartbeat устройства
      await device.updateHeartbeat();

      // Логируем транзакцию
      console.log(`✅ Транзакция в автомате ${machine.machineId}:`, {
        deviceId: device._id,
        transactionId: result.transaction._id,
        orderNumber: result.transaction.orderNumber,
        receiptNumber: result.transaction.receiptNumber,
        itemsCount: result.transaction.items.length,
        totalAmount: result.transaction.totalAmount,
        paymentMethod: result.transaction.paymentMethod,
        stockBefore: result.stockChange.before,
        stockAfter: result.stockChange.after,
        newStatus: machine.status,
        timestamp: new Date()
      });

      return createSuccessResponse({
        status: 'ok',
        transaction: {
          id: result.transaction._id,
          orderNumber: result.transaction.orderNumber,
          receiptNumber: result.transaction.receiptNumber,
          items: result.transaction.items,
          totalAmount: result.transaction.totalAmount,
          timestamp: result.transaction.paidAt
        },
        // План физической выдачи: { productId, row, column }[] в порядке списания
        // Планшет берёт его как очередь и шлёт SHIP в этом же порядке.
        dispensePlan: result.dispensePlan,
        machine: {
          stock: machine.stock,
          status: machine.status,
          stockPercentage: Math.round((machine.stock / machine.capacity) * 100)
        },
        changes: {
          stockReduced: result.stockChange.before - result.stockChange.after,
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
    console.error('❌ Ошибка обработки покупки:', error);

    if (error instanceof Error) {
      if (error.name === 'ZodError') {
        return createErrorResponse('Некорректные данные покупки', 400);
      }
      return createErrorResponse(error.message, 400);
    }

    return createErrorResponse('Ошибка обработки покупки', 500);
  }
}
