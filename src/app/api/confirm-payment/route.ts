import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2a3Boenp1aW5jb2tmeWJzcXJqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjI1OTI1NiwiZXhwIjoyMDkxODM1MjU2fQ.DeQ29YCP-K4bTH7GJjgKcMc9jTZ3oVuH2JPL5UnKqUA';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  SERVICE_KEY
);

const GOOGLE_SHEETS_API = 'https://script.google.com/macros/s/AKfycbxXLDeq4DoUOWUlmAM4yWdnPDxyWPBbzFbOSoMRNlsavPJNvtiKWUzok8ed2RkzvcSY/exec';

export async function POST(req: Request) {
  try {
    const { paymentId } = await req.json();

    if (!paymentId) {
      return NextResponse.json({ error: 'paymentId é obrigatório' }, { status: 400 });
    }

    console.log(`[ConfirmPayment] Confirmando pagamento: ${paymentId}`);

    // 1. Busca o pagamento
    const { data: payment, error: fetchErr } = await supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (fetchErr || !payment) {
      console.error('[ConfirmPayment] Pagamento não encontrado:', fetchErr);
      return NextResponse.json({ error: 'Pagamento não encontrado' }, { status: 404 });
    }

    // 2. Se já está aprovado, retorna sucesso direto (idempotente)
    if (payment.status === 'approved') {
      console.log(`[ConfirmPayment] Pagamento ${paymentId} já estava aprovado.`);
      return NextResponse.json({ success: true, alreadyApproved: true });
    }

    // 3. Atualiza o status para aprovado
    const { error: updateErr } = await supabase
      .from('payments')
      .update({
        status: 'approved',
        updated_at: new Date().toISOString()
      })
      .eq('id', paymentId);

    if (updateErr) {
      console.error('[ConfirmPayment] Erro ao aprovar pagamento:', updateErr);
      return NextResponse.json({ error: 'Erro ao aprovar pagamento' }, { status: 500 });
    }

    console.log(`[ConfirmPayment] Pagamento ${paymentId} aprovado!`);

    // 4. Salva na planilha e cria consulta
    if (payment.appointment_data) {
      let appointmentData = payment.appointment_data;
      if (typeof appointmentData === 'string') {
        try { appointmentData = JSON.parse(appointmentData); } catch { }
      }

      // Salva na planilha
      const sheetData = {
        ...appointmentData,
        pagamento: paymentId,
        status: 'Pago'
      };

      try {
        const sheetRes = await fetch(GOOGLE_SHEETS_API, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(sheetData)
        });
        const sheetResult = await sheetRes.text();
        console.log('[ConfirmPayment] Planilha:', sheetResult);
      } catch (sheetErr: any) {
        console.error('[ConfirmPayment] Erro na planilha:', sheetErr.message);
      }

      // Cria consulta de telemedicina
      if (appointmentData.tipo === 'Telemedicina') {
        let dbDate = appointmentData.data_consulta;
        if (dbDate && dbDate.includes('/')) {
          const [d, m, y] = dbDate.split('/');
          dbDate = `${y}-${m}-${d}`;
        }

        const { error: consError } = await supabase
          .from('consultations')
          .insert({
            patient_id: payment.patient_id,
            payment_id: paymentId,
            doctor_name: appointmentData.medico || 'Dr. André',
            appointment_date: dbDate || new Date().toISOString(),
            status: 'scheduled'
          });

        if (consError) {
          console.error('[ConfirmPayment] Erro ao criar consulta:', consError);
        } else {
          console.log('[ConfirmPayment] Consulta criada com sucesso!');
        }
      }
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('[ConfirmPayment] Erro:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
