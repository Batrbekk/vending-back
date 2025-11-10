require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');

async function migrateSalesToTransactions() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Подключено к MongoDB');

    // Получаем коллекции
    const salesCollection = mongoose.connection.collection('sales');
    const transactionsCollection = mongoose.connection.collection('transactions');

    // Находим все продажи без транзакций
    const sales = await salesCollection.find({}).sort({ paidAt: 1 }).toArray();
    console.log(`📊 Найдено продаж: ${sales.length}`);

    if (sales.length === 0) {
      console.log('✅ Нет продаж для миграции');
      await mongoose.disconnect();
      return;
    }

    // Получаем текущий максимальный orderNumber
    const lastTransaction = await transactionsCollection.findOne({}, { sort: { orderNumber: -1 } });
    let currentOrderNumber = lastTransaction ? lastTransaction.orderNumber + 1 : 100;

    console.log(`🔢 Начинаем с номера заказа: ${currentOrderNumber}`);

    // Группируем продажи по receiptId и времени (в пределах 1 минуты считаем одной транзакцией)
    const transactionGroups = new Map();

    for (const sale of sales) {
      // Используем receiptId как ключ для группировки, или создаем уникальный ключ
      const groupKey = sale.receiptId || `${sale.machineId}_${new Date(sale.paidAt).getTime()}`;

      if (!transactionGroups.has(groupKey)) {
        transactionGroups.set(groupKey, []);
      }
      transactionGroups.get(groupKey).push(sale);
    }

    console.log(`📦 Создано групп транзакций: ${transactionGroups.size}`);

    let createdCount = 0;
    let skippedCount = 0;

    // Создаем транзакции для каждой группы
    for (const [groupKey, groupSales] of transactionGroups.entries()) {
      try {
        const firstSale = groupSales[0];
        const machineId = new mongoose.Types.ObjectId(firstSale.machineId);

        // Получаем следующий receiptNumber для этого автомата
        const lastReceipt = await transactionsCollection.findOne(
          { machineId },
          { sort: { receiptNumber: -1 } }
        );
        const receiptNumber = lastReceipt ? lastReceipt.receiptNumber + 1 : 1;

        // Формируем items из группы продаж
        const items = groupSales.map(sale => ({
          productId: sale.sku, // SKU это ID продукта
          sku: sale.sku,
          name: 'Продукт', // У старых продаж нет названия
          price: sale.price,
          quantity: sale.qty,
          subtotal: sale.total
        }));

        // Считаем общую сумму
        const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);

        // Создаем транзакцию
        const transaction = {
          machineId,
          receiptNumber,
          orderNumber: currentOrderNumber++,
          items,
          totalAmount,
          paymentMethod: firstSale.paymentMethod || 'CARD',
          paidAt: firstSale.paidAt,
          createdAt: firstSale.paidAt,
          updatedAt: firstSale.paidAt
        };

        await transactionsCollection.insertOne(transaction);
        createdCount++;

        if (createdCount % 10 === 0) {
          console.log(`✅ Создано транзакций: ${createdCount}/${transactionGroups.size}`);
        }
      } catch (error) {
        console.error(`❌ Ошибка создания транзакции для группы ${groupKey}:`, error.message);
        skippedCount++;
      }
    }

    console.log('\n📊 Результаты миграции:');
    console.log(`✅ Создано транзакций: ${createdCount}`);
    console.log(`⏭️  Пропущено: ${skippedCount}`);
    console.log(`🔢 Последний номер заказа: ${currentOrderNumber - 1}`);

    await mongoose.disconnect();
    console.log('\n✅ Миграция завершена');
  } catch (error) {
    console.error('❌ Ошибка миграции:', error);
    process.exit(1);
  }
}

migrateSalesToTransactions();
