import { NextResponse } from 'next/server';

const ROOM_ACCESS_EARLY_MINUTES = 5;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { appointmentId, patientId } = body;

    if (!appointmentId || !patientId) {
      return NextResponse.json({ error: 'Parametros ausentes.' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      url: 'https://example.com/room',
      token: 'local-dev-token',
      consultationId: appointmentId,
      note: 'Telemedicina local desativada temporariamente.',
    });
  } catch (error: any) {
    console.error('Erro na rota de telemedicina:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
