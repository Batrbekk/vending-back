/**
 * Seed 5 мок-продуктов для vending-rn:
 *   Classic — 10₸
 *   Anar, Lime, Orange, Zero — 500₸
 *
 * Usage: npm run seed:products
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { Product, VendingMachine } from '../entities';

const MOCK_PRODUCTS = [
  {
    name: 'Classic',
    image: '/products/mock-classic.jpg',
    price: 10,
    nutrition: { calories: 140, protein: 0, fat: 0, carbs: 35 },
  },
  {
    name: 'Anar',
    image: '/products/mock-anar.jpg',
    price: 500,
    nutrition: { calories: 120, protein: 0.5, fat: 0, carbs: 30 },
  },
  {
    name: 'Lime',
    image: '/products/mock-lime.jpg',
    price: 500,
    nutrition: { calories: 110, protein: 0, fat: 0, carbs: 28 },
  },
  {
    name: 'Orange',
    image: '/products/mock-orange.jpg',
    price: 500,
    nutrition: { calories: 130, protein: 0.5, fat: 0, carbs: 32 },
  },
  {
    name: 'Zero',
    image: '/products/mock-zero.jpg',
    price: 500,
    nutrition: { calories: 0, protein: 0, fat: 0, carbs: 0 },
  },
];

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI не задан');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('✅ Подключен к MongoDB');

  // Wipe old products
  const del = await Product.deleteMany({});
  console.log(`🧹 Удалено старых продуктов: ${del.deletedCount}`);

  // Insert new products
  const created = await Product.insertMany(MOCK_PRODUCTS);
  console.log(`✅ Создано продуктов: ${created.length}`);
  for (const p of created) console.log(`   - ${p.name}: ${p.price}₸ (${p.image})`);

  // Распределяем stock по всем машинам (равномерно)
  const machines = await VendingMachine.find({});
  console.log(`\n🤖 Распределяем stock по ${machines.length} автоматам...`);

  const perProduct = 40;
  const productStockSeed: Record<string, number> = {};
  for (const p of created) productStockSeed[p._id.toString()] = perProduct;

  for (const machine of machines) {
    machine.productStock = { ...productStockSeed };
    machine.stock = perProduct * created.length;
    (machine as any).markModified?.('productStock');
    await machine.save();
  }
  console.log(`✅ Stock обновлён для ${machines.length} автоматов (по ${perProduct} ед. каждого продукта)`);

  await mongoose.disconnect();
  console.log('🔌 Соединение закрыто');
}

run().catch((err) => {
  console.error('❌ Ошибка:', err);
  process.exit(1);
});
