import { withAuth, AuthenticatedRequest, createErrorResponse } from '@/lib/auth/middleware';
import { SalesFiltersSchema } from '@/lib/validation/common';
import { Sale, VendingMachine } from '@/entities';
import dbConnect from '@/lib/database/connection';
import mongoose from 'mongoose';
import * as XLSX from 'xlsx';
import { NextResponse } from 'next/server';

// Local lean type for machines (Mongoose v8 removed LeanDocument). We only use these fields here.
type VendingMachineLean = {
  _id: mongoose.Types.ObjectId | string;
  machineId: string;
  location?: { name: string; address: string } | null;
};

// GET /api/sales/export - экспорт продаж в Excel по фильтрам
async function handleExportSales(request: AuthenticatedRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const rawFilters = Object.fromEntries(Array.from(searchParams.entries()));
    const filters = SalesFiltersSchema.parse(rawFilters);

    const mongoFilter: Record<string, unknown> = {};

    if (filters.machineId) {
      mongoFilter.machineId = new mongoose.Types.ObjectId(filters.machineId);
    }
    if (filters.sku) {
      mongoFilter.sku = { $regex: filters.sku, $options: 'i' };
    }
    if (filters.from || filters.to) {
      mongoFilter.paidAt = {} as Record<string, unknown>;
      if (filters.from) (mongoFilter.paidAt as Record<string, unknown>).$gte = filters.from;
      if (filters.to) (mongoFilter.paidAt as Record<string, unknown>).$lte = filters.to;
    }

    const items = await Sale.find(mongoFilter)
      .sort({ paidAt: -1 })
      .lean({ virtuals: true });

    // Map machine meta for human-friendly columns
    const machineIds = Array.from(new Set(items.map((s) => String(s.machineId)))).map((id) => new mongoose.Types.ObjectId(id));
    const machines = await VendingMachine.find({ _id: { $in: machineIds } })
      .populate('location', 'name address')
      .select('machineId')
      .lean<VendingMachineLean[]>({ virtuals: true });
    const machinesById = new Map<string, VendingMachineLean>(machines.map((m) => [String(m._id), m]));

    const rows = items.map((s) => {
      const m = machinesById.get(String(s.machineId));
      return {
        SaleID: String(s._id),
        MachineDbId: String(s.machineId),
        MachinePublicId: m?.machineId ?? '',
        LocationName: m?.location?.name ?? '',
        LocationAddress: m?.location?.address ?? '',
        SKU: s.sku,
        Price: s.price,
        Qty: s.qty,
        Total: s.total,
        PaidAt: new Date(s.paidAt).toISOString(),
        PaymentMethod: s.paymentMethod ?? '',
        ReceiptId: s.receiptId ?? '',
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Sales');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="sales_export.xlsx"`,
        'Content-Length': String((buf as Buffer).length),
      },
    });
  } catch (error) {
    console.error('Ошибка экспорта продаж:', error);
    return createErrorResponse('Ошибка экспорта продаж', 500);
  }
}

export const GET = withAuth(handleExportSales);
