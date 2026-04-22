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

    // Получаем информацию о наличии и ценах из inventory автомата
    let productStock: Record<string, number> = {};
    let machineObj: any = null;

    try {
      productStock = machine.getProductStockObject ? machine.getProductStockObject() : {};
      console.log('🔔 [DEV MODE] ProductStock retrieved successfully');
    } catch (error) {
      console.error('🔴 [DEV MODE] Error getting productStock:', error);
    }

    try {
      machineObj = machine.toObject();
      console.log('🔔 [DEV MODE] Machine inventory length:', machineObj.inventory?.length || 0);
    } catch (error) {
      console.error('🔴 [DEV MODE] Error converting machine to object:', error);
    }

    const response = {
      products: products.map((p) => {
        let inventoryItem = null;
        if (machineObj?.inventory) {
          inventoryItem = machineObj.inventory.find(
            (item: any) => item.productId?._id?.toString() === p._id.toString()
          );
        }

        return {
          _id: p._id.toString(),
          name: p.name,
          image: p.image,
          price: inventoryItem?.price || (p as { price?: number }).price || 500,
          quantity: productStock[p._id.toString()] || 0,
          nutrition: (p as { nutrition?: any }).nutrition ?? { calories: 0, protein: 0, fat: 0, carbs: 0 },
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
