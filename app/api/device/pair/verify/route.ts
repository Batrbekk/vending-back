import { NextRequest } from 'next/server';
import dbConnect from '@/lib/database/connection';
import { createErrorResponse, createSuccessResponse } from '@/lib/auth/middleware';
import { PairingCode, VendingMachine, Device } from '@/entities';
import type { PairingCodeDocument } from '@/entities/PairingCode';
import type { DeviceDocument } from '@/entities/Device';
import { PairingStatus } from '@/entities/PairingCode';
import mongoose from 'mongoose';
import { MachineStatus } from '@/types';

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    console.log('🔄 Pairing request received');

    type VerifyBody = { code?: string; firmwareVersion?: string };
    const body = (await request.json().catch(() => ({}))) as VerifyBody;
    const code: string = (body.code || '').trim();
    
    console.log('🔄 Pairing code:', code);
    console.log('🔄 Firmware version:', body.firmwareVersion);

    if (!code || !/^[0-9]{6}$/.test(code)) {
      console.log('❌ Invalid code format:', code);
      return createErrorResponse('Некорректный код', 400);
    }

    console.log('🔍 Verifying pairing code...');
    const pairing: PairingCodeDocument | null = await PairingCode.verifyCode(code);
    if (!pairing) {
      console.log('❌ Pairing code not found or expired:', code);
      return createErrorResponse('Код недействителен или истёк', 400);
    }
    
    console.log('✅ Pairing code found:', {
      id: pairing._id,
      machineId: pairing.machineId,
      status: pairing.status,
      expiresAt: pairing.expiresAt
    });

    // Проверяем машину
    console.log('🔍 Finding machine:', pairing.machineId);
    const machine = await VendingMachine.findById(pairing.machineId);
    if (!machine) {
      console.log('❌ Machine not found:', pairing.machineId);
      return createErrorResponse('Автомат не найден', 404);
    }
    
    console.log('✅ Machine found:', {
      id: machine._id,
      machineId: machine.machineId,
      status: machine.status
    });

    // Создаём устройство для автомата, если его нет; если есть — обновим apiKey
    console.log('🔍 Finding or creating device...');
    let device: DeviceDocument | null = await Device.findOne({ machineId: pairing.machineId });
    if (!device) {
      console.log('🔧 Creating new device for machine:', pairing.machineId);
      device = await Device.createForMachine(pairing.machineId as mongoose.Types.ObjectId, body.firmwareVersion);
    } else {
      console.log('🔧 Updating existing device:', device._id);
      if (body.firmwareVersion) await device.updateFirmware(body.firmwareVersion);
      await device.regenerateApiKey();
    }
    
    console.log('✅ Device ready:', {
      id: device._id,
      machineId: device.machineId,
      apiKey: device.apiKey?.substring(0, 8) + '...'
    });

    // Переводим автомат в WORKING, если он был UNPAIRED
    if (machine.status === MachineStatus.UNPAIRED) {
      console.log('🔧 Updating machine status from UNPAIRED to WORKING');
      machine.status = MachineStatus.WORKING;
      await machine.save();
    }

    // Помечаем код использованным
    console.log('🔧 Marking pairing code as used');
    pairing.status = PairingStatus.USED;
    pairing.usedAt = new Date();
    pairing.usedByDeviceId = device._id as mongoose.Types.ObjectId;
    await pairing.save();

    console.log('✅ Pairing completed successfully');
    return createSuccessResponse({
      machine: { _id: String(machine._id), machineId: machine.machineId },
      device: { _id: String(device._id), apiKey: device.apiKey },
    }, 200);
  } catch (e) {
    console.error('❌ Pairing error:', e);
    console.error('❌ Error stack:', (e as Error).stack);
    return createErrorResponse('Ошибка верификации пейринга', 500);
  }
}
