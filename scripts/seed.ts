import 'dotenv/config';
import mongoose from 'mongoose';
import { PasswordService } from '../lib/auth/password';
import { User, Location, VendingMachine, Device, Sale, RefillLog, Alert, UserDocument, LocationDocument, VendingMachineDocument } from '../entities';
import { UserRole, PaymentMethod, AlertType } from '../types';

async function connectDB() {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/vending-machines';
  
  console.log('🔍 MONGODB_URI:', MONGODB_URI ? 'найден' : 'не найден');
  console.log('🔍 Переменные окружения загружены:', process.env.MONGODB_URI ? 'да' : 'нет');
  
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Подключен к MongoDB');
  } catch (error) {
    console.error('❌ Ошибка подключения к MongoDB:', error);
    process.exit(1);
  }
}

async function clearDatabase() {
  console.log('🧹 Очистка базы данных...');
  
  if (!mongoose.connection.db) throw new Error('База данных недоступна');
  
  await Promise.all([
    User.deleteMany({}),
    Location.deleteMany({}),
    VendingMachine.deleteMany({}),
    Device.deleteMany({}),
    Sale.deleteMany({}),
    RefillLog.deleteMany({}),
    Alert.deleteMany({}),
    // Очищаем активные сессии пополнений
    mongoose.connection.db.collection('active_refill_sessions').deleteMany({})
  ]);

  console.log('✅ База данных очищена');
}

async function seedUsers() {
  console.log('👥 Создание пользователей...');

  const adminPassword = await PasswordService.hashPassword('Aa12345!');
  const manager1Password = await PasswordService.hashPassword('manager123');
  const manager2Password = await PasswordService.hashPassword('manager456');

  const users = [
    {
      email: 'admin@gigross.kz',
      passwordHash: adminPassword,
      name: 'Kuandyk Batyrbek',
      role: UserRole.ADMIN,
      phone: '+77001234567',
      isActive: true
    }
  ];

  const createdUsers = await User.insertMany(users);
  console.log(`✅ Создано пользователей: ${createdUsers.length}`);
  
  return createdUsers;
}

async function seedLocations() {
  console.log('📍 Создание локаций...');

  const locations = [
    {
      name: 'ТРЦ Dostyk Plaza',
      address: 'ул. Достык, 111, Алматы',
      geo: { lat: 43.2567, lng: 76.9286 },
      timezone: 'Asia/Almaty'
    },
    {
      name: 'Университет КазНУ',
      address: 'пр. аль-Фараби, 71, Алматы', 
      geo: { lat: 43.2370, lng: 76.9422 },
      timezone: 'Asia/Almaty'
    },
    {
      name: 'Станция метро Алмалы',
      address: 'ул. Толе би, Алматы',
      geo: { lat: 43.2508, lng: 76.9125 },
      timezone: 'Asia/Almaty'
    },
    {
      name: 'Бизнес-центр Нурлы Тау',
      address: 'пр. Назарбаева, 223, Алматы',
      geo: { lat: 43.2384, lng: 76.9049 },
      timezone: 'Asia/Almaty'
    },
    {
      name: 'Парк Кок-Тобе',
      address: 'Кок-Тобе, Алматы',
      geo: { lat: 43.2465, lng: 76.9069 },
      timezone: 'Asia/Almaty'
    }
  ];

  const createdLocations = await Location.insertMany(locations);
  console.log(`✅ Создано локаций: ${createdLocations.length}`);
  
  return createdLocations;
}

