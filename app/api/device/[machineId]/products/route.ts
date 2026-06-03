import { NextRequest } from 'next/server';
import { createSuccessResponse, createErrorResponse } from '@/lib/auth/middleware';
import { Device, VendingMachine } from '@/entities';
import { Product } from '@/entities/Product';
import dbConnect from '@/lib/database/connection';
import mongoose from 'mongoose';

// Получение продуктов для конкретного автомата
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ machineId: string }> }
) {
  try {
    console.log('🔔 [DEV MODE] /api/device/[machineId]/products - Request received');

    await dbConnect();

    const { machineId } = await params;
    console.log('🔔 [DEV MODE] Machine ID:', machineId);

    if (!mongoose.Types.ObjectId.isValid(machineId)) {
      return createErrorResponse('Некорректный ID автомата', 400);
    }

    // Проверяем API ключ
    const apiKey = request.headers.get('X-API-KEY');
    console.log('🔔 [DEV MODE] API Key:', apiKey ? 'present' : 'missing');

    if (!apiKey) {
      return createErrorResponse('API ключ отсутствует', 401);
    }

    // Находим устройство для проверки авторизации
    let device;
    try {
      device = await Device.findByApiKey(apiKey);
      console.log('🔔 [DEV MODE] Device found:', device ? 'Yes' : 'No');
    } catch (deviceError) {
      console.error('🔴 [DEV MODE] Error finding device:', deviceError);
      return createErrorResponse('Ошибка поиска устройства', 500);
    }

    if (!device) {
      return createErrorResponse('Недействительный API ключ', 401);
    }

    // Находим автомат по переданному machineId
    // Не проверяем соответствие device.machineId и machineId,
    // так как устройство может запрашивать товары для любого автомата
    console.log('🔔 [DEV MODE] Looking for machine with ID:', machineId);
    let machine;
    try {
      machine = await VendingMachine.findById(machineId);
      console.log('🔔 [DEV MODE] Machine found:', machine ? 'Yes' : 'No');
    } catch (machineError) {
      console.error('🔴 [DEV MODE] Error finding machine:', machineError);
      return createErrorResponse('Ошибка поиска автомата', 500);
    }

    if (!machine) {
      return createErrorResponse('Автомат не найден', 404);
    }

    // Получаем все продукты
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (search) {
      filter.name = { $regex: new RegExp(search, 'i') };
    }

    const [products, totalCount] = await Promise.all([
      Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Product.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    // Получаем slot-карту и slot-сток. Это источник правды.
    const slotAssignments: Record<string, string> = machine.getSlotAssignments
      ? machine.getSlotAssignments()
      : {};
    const slotStock: Record<string, number> = machine.getSlotStock ? machine.getSlotStock() : {};

    // Реверс-индекс: { productId → отсортированный массив слотов }
    const productSlots: Record<string, { row: number; column: number }[]> = {};
    for (const [key, pid] of Object.entries(slotAssignments)) {
      const [r, c] = key.split('-').map(Number);
      if (!Number.isInteger(r) || !Number.isInteger(c)) continue;
      if (!productSlots[pid]) productSlots[pid] = [];
      productSlots[pid].push({ row: r, column: c });
    }
    for (const arr of Object.values(productSlots)) {
      arr.sort((a, b) => (a.row - b.row) || (a.column - b.column));
    }

    // Сумма stock по слотам конкретного продукта = реальный остаток.
    const productQuantity: Record<string, number> = {};
    for (const [pid, slots] of Object.entries(productSlots)) {
      productQuantity[pid] = slots.reduce(
        (acc, s) => acc + (slotStock[`${s.row}-${s.column}`] ?? 0),
        0
      );
    }

    // Фильтруем: на планшете показываем ТОЛЬКО продукты, которые админ
    // назначил хотя бы на один слот. Без слотов — продукт «не загружен в
    // автомат», ему нечего показывать пользователю.
    const visibleProducts = products.filter((p) => (productSlots[p._id.toString()] ?? []).length > 0);

    const response = {
      products: visibleProducts.map((p) => {
        const idStr = p._id.toString();
        return {
          _id: idStr,
          name: p.name,
          image: p.image,
          price: (p as { price?: number }).price ?? 500,
          // quantity = сумма slotStock по слотам этого продукта (реальные банки)
          quantity: productQuantity[idStr] ?? 0,
          nutrition: (p as { nutrition?: any }).nutrition ?? { calories: 0, protein: 0, fat: 0, carbs: 0 },
          // Массив физических слотов этого продукта (для совместимости со старым
          // dispense-кодом на планшете). Сами банки backend выдаёт через purchase-endpoint.
          slots: productSlots[idStr] ?? [],
        };
      }),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };

    console.log('🔔 [DEV MODE] Response:', JSON.stringify(response, null, 2));

    return createSuccessResponse(response);
  } catch (error) {
    console.error('🔴 [DEV MODE] Ошибка получения продуктов для автомата:', error);
    console.error('🔴 [DEV MODE] Error stack:', error instanceof Error ? error.stack : 'No stack');
    console.error('🔴 [DEV MODE] Error message:', error instanceof Error ? error.message : String(error));
    return createErrorResponse('Ошибка получения продуктов', 500);
  }
}
