/**
 * Однократный сброс: удаляет ВСЕ автоматы + связанные устройства/pairing-коды
 * + локации, и создаёт ровно один свежий VendingMachine на 180 банок
 * (6×6 слотов × 5 банок в слоте), привязанный к реальному адресу Cannect
 * Station на Толе би 293/1.
 *
 * Историю (Sale, Transaction, RefillLog, Alert) НЕ трогаем — остаётся в БД,
 * пусть и с orphan-ссылками на удалённые автоматы.
 *
 * Запуск:
 *   npx ts-node --transpile-only scripts/reset-to-one-machine.ts
 */
import 'dotenv/config'
import mongoose from 'mongoose'
import { VendingMachine, Device, Location } from '../entities'
import { PairingCode } from '../entities/PairingCode'

const NEW_MACHINE_ID = 'ALM-001'
const NEW_CAPACITY = 6 * 5 * 5 // 150 банок: 6 колонок × 5 рядов × 5 банок в слоте

const NEW_LOCATION = {
  name: 'Cannect Station · Толе би',
  address: 'Алматы, Ауэзовский район, ул. Толе би, 293/1, 050031',
  geo: { lat: 43.244058, lng: 76.845671 },
  timezone: 'Asia/Almaty',
}

async function run() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI отсутствует в окружении')
  await mongoose.connect(uri)
  console.log('🔌 Mongo подключена')

  const before = await VendingMachine.find({}, { machineId: 1, capacity: 1 }).lean()
  console.log(`\nНайдено автоматов до сброса: ${before.length}`)
  before.forEach((m: any) => console.log(`  - ${m.machineId} (cap=${m.capacity})`))

  const devCount = await Device.countDocuments()
  const pcCount = await PairingCode.countDocuments()
  const locCount = await Location.countDocuments()
  console.log(`Устройств: ${devCount}, pairing-кодов: ${pcCount}, локаций: ${locCount}`)

  const delMachines = await VendingMachine.deleteMany({})
  const delDevices = await Device.deleteMany({})
  const delPairing = await PairingCode.deleteMany({})
  const delLocations = await Location.deleteMany({})
  console.log(
    `Удалено: автоматов=${delMachines.deletedCount}, устройств=${delDevices.deletedCount}, ` +
      `pairing=${delPairing.deletedCount}, локаций=${delLocations.deletedCount}`
  )

  const location = await Location.create(NEW_LOCATION as any)
  console.log(`📍 Локация: ${location.name} (${location._id})`)

  const fresh = await VendingMachine.create({
    machineId: NEW_MACHINE_ID,
    locationId: location._id,
    capacity: NEW_CAPACITY,
    stock: 0,
    productStock: {},
    slotAssignments: {},
  } as any)

  console.log(
    `\n✅ Создан автомат: _id=${fresh._id} machineId=${fresh.machineId} cap=${fresh.capacity}`
  )
  await mongoose.disconnect()
}

run().catch((e) => {
  console.error('💥 reset-to-one-machine failed:', e)
  process.exit(1)
})
