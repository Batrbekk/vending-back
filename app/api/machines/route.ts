import { 
  withAuth, 
  withAdminRole,
  AuthenticatedRequest, 
  createSuccessResponse, 
  createErrorResponse 
} from '@/lib/auth/middleware';
import { CreateMachineSchema, MachineFiltersSchema } from '@/lib/validation/common';
import { VendingMachine, Location } from '@/entities';
import { MachineStatus, UserRole, IVendingMachine, ILocation, IUser } from '@/types';
import dbConnect from '@/lib/database/connection';
import mongoose from 'mongoose';

// Тип для lean-документа автомата с популяренными виртуальными полями
type MachineWithVirtuals = IVendingMachine & {
  location?: Pick<ILocation, '_id' | 'name' | 'address' | 'geo'>;
  assignedManager?: Pick<IUser, '_id' | 'name' | 'email'>;
};

// Получение списка автоматов
async function handleGetMachines(request: AuthenticatedRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const user = request.user!;
    
    // Валидируем и парсим фильтры
    const rawFilters = {
      status: searchParams.get('status'),
      locationId: searchParams.get('locationId'),
      assignedManagerId: searchParams.get('assignedManagerId'),
      needsRefill: searchParams.get('needsRefill'),
      search: searchParams.get('search')
    };

    // Очищаем null значения для валидации
    const cleanFilters = Object.fromEntries(
      Object.entries(rawFilters).filter(([, value]) => value !== null)
    );

    const filters = MachineFiltersSchema.parse(cleanFilters);
    
    // Пагинация
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const skip = (page - 1) * limit;

    // Построение фильтра для MongoDB
    const mongoFilter: Record<string, unknown> = {};
    
    if (filters.status) {
      mongoFilter.status = filters.status;
    }
    
    if (filters.locationId) {
      mongoFilter.locationId = new mongoose.Types.ObjectId(filters.locationId);
    }
    
    if (filters.assignedManagerId) {
      mongoFilter.assignedManagerId = new mongoose.Types.ObjectId(filters.assignedManagerId);
    }
    
    if (filters.needsRefill) {
      mongoFilter.stock = { $lt: 150 };
      mongoFilter.status = { $in: [MachineStatus.WORKING, MachineStatus.LOW_STOCK, MachineStatus.OUT_OF_STOCK] };
    }
    
    if (filters.search) {
      // Поиск по ID автомата/заметкам и по названию/адресу локации
      const regex = new RegExp(filters.search, 'i');
      // Находим подходящие локации по имени или адресу и используем их _id в фильтре
      const matchedLocations = await Location.find({
        $or: [
          { name: { $regex: regex } },
          { address: { $regex: regex } },
        ],
      })
        .select('_id')
        .lean<{ _id: mongoose.Types.ObjectId }[]>();

      const matchedLocationIds = matchedLocations.map((l) => l._id);

      mongoFilter.$or = [
        { machineId: { $regex: regex } },
        { notes: { $regex: regex } },
        ...(matchedLocationIds.length > 0
          ? [{ locationId: { $in: matchedLocationIds } } as Record<string, unknown>]
          : []),
      ];
    }

    // Если пользователь - менеджер, показываем только назначенные ему автоматы
    if (user.role === UserRole.MANAGER) {
      mongoFilter.assignedManagerId = new mongoose.Types.ObjectId(user.userId);
    }

    // Получаем автоматы с связанными данными
    const [machines, totalCount]: [MachineWithVirtuals[], number] = await Promise.all([
      VendingMachine.find(mongoFilter)
        .populate('location', 'name address geo')
        .populate('assignedManager', 'name email')
        .sort({ 
          // Сортировка: сначала нуждающиеся в пополнении, потом по убыванию остатка
          stock: 1,
          updatedAt: -1 
        })
        .skip(skip)
        .limit(limit)
        .lean<MachineWithVirtuals[]>({ virtuals: true }),
      VendingMachine.countDocuments(mongoFilter)
    ]);

    // Обогащаем данные дополнительной информацией
    const enrichedMachines = machines.map((machine) => ({
      ...machine,
      stockPercentage: Math.round((machine.stock / machine.capacity) * 100),
      needsRefill: machine.stock < machine.capacity * 0.5,
      isEmpty: machine.stock === 0,
      canStartRefill: machine.status !== MachineStatus.IN_SERVICE && machine.status !== MachineStatus.INACTIVE,
      // Уплощённое поле адреса для удобства клиентов API
      locationAddress: machine.location?.address,
    }));

    const totalPages = Math.ceil(totalCount / limit);

    return createSuccessResponse({
      machines: enrichedMachines,
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
    console.error('Ошибка получения автоматов:', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return createErrorResponse('Некорректные параметры фильтрации', 400);
    }

    return createErrorResponse('Ошибка получения автоматов', 500);
  }
}

// Создание нового автомата (только админы)
async function handleCreateMachine(request: AuthenticatedRequest) {
  try {
    await dbConnect();

    const body = await request.json();
    const validatedData = CreateMachineSchema.parse(body);

    // Разрешаем создавать по названию локации: находим или создаём локацию
    if (!validatedData.locationId && validatedData.locationName) {
      const name = validatedData.locationName.trim();
      let location = await Location.findOne({ name });
      if (!location) {
        // Создаём минимальную локацию: address обязательный — используем name как адрес по умолчанию
        location = await Location.create({ name, address: name });
      }
      // Подменяем на найденный/созданный ObjectId
      // @ts-expect-error — validatedData является результатом парсинга Zod, расширяем объект перед сохранением
      validatedData.locationId = location._id as unknown as mongoose.Types.ObjectId;
    }

    // Проверяем существует ли автомат с таким ID
    const existingMachine = await VendingMachine.findOne({ 
      machineId: validatedData.machineId 
    });
    
    if (existingMachine) {
      return createErrorResponse('Автомат с таким ID уже существует', 409);
    }

    // Проверяем существует ли локация (после возможной подстановки по имени)
    const location = await Location.findById(validatedData.locationId);
    if (!location) {
      return createErrorResponse('Локация не найдена', 404);
    }

    // Проверяем назначенного менеджера если указан
    if (validatedData.assignedManagerId) {
      if (!mongoose.connection.db) throw new Error('База данных недоступна');
      const manager = await mongoose.connection.db.collection('users').findOne({
        _id: new mongoose.Types.ObjectId(validatedData.assignedManagerId),
        role: 'MANAGER',
        isActive: true
      });
      
      if (!manager) {
        return createErrorResponse('Указанный менеджер не найден или неактивен', 404);
      }
    }

    // Убираем служебное поле locationName перед сохранением
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { locationName: _omitLocationName, ...dataForSave } = validatedData as typeof validatedData & { locationName?: string };
    const machine = new VendingMachine(dataForSave);
    
    // Устанавливаем правильный статус на основе остатка
    machine.updateStatus();
    
    await machine.save();

    // Возвращаем с populated полями
    await machine.populate('location', 'name address');
    
    const totalStock = machine.getTotalStock();
    const enrichedMachine = {
      ...machine.toObject(),
      stockPercentage: Math.round((totalStock / machine.capacity) * 100),
      needsRefill: totalStock < machine.capacity * 0.5,
      isEmpty: totalStock === 0,
      canStartRefill: machine.status !== MachineStatus.IN_SERVICE && machine.status !== MachineStatus.INACTIVE
    };

    return createSuccessResponse({ machine: enrichedMachine }, 201);

  } catch (error) {
    console.error('Ошибка создания автомата:', error);

    if (error instanceof Error) {
      if (error.name === 'ZodError') {
        return createErrorResponse('Некорректные данные формы', 400);
      }
      
      if (error.message.includes('duplicate key')) {
        return createErrorResponse('Автомат с таким ID уже существует', 409);
      }
      
      return createErrorResponse(error.message, 400);
    }

    return createErrorResponse('Ошибка создания автомата', 500);
  }
}

export const GET = withAuth(handleGetMachines);
export const POST = withAdminRole(handleCreateMachine);
