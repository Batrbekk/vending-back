/**
 * Sync Cannect stations → vending-back (Location + VendingMachine + Device).
 *
 * Использовать когда набор банок в cannect обновился — это перепишет
 * соответствующие документы в vending-back БД (upsert по cannectStationId).
 *
 * Usage:
 *   npm run sync:cannect
 */
import 'dotenv/config';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { Location, VendingMachine, Device } from '../entities';

const CANNECT_URI =
  process.env.CANNECT_MONGODB_URI ||
  'mongodb+srv://batrbekk_db_user:y5fSRpjIuvYTgzKV@cluster0.10iqk2i.mongodb.net/cannect?retryWrites=true&w=majority&appName=Cluster0';

interface CannectStation {
  _id: { toString(): string };
  name: string;
  type: string;
  location: {
    lat: number;
    lng: number;
    address: string;
    city: string;
    country: string;
    zipCode?: string;
  };
  status: string;
}

async function fetchCannectStations(): Promise<CannectStation[]> {
  const conn = await mongoose
    .createConnection(CANNECT_URI, { serverSelectionTimeoutMS: 10000 })
    .asPromise();
  const stations = (await conn
    .collection('stations')
    .find({})
    .toArray()) as unknown as CannectStation[];
  await conn.close();
  return stations;
}

function shortMachineId(stationId: string, name: string): string {
  // VM-<last 6 of stationId> — pass the VendingMachine regex (A-Z0-9-, 3-20 chars)
  const suffix = stationId.slice(-6).toUpperCase();
  return `VM-${suffix}`;
}

async function run() {
  const mainUri = process.env.MONGODB_URI;
  if (!mainUri) {
    console.error('❌ MONGODB_URI не задан для vending-back');
    process.exit(1);
  }

  console.log('🔍 Читаю станции из cannect...');
  const stations = await fetchCannectStations();
  console.log(`   Найдено станций: ${stations.length}`);

  await mongoose.connect(mainUri);
  console.log('✅ Подключен к vending-back MongoDB');

  let createdMachines = 0;
  let updatedMachines = 0;
  let createdLocations = 0;
  let createdDevices = 0;

  for (const station of stations) {
    const stationIdStr = station._id.toString();

    // 1. Upsert Location (по name — т.к. это уникальный identifier для нашего use case)
    let location = await Location.findOne({ name: station.name });
    if (!location) {
      location = await Location.create({
        name: station.name,
        address: station.location.address
          ? `${station.location.address}, ${station.location.city}`
          : station.location.city,
        geo: { lat: station.location.lat, lng: station.location.lng },
        timezone: 'UTC',
      });
      createdLocations++;
      console.log(`   📍 Создана локация: ${station.name}`);
    }

    // 2. Upsert VendingMachine (по cannectStationId)
    const machineId = shortMachineId(stationIdStr, station.name);
    let machine = await VendingMachine.findOne({ cannectStationId: stationIdStr });

    if (!machine) {
      machine = await VendingMachine.create({
        machineId,
        locationId: location._id,
        capacity: 360,
        stock: 200,
        cannectStationId: stationIdStr,
        displayName: station.name,
      });
      createdMachines++;
      console.log(`   🤖 Создан автомат: ${machineId} → ${station.name}`);
    } else {
      machine.machineId = machineId;
      machine.locationId = location._id as mongoose.Types.ObjectId;
      machine.displayName = station.name;
      await machine.save();
      updatedMachines++;
      console.log(`   🔄 Обновлен автомат: ${machineId} → ${station.name}`);
    }

    // 3. Upsert Device для этой машины
    const existingDevice = await Device.findOne({ machineId: machine._id });
    if (!existingDevice) {
      await Device.create({
        machineId: machine._id,
        apiKey: crypto.randomBytes(24).toString('hex'),
        firmwareVersion: '1.0.0',
        lastHeartbeatAt: new Date(),
      });
      createdDevices++;
    }
  }

  console.log('\n🎉 Синхронизация завершена');
  console.log(`   📍 Локаций создано: ${createdLocations}`);
  console.log(`   🤖 Автоматов создано: ${createdMachines}, обновлено: ${updatedMachines}`);
  console.log(`   📱 Устройств создано: ${createdDevices}`);

  await mongoose.disconnect();
  console.log('🔌 Соединение закрыто');
}

run().catch((err) => {
  console.error('❌ Ошибка:', err);
  process.exit(1);
});
