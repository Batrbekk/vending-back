import { NextResponse } from 'next/server';
import { staticSwaggerSpec } from '@/lib/swagger/staticSpec';

export async function GET() {
  try {
    return NextResponse.json(staticSwaggerSpec);
  } catch (error) {
    console.error('Ошибка при генерации Swagger спецификации:', error);
    return NextResponse.json(
      { error: 'Не удалось сгенерировать спецификацию API' },
      { status: 500 }
    );
  }
}
