/**
 * One-shot миграция: после перехода на сетку 6×5 у автомата ALM-001 ёмкость
 * должна быть 150, а не старая 180. Также чистит productStock — теперь это
 * derived-поле, пересчитается из slotStock при следующем save.
 *
 * Запуск:
 *   TS_NODE_BASEURL=./ npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node","baseUrl":"./"}' -r tsconfig-paths/register scripts/migrate-machine-capacity-150.ts
 */
import 'dotenv/config'
import mongoose from 'mongoose'
import { VendingMachine } from '../entities'

async function run() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI отсутствует')
  await mongoose.connect(uri)
  console.log('🔌 Mongo подключена')

  const machines: any[] = await VendingMachine.find({})
  for (const m of machines) {
    console.log(`\n🤖 ${m.machineId}`)
    console.log(`  cap: ${m.capacity} → 150`)
    m.capacity = 150
    // Сбрасываем productStock — pre('save') пересчитает из slotStock (если он есть).
    m.productStock = {}
    m.markModified('productStock')
    // slotStock приведём к согласованию с slotAssignments в pre('save') автоматически.
    await m.save()
    console.log(`  ✅ сохранён: stock=${m.stock} cap=${m.capacity}`)
  }

  await mongoose.disconnect()
  console.log('\n✅ Готово.')
}

run().catch((e) => {
  console.error('💥 migrate failed:', e)
  process.exit(1)
})
