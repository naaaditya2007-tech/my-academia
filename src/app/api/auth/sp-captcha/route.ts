import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    success: false,
    message: 'sp.srmist.edu.in has been retired. MyAcademia uses direct SRM Academia Zoho IAM authentication.',
  });
}
