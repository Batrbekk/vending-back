import { NextRequest } from 'next/server';
import { createSuccessResponse, createErrorResponse } from '@/lib/auth/middleware';
import { Device, VendingMachine } from '@/entities';
import { MachineStatus } from '@/types';
import dbConnect from '@/lib/database/connection';
import mongoose from 'mongoose';

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const body = await request.json();
    const { machineId } = body;

    if (!machineId || !mongoose.Types.ObjectId.isValid(machineId)) {
      return createErrorResponse('Некорректный ID автомата', 400);
    }

    // Find machine
    const machine = await VendingMachine.findById(machineId);
    if (!machine) {
      return createErrorResponse('Автомат не найден', 404);
    }

    console.log('🔄 Resetting machine:', machineId);
    console.log('Current status:', machine.status);

    // Update machine status to UNPAIRED
    machine.status = MachineStatus.UNPAIRED;
    await machine.save();
    console.log('✅ Machine status updated to UNPAIRED');

    // Find and delete associated device
    const device = await Device.findOne({ machineId: machine._id });
    if (device) {
      await Device.deleteOne({ _id: device._id });
      console.log('✅ Device deleted:', device._id);
    } else {
      console.log('⚠️  No associated device found');
    }

    return createSuccessResponse({
      message: 'Машина успешно сброшена',
      machine: {
        _id: machine._id,
        machineId: machine.machineId,
        status: machine.status,
      },
      deviceDeleted: !!device,
    });
  } catch (error) {
    console.error('❌ Ошибка сброса автомата:', error);
    return createErrorResponse('Ошибка сброса автомата', 500);
  }
}
