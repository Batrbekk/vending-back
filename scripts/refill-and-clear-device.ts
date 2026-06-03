/**
 * Сбрасывает все pairing (Device + PairingCode) у автомата ALM-001 и
 * заливает склад до полной ёмкости (180 банок), поровну распределив между
 * существующими продуктами (5 продуктов × 36 банок).
 *
 * Запуск:
 *   npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node","baseUrl":"./"}' -r tsconfig-paths/register scripts/refill-and-clear-device.ts
 */
import 'dotenv/config'
import mongoose from 'mongoose'
import { VendingMachine, Device } from '../entities'
import { PairingCode } from '../entities/PairingCode'
import { MachineStatus } from '../types'

const MACHINE_ID = 'ALM-001'

async function run() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI отсутствует')
  await mongoose.connect(uri)
  console.log('🔌 Mongo подключена')

  const machine: any = await VendingMachine.findOne({ machineId: MACHINE_ID })
  if (!machine) throw new Error(`Автомат ${MACHINE_ID} не найден`)
  console.log(`🤖 Автомат: ${machine.machineId} (cap=${machine.capacity})`)

  // 1) Сбрасываем коннект — удаляем Device(s) этого автомата и pairing-коды.
  const delDev = await Device.deleteMany({ machineId: machine._id })
  const delPc = await PairingCode.deleteMany({ machineId: machine._id })
  console.log(`🔓 Сброшено: устройств=${delDev.deletedCount}, pairing=${delPc.deletedCount}`)

  // 2) Заполняем все НАЗНАЧЕННЫЕ слоты до 5 банок (источник правды для остатка
  // — slotStock; productStock пересчитается из него в pre('save')).
  const assignments = machine.getSlotAssignments()
  const assignedCount = Object.keys(assignments).length
  if (assignedCount === 0) {
    console.log('ℹ️  В автомате нет назначенных слотов — заправка пропущена.')
    console.log('    Сначала назначь слоты продуктам через админку, потом перезапусти скрипт.')
  } else {
    machine.fillAllSlotsToMax()
    console.log(`📦 Заправлены все ${assignedCount} назначенных слотов до 5 банок ` +
      `(${assignedCount * 5}/${machine.capacity} банок).`)
  }

  // Status → UNPAIRED, иначе кнопка «Сгенерировать код подключения» в админке
  // не покажется. После успешного pairing /api/machines/:id/pair/complete сам
  // поднимет статус обратно в WORKING.
  machine.status = MachineStatus.UNPAIRED
  await machine.save()
  console.log(`🔌 Статус автомата → UNPAIRED (готов к новому пэйрингу)`)

  await mongoose.disconnect()
  console.log('\n✅ Готово. На планшете снова откроется экран пэринга — сгенерируй код в админке и введи.')
}

run().catch((e) => {
  console.error('💥 refill-and-clear-device failed:', e)
  process.exit(1)
})
