import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const isPaidEvent = (event?: string) =>
  event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED';

const requireEnv = (name: string) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} nao configurada.`);
  }
  return value;
};

const getSupabaseAdmin = () =>
  createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  );

const parseAppointmentData = (appointmentData: any) => {
  if (!appointmentData) return {};
  if (typeof appointmentData !== 'string') return appointmentData;

  try {
    return JSON.parse(appointmentData);
  } catch {
    return {};
  }
};

const buildAppointmentDate = (dateValue?: string, timeValue?: string) => {
  let dbDate = dateValue;
  const horario = timeValue || '00:00';

  if (!dbDate) return new Date().toISOString();

  if (dbDate.includes('-') && !dbDate.includes('/')) {
    const datePart = dbDate.split('T')[0];
    return `${datePart}T${horario}:00-03:00`;
  }

  if (dbDate.includes('/')) {
    const [d, m, y] = dbDate.split('/');
    return `${y}-${m}-${d}T${horario}:00-03:00`;
  }

  return dbDate;
};

export async function POST(req: Request) {
  try {
    const asaasToken = req.headers.get('asaas-access-token');
    const webhookSecret = process.env.ASAAS_WEBHOOK_SECRET;

    if (webhookSecret && asaasToken !== webhookSecret) {
      console.warn('[Webhook ASAAS] Tentativa de acesso nao autorizado detectada.');
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
    }

    const payload = await req.json();
    console.log('[Webhook ASAAS] Evento recebido:', payload.event);

    if (!isPaidEvent(payload.event)) {
      return NextResponse.json({ success: true });
    }

    const asaasPaymentId = payload.payment?.id;
    const externalReference = payload.payment?.externalReference;

    if (!externalReference) {
      console.error('[Webhook ASAAS] externalReference ausente no evento pago.');
      return NextResponse.json({ error: 'externalReference ausente' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const { data: changedPayment, error: updateErr } = await supabaseAdmin
      .from('payments')
      .update({
        status: 'approved',
        asaas_payment_id: asaasPaymentId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', externalReference)
      .neq('status', 'approved')
      .select()
      .maybeSingle();

    if (updateErr) {
      console.error('[Webhook ASAAS] Erro ao atualizar pagamento:', updateErr);
      return NextResponse.json({ error: 'Erro ao atualizar pagamento' }, { status: 500 });
    }

    const didApproveNow = Boolean(changedPayment);
    let activePayment = changedPayment;

    if (!activePayment) {
      const { data: existingPayment, error: existingErr } = await supabaseAdmin
        .from('payments')
        .select()
        .eq('id', externalReference)
        .single();

      if (existingErr || !existingPayment) {
        console.error('[Webhook ASAAS] Pagamento nao encontrado:', externalReference, existingErr);
        return NextResponse.json({ error: 'Pagamento nao encontrado' }, { status: 404 });
      }

      activePayment = existingPayment;
    }

    const apptData = parseAppointmentData(activePayment.appointment_data);
    const ourPaymentId = activePayment.id;

    const automationWebhookUrl = process.env.TELEMEDICINE_AUTOMATION_WEBHOOK_URL;
    if (automationWebhookUrl) {
      try {
        await fetch(automationWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...apptData,
            status_pagamento: 'pago',
            pagamento: asaasPaymentId,
            asaas_id: asaasPaymentId,
          }),
        });
      } catch (error: any) {
        console.error('[Webhook ASAAS] Erro na automacao externa:', error.message);
      }
    }

    let consultationId: string | null = null;

    if (apptData.tipo === 'Telemedicina') {
      const { data: existingConsultation } = await supabaseAdmin
        .from('consultations')
        .select('id, appointment_date')
        .eq('payment_id', ourPaymentId)
        .maybeSingle();

      if (existingConsultation?.id) {
        consultationId = existingConsultation.id;
      } else {
        let correctDoctorId = apptData.doctor_id;

        try {
          const doctorNamePart = apptData.medico?.split(' ')[1] || 'Andre';
          const { data: docSet } = await supabaseAdmin
            .from('doctor_settings')
            .select('user_id')
            .ilike('full_name', `%${doctorNamePart}%`)
            .single();

          if (docSet?.user_id) {
            correctDoctorId = docSet.user_id;
          }
        } catch (error) {
          console.error('[Webhook] Erro ao buscar UUID do medico:', error);
        }

        const { data: consultation, error: consErr } = await supabaseAdmin
          .from('consultations')
          .insert({
            patient_id: activePayment.patient_id,
            doctor_id: correctDoctorId || null,
            payment_id: ourPaymentId,
            doctor_name: apptData.medico || 'Dr. Andre',
            appointment_date: buildAppointmentDate(apptData.data_consulta, apptData.horario),
            status: 'scheduled',
          })
          .select('id, appointment_date')
          .single();

        if (consErr) {
          console.error('[Webhook ASAAS] Erro ao criar consulta:', consErr);
        } else {
          consultationId = consultation?.id || null;
          console.log('[Webhook ASAAS] Consulta criada com sucesso para:', apptData.nome_paciente);
        }
      }

      if (didApproveNow) {
        console.log('[Webhook ASAAS] Pagamento aprovado para telemedicina:', ourPaymentId, consultationId);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('[Webhook ASAAS] Erro critico:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
