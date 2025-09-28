import mongoose from 'mongoose';

interface ConnectionOptions {
  isConnected?: number;
}

const connection: ConnectionOptions = {};

async function dbConnect(): Promise<void> {
  if (connection.isConnected) {
    return;
  }

  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/vending-machines';

  try {
    const db = await mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
    });

    connection.isConnected = db.connections[0].readyState;
    console.log('✅ MongoDB подключен');
  } catch (error) {
    console.error('❌ Ошибка подключения к MongoDB:', error);
    process.exit(1);
  }
}

export default dbConnect;
