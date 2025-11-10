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

    // Находим устройство
    const device = await Device.findByApiKey(apiKey);
    if (!device) {
      return createErrorResponse('Недействительный API ключ', 401);
    }

    // Проверяем соответствие устройства автомату
    if (device.machineId.toString() !== machineId) {
      return createErrorResponse('API ключ не соответствует автомату', 403);
    }

    // Находим автомат
    const machine = await VendingMachine.findById(machineId).populate('inventory.productId');
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

    // Получаем информацию о наличии и ценах из inventory автомата
    const productStock = machine.getProductStockObject();

    const response = {
      products: products.map((p) => {
        const inventoryItem = machine.inventory.find(
          (item: any) => item.productId?._id?.toString() === p._id.toString()
        );

        return {
          _id: p._id.toString(),
          name: p.name,
          image: p.image,
          price: inventoryItem?.price || (p as { price?: number }).price || 500,
          quantity: productStock[p._id.toString()] || 0,
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
    console.error('Ошибка получения продуктов для автомата:', error);
    return createErrorResponse('Ошибка получения продуктов', 500);
  }
}