async function seedMachines(locations: LocationDocument[], users: UserDocument[]) {
  console.log('🤖 Создание автоматов...');

  const managers = users.filter(u => u.role === UserRole.MANAGER);
  
  const machines = [
    // Dostyk Plaza
    { machineId: 'VM-001', locationId: locations[0]._id, stock: 45, capacity: 360, assignedManagerId: managers[0]._id },
    { machineId: 'VM-002', locationId: locations[0]._id, stock: 200, capacity: 360, assignedManagerId: managers[0]._id },
    
    // КазНУ
    { machineId: 'VM-003', locationId: locations[1]._id, stock: 0, capacity: 360, assignedManagerId: managers[1]._id },
    { machineId: 'VM-004', locationId: locations[1]._id, stock: 120, capacity: 360, assignedManagerId: managers[1]._id },
    
    // Алмалы
    { machineId: 'VM-005', locationId: locations[2]._id, stock: 300, capacity: 360 },
    
    // Нурлы Тау
    { machineId: 'VM-006', locationId: locations[3]._id, stock: 180, capacity: 360, assignedManagerId: managers[0]._id },
    { machineId: 'VM-007', locationId: locations[3]._id, stock: 90, capacity: 360, assignedManagerId: managers[1]._id },
    
    // Кок-Тобе  
    { machineId: 'VM-008', locationId: locations[4]._id, stock: 250, capacity: 360 }
  ];

  const createdMachines = [];
  
  for (const machineData of machines) {
    const machine = new VendingMachine(machineData);
    machine.updateStatus(); // Установим правильный статус
    await machine.save();
    createdMachines.push(machine);
  }

  console.log(`✅ Создано автоматов: ${createdMachines.length}`);
  return createdMachines;
}

async function seedDevices(machines: VendingMachineDocument[]) {
  console.log('📱 Создание устройств...');

  const devices = machines.map(machine => ({
    machineId: machine._id,
    firmwareVersion: `1.${Math.floor(Math.random() * 5)}.${Math.floor(Math.random() * 10)}`,
    lastHeartbeatAt: new Date(Date.now() - Math.random() * 3600000) // Последний сигнал в течение часа
  }));

  const createdDevices = await Device.insertMany(devices);
  console.log(`✅ Создано устройств: ${createdDevices.length}`);
  
  return createdDevices;
}

async function seedSales(machines: VendingMachineDocument[]) {
  console.log('💰 Создание продаж...');

  const drinks = [
    { sku: 'COCA_COLA_0.5', price: 250 },
    { sku: 'SPRITE_0.5', price: 250 },
    { sku: 'FANTA_0.5', price: 250 },
    { sku: 'WATER_0.5', price: 150 },
    { sku: 'JUICE_0.3', price: 300 },
    { sku: 'ENERGY_0.25', price: 400 }
  ];

  const paymentMethods = [PaymentMethod.CARD, PaymentMethod.CASH, PaymentMethod.ONLINE];
  const sales = [];

  // Создаем продажи за последние 30 дней
  for (let i = 0; i < 500; i++) {
    const machine = machines[Math.floor(Math.random() * machines.length)];
    const drink = drinks[Math.floor(Math.random() * drinks.length)];
    const paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
    const qty = Math.random() < 0.8 ? 1 : 2; // 80% покупок - 1 товар
    
    // Случайное время в последние 30 дней
    const daysAgo = Math.floor(Math.random() * 30);
    const hoursAgo = Math.floor(Math.random() * 24);
    const paidAt = new Date();
    paidAt.setDate(paidAt.getDate() - daysAgo);
    paidAt.setHours(hoursAgo);

    sales.push({
      machineId: machine._id,
      sku: drink.sku,
      price: drink.price,
      qty,
      total: drink.price * qty,
      paidAt,
      paymentMethod,
      receiptId: `RCP-${Date.now()}-${i}`
    });
  }

  const createdSales = await Sale.insertMany(sales);
  console.log(`✅ Создано продаж: ${createdSales.length}`);
  
  return createdSales;
}

