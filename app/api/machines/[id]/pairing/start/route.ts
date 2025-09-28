import { withAuth, type AuthenticatedRequest, createErrorResponse, createSuccessResponse } from '@/lib/auth/middleware';
import dbConnect from '@/lib/database/connection';
import { PairingCode, VendingMachine } from '@/entities';
import mongoose from 'mongoose';

async function handleStartPairing(request: AuthenticatedRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return createErrorResponse('Некорректный ID автомата', 400);
    }

    const machine = await VendingMachine.findById(id);
    if (!machine) {
      return createErrorResponse('Автомат не найден', 404);
    }

    // Генерируем код на 5 минут
    const codeDoc = await PairingCode.generateForMachine(machine._id as mongoose.Types.ObjectId, 5 * 60 * 1000);

    return createSuccessResponse({
      code: codeDoc.code,
      expiresAt: codeDoc.expiresAt,
      machine: { _id: String(machine._id), machineId: machine.machineId }
    });
  } catch (e) {
    console.error('Ошибка старта пейринга:', e);
    return createErrorResponse('Ошибка старта пейринга', 500);
  }
}

export const POST = withAuth(handleStartPairing);
