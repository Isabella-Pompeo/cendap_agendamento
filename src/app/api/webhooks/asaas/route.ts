import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2a3Boenp1aW5jb2tmeWJzcXJqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjI1OTI1NiwiZXhwIjoyMDkxODM1MjU2fQ.DeQ29YCP-K4bTH7GJjgKcMc9jTZ3oVuH2JPL5UnKqUA';
const GOOGLE_SHEETS_API = 'https://script.google.com/macros/s/AKfycbxXLDeq4DoUOWUlmAM4yWdnPDxyWPBbzFbOSoMRNlsavPJNvtiKWUzok8ed2RkzvcSY/exec';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  SERVICE_KEY
);

export async function POST(req: Request) {
  try {
    const asaasToken = req.headers.get('asaas-access-token');
    const webhookSecret = process.env.ASAAS_WEBHOOK_SECRET;

    // Validação de segurança (opcional se não configurado, mas altamente recomendado)
    if (webhookSecret && asaasToken !== webhookSecret) {
      console.warn("[Webhook ASAAS] Tentativa de acesso não autorizado detectada.");
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const payload = await req.json();
    console.log("[Webhook ASAAS] Evento recebido:", payload.event);

    if (payload.event === 'PAYMENT_RECEIVED' || payload.event === 'PAYMENT_CONFIRMED') {
      const payment = payload.payment;
      const ourPaymentId = payment.externalReference;
      
      const { data: activePayment, error: fetchErr } = await supabase
        .from('payments')
        .select('*')
        .eq('id', ourPaymentId)
        .maybeSingle();

      if (fetchErr || !activePayment) return NextResponse.json({ error: "Pagamento não localizado" }, { status: 404 });
      if (activePayment.status === 'approved') return NextResponse.json({ success: true });

      await supabase.from('payments').update({ status: 'approved', updated_at: new Date().toISOString() }).eq('id', ourPaymentId);

      if (activePayment.appointment_data) {
        let apptData = activePayment.appointment_data;
        if (typeof apptData === 'string') apptData = JSON.parse(apptData);

        const sheetData = { ...apptData, pagamento: ourPaymentId, status: 'Pago' };
        try {
          await fetch(GOOGLE_SHEETS_API, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(sheetData)
          });
        } catch (e: any) { console.error("[Webhook ASAAS] Erro na planilha:", e.message); }

        if (apptData.tipo === 'Telemedicina') {
          let dbDate = apptData.data_consulta;
          if (dbDate && dbDate.includes('/')) {
            const [d, m, y] = dbDate.split('/');
            dbDate = `${y}-${m}-${d}`;
          }

          await supabase.from('consultations').insert({
            patient_id: activePayment.patient_id,
            payment_id: ourPaymentId,
            doctor_name: apptData.medico || 'Dr. André',
            appointment_date: dbDate || new Date().toISOString(),
            status: 'scheduled'
          });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Webhook ASAAS] Erro crítico:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