async function seedRefillLogs(machines: VendingMachineDocument[], users: UserDocument[]) {
  console.log('🔄 Создание логов пополнений...');

  const managers = users.filter(u => u.role === UserRole.MANAGER);
  const refills = [];

  // Создаем историю пополнений за последние 30 дней
  for (let i = 0; i < 50; i++) {
    const machine = machines[Math.floor(Math.random() * machines.length)];
    const manager = managers[Math.floor(Math.random() * managers.length)];
    
    const daysAgo = Math.floor(Math.random() * 30);
    const startedAt = new Date();
    startedAt.setDate(startedAt.getDate() - daysAgo);
    startedAt.setHours(Math.floor(Math.random() * 24));
    
    const finishedAt = new Date(startedAt);
    finishedAt.setMinutes(startedAt.getMinutes() + 15 + Math.floor(Math.random() * 45)); // 15-60 минут

    const before = Math.floor(Math.random() * 150); // Остаток до пополнения
    const added = 200 + Math.floor(Math.random() * 160); // Добавлено 200-360
    const after = Math.min(before + added, machine.capacity);

    refills.push({
      machineId: machine._id,
      managerId: manager._id,
      startedAt,
      finishedAt,
      before,
      added,
      after,
      comment: Math.random() < 0.3 ? 'Плановое пополнение' : undefined
    });
  }

  const createdRefills = await RefillLog.insertMany(refills);
  console.log(`✅ Создано логов пополнений: ${createdRefills.length}`);
  
  return createdRefills;
}

async function seedAlerts(machines: VendingMachineDocument[]) {
  console.log('🚨 Создание алертов...');

  const alerts = [];

  // Создаем алерты для автоматов с низким остатком
  for (const machine of machines) {
    if (machine.stock < 150) {
      const alertType = machine.stock === 0 ? AlertType.OUT_OF_STOCK : AlertType.LOW_STOCK;
      
      alerts.push({
        machineId: machine._id,
        type: alertType,
        message: machine.stock === 0 
          ? 'Товары полностью закончились'
          : `Остаток товаров критически низкий: ${machine.stock} шт.`,
        createdAt: new Date(Date.now() - Math.random() * 86400000), // В течение дня
        resolvedAt: Math.random() < 0.3 ? new Date() : undefined // 30% алертов разрешены
      });
    }
  }

  // Добавляем несколько алертов об ошибках
  for (let i = 0; i < 5; i++) {
    const machine = machines[Math.floor(Math.random() * machines.length)];
    
    alerts.push({
      machineId: machine._id,
      type: AlertType.ERROR,
      message: 'Ошибка системы охлаждения',
      createdAt: new Date(Date.now() - Math.random() * 604800000), // В течение недели
      resolvedAt: Math.random() < 0.7 ? new Date() : undefined // 70% разрешены
    });
  }

  if (alerts.length > 0) {
    const createdAlerts = await Alert.insertMany(alerts);
    console.log(`✅ Создано алертов: ${createdAlerts.length}`);
    return createdAlerts;
  }

  console.log('✅ Алерты не требуются');
  return [];
}

async function seed() {
  try {
    console.log('🌱 Начинаем заполнение базы тестовыми данными...\n');
    console.log(process.env.MONGODB_URI)

    await connectDB();
    await clearDatabase();

    const users = await seedUsers();
    const locations = await seedLocations();
    const machines = await seedMachines(locations, users);
    const devices = await seedDevices(machines);
    const sales = await seedSales(machines);
    const refills = await seedRefillLogs(machines, users);
    const alerts = await seedAlerts(machines);

    console.log('\n🎉 Заполнение базы данных завершено!');
    console.log('📊 Статистика:');
    console.log(`   👥 Пользователи: ${users.length}`);
    console.log(`   📍 Локации: ${locations.length}`);
    console.log(`   🤖 Автоматы: ${machines.length}`);
    console.log(`   📱 Устройства: ${devices.length}`);
    console.log(`   💰 Продажи: ${sales.length}`);
    console.log(`   🔄 Пополнения: ${refills.length}`);
    console.log(`   🚨 Алерты: ${alerts.length}`);

    console.log('\n🔑 Тестовые аккаунты:');
    console.log('   Админ: admin@vendingapp.kz / admin123');
    console.log('   Менеджер 1: manager1@vendingapp.kz / manager123');  
    console.log('   Менеджер 2: manager2@vendingapp.kz / manager456');

  } catch (error) {
    console.error('❌ Ошибка при заполнении базы данных:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Соединение с базой данных закрыто');
    process.exit(0);
  }
}

// Запускаем скрипт если вызван напрямую
if (require.main === module) {
  seed();
}

export default seed;
