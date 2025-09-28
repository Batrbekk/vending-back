import { 
  withAuth, 
  withAdminRole,
  AuthenticatedRequest, 
  createSuccessResponse, 
  createErrorResponse 
} from '@/lib/auth/middleware';
import { CreateLocationSchema } from '@/lib/validation/common';
import { Location, LocationDocument } from '@/entities';
import dbConnect from '@/lib/database/connection';

// Получение списка локаций
async function handleGetLocations(request: AuthenticatedRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    
    // Параметры поиска
    const search = searchParams.get('search');
    const withStats = searchParams.get('withStats') === 'true';
    
    // Пагинация
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const skip = (page - 1) * limit;

    // Фильтр поиска
    const filter: Record<string, unknown> = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } }
      ];
    }

    let locationsQuery = Location.find(filter)
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit);

    // Если нужна статистика - добавляем информацию об автоматах
    if (withStats) {
      locationsQuery = locationsQuery.populate({
        path: 'machines',
        select: 'status stock capacity'
      });
    }

    const [locations, totalCount] = await Promise.all([
      locationsQuery.exec(),
      Location.countDocuments(filter)
    ]);

    // Если нужна статистика, подсчитываем её
    const locationsWithStats = withStats ? locations.map((location: LocationDocument & { machines?: { status: string; capacity: number; stock: number; }[] }) => {
      const machines = location.machines || [];
      return {
        ...location.toJSON(),
        stats: {
          totalMachines: machines.length,
          workingMachines: machines.filter((m) => m.status === 'WORKING').length,
          lowStockMachines: machines.filter((m) => m.status === 'LOW_STOCK').length,
          outOfStockMachines: machines.filter((m) => m.status === 'OUT_OF_STOCK').length,
          totalCapacity: machines.reduce((sum: number, m) => sum + m.capacity, 0),
          totalStock: machines.reduce((sum: number, m) => sum + m.stock, 0)
        }
      };
    }) : locations;

    const totalPages = Math.ceil(totalCount / limit);

    return createSuccessResponse({
      locations: locationsWithStats,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('Ошибка получения локаций:', error);
    return createErrorResponse('Ошибка получения локаций', 500);
  }
}

// Создание новой локации (только админы)
async function handleCreateLocation(request: AuthenticatedRequest) {
  try {
    await dbConnect();

    const body = await request.json();
    const validatedData = CreateLocationSchema.parse(body);

    // Проверяем уникальность названия в рамках одного адреса
    const existingLocation = await Location.findOne({
      name: validatedData.name,
      address: validatedData.address
    });

    if (existingLocation) {
      return createErrorResponse('Локация с таким названием и адресом уже существует', 409);
    }

    const location = new Location(validatedData);
    await location.save();

    return createSuccessResponse({ location }, 201);

  } catch (error) {
    console.error('Ошибка создания локации:', error);

    if (error instanceof Error) {
      if (error.name === 'ZodError') {
        return createErrorResponse('Некорректные данные формы', 400);
      }
      
      return createErrorResponse(error.message, 400);
    }

    return createErrorResponse('Ошибка создания локации', 500);
  }
}

export const GET = withAuth(handleGetLocations);
export const POST = withAdminRole(handleCreateLocation);
