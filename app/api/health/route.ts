import { NextRequest } from 'next/server';
import { createSuccessResponse } from '@/lib/auth/middleware';

export async function GET(request: NextRequest) {
  return createSuccessResponse({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }, 200);
}
