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
      try {
        const paymentId = payload.payment?.id;
        const externalReference = payload.payment?.externalReference;

        const supabaseAdmin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL || '',
          process.env.SUPABASE_SERVICE_ROLE_KEY || ''
        );

        // 1. Atualiza o status do pagamento
        const { data: activePayment, error: payErr } = await supabaseAdmin
          .from('payments')
          .update({ status: 'approved', updated_at: new Date().toISOString() })
          .eq('id', externalReference)
          .select()
          .single();

        if (payErr) {
           console.error("[Webhook ASAAS] Erro ao atualizar pagamento:", payErr);
           return NextResponse.json({ error: 'Erro ao atualizar pagamento' }, { status: 500 });
        }

        if (!activePayment) {
           console.error("[Webhook ASAAS] Pagamento não encontrado:", externalReference);
           return NextResponse.json({ error: 'Pagamento não encontrado' }, { status: 404 });
        }

        const apptData = typeof activePayment.appointment_data === 'string' 
            ? JSON.parse(activePayment.appointment_data) 
            : activePayment.appointment_data;
        const ourPaymentId = activePayment.id;

        // 2. Tenta salvar na planilha (opcional, não bloqueia o fluxo)
        try {
          await fetch('https://hook.us1.make.com/60m1x5v4s95i4j173tux2n82u6j6x7v5', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...apptData, status_pagamento: 'pago', pagamento: paymentId, asaas_id: paymentId })
          });
        } catch (e: any) { console.error("[Webhook ASAAS] Erro na planilha:", e.message); }

        // 3. Cria a consulta no banco de dados
        if (apptData.tipo === 'Telemedicina') {
          let dbDate = apptData.data_consulta;
          const horario = apptData.horario || '00:00';

          if (dbDate && dbDate.includes('/')) {
            const [d, m, y] = dbDate.split('/');
            // Usamos o formato YYYY-MM-DDTHH:mm:ss-03:00 para garantir o fuso de Brasília
            dbDate = `${y}-${m}-${d}T${horario}:00-03:00`;
          }

          // Busca o UUID do médico no banco para garantir que apareça no painel
          let correctDoctorId = apptData.doctor_id;
          try {
            const { data: docSet } = await supabaseAdmin
              .from('doctor_settings')
              .select('user_id')
              .ilike('full_name', `%${apptData.medico?.split(' ')[1] || 'André'}%`)
              .single();
              
            if (docSet?.user_id) {
              correctDoctorId = docSet.user_id;
            }
          } catch (e) {
            console.error("[Webhook] Erro ao buscar UUID do médico:", e);
          }

          const { error: consErr } = await supabaseAdmin.from('consultations').insert({
            patient_id: activePayment.patient_id,
            doctor_id: correctDoctorId || null,
            payment_id: ourPaymentId,
            doctor_name: apptData.medico || 'Dr. André',
            appointment_date: dbDate || new Date().toISOString(),
            status: 'scheduled'
          });

          if (consErr) {
            console.error("[Webhook ASAAS] Erro ao criar consulta:", consErr);
          } else {
            console.log("[Webhook ASAAS] Consulta criada com sucesso para:", apptData.nome_paciente);
          }
        }

        return NextResponse.json({ received: true });
      } catch (error: any) {
        console.error("[Webhook ASAAS] Erro crítico:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Webhook ASAAS] Erro crítico:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
