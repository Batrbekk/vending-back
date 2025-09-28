// Экспорт всех моделей для удобного импорта
export { User, type UserDocument } from './User';
export { Location, type LocationDocument } from './Location';
export { VendingMachine, type VendingMachineDocument } from './VendingMachine';
export { RefillLog, type RefillLogDocument } from './RefillLog';
export { Sale, type SaleDocument } from './Sale';
export { Alert, type AlertDocument } from './Alert';
export { Device, type DeviceDocument } from './Device';
export { Product, type ProductDocument } from './Product';
export { PairingCode, type PairingCodeDocument } from './PairingCode';

// Функция для инициализации всех моделей
export async function initializeModels() {
  // Импортируем все модели для регистрации в mongoose
  await Promise.all([
    import('./User'),
    import('./Location'), 
    import('./VendingMachine'),
    import('./RefillLog'),
    import('./Sale'),
    import('./Alert'),
    import('./Device'),
    import('./Product'),
    import('./PairingCode')
  ]);
  
  console.log('✅ Все модели инициализированы');
}
