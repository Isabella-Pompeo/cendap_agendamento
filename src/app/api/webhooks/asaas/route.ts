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

const normalizeText = (value = '') =>
  String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const isPsychologyPackageAppointment = (apptData: any) => {
  const text = normalizeText([
    apptData?.medico,
    apptData?.especialidade,
    apptData?.pacote,
  ].filter(Boolean).join(' '));

  return text.includes('maria de fatima') ||
    text.includes('psicolog') ||
    text.includes('3 atendimentos');
};

const isValidTimeValue = (value?: string) => /^\d{1,2}:\d{2}$/.test(String(value || '').trim());

const getAppointmentDateKey = (dateValue?: string) => {
  const rawDate = String(dateValue || '').trim();
  if (!rawDate) return '';

  if (rawDate.includes('/') && !rawDate.includes('-')) {
    const [day, month, year] = rawDate.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  return rawDate.split('T')[0];
};

const getSaoPauloDayRange = (dateValue?: string) => {
  const dateKey = getAppointmentDateKey(dateValue);
  if (!dateKey) return null;

  const start = new Date(`${dateKey}T03:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
};

const parseAppointmentBaseDate = (dateValue?: string) => {
  if (!dateValue) return new Date();

  if (dateValue.includes('/') && !dateValue.includes('-')) {
    const [d, m, y] = dateValue.split('/');
    return new Date(Number(y), Number(m) - 1, Number(d), 12, 0, 0);
  }

  const parsed = new Date(dateValue);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const getDefaultPackageTime = (date: Date) => {
  const day = date.getDay();
  return day === 6 ? '09:00' : '19:00';
};

const buildAppointmentDate = (dateValue?: string, timeValue?: string, fallbackTime = '09:00') => {
  let dbDate = dateValue;
  const horario = isValidTimeValue(timeValue) ? String(timeValue).trim() : fallbackTime;

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

const addDaysToAppointmentDate = (dateValue: string, days: number) => {
  const date = new Date(dateValue);
  date.setDate(date.getDate() + days);
  return date.toISOString();
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

    let consultationId: string | null = null;

    if (apptData.tipo === 'Telemedicina') {
      const { data: existingConsultations, error: existingConsultationsError } = await supabaseAdmin
        .from('consultations')
        .select('id, appointment_date')
        .eq('payment_id', ourPaymentId);

      if (existingConsultationsError) {
        console.error('[Webhook ASAAS] Erro ao buscar consultas existentes:', existingConsultationsError);
      }

      if (existingConsultations && existingConsultations.length > 0) {
        consultationId = existingConsultations[0].id;
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

        const isPsychologyPackage = isPsychologyPackageAppointment(apptData);
        const baseDate = parseAppointmentBaseDate(apptData.data_consulta);
        const fallbackTime = isPsychologyPackage ? getDefaultPackageTime(baseDate) : '09:00';
        const firstAppointmentDate = buildAppointmentDate(apptData.data_consulta, apptData.horario, fallbackTime);
        const consultationRows = (isPsychologyPackage ? [0, 7, 14] : [0]).map((daysFromStart, index) => ({
            patient_id: activePayment.patient_id,
            doctor_id: correctDoctorId || null,
            payment_id: ourPaymentId,
            doctor_name: apptData.medico || 'Dr. Andre',
            appointment_date: index === 0 ? firstAppointmentDate : addDaysToAppointmentDate(firstAppointmentDate, daysFromStart),
            status: 'scheduled',
          }));

        if (isPsychologyPackage) {
          const firstDayRange = getSaoPauloDayRange(apptData.data_consulta);

          if (firstDayRange) {
            const { data: existingPackageConsultations, error: existingPackageError } = await supabaseAdmin
              .from('consultations')
              .select('id, payment_id, appointment_date, payments(status, appointment_data)')
              .eq('patient_id', activePayment.patient_id)
              .eq('doctor_name', apptData.medico || 'Dr. Andre')
              .gte('appointment_date', firstDayRange.start)
              .lt('appointment_date', firstDayRange.end);

            if (existingPackageError) {
              console.error('[Webhook ASAAS] Erro ao buscar pacote existente:', existingPackageError);
            }

            const hasExistingPackage = (existingPackageConsultations || []).some((consultation: any) => {
              const payment = Array.isArray(consultation.payments) ? consultation.payments[0] : consultation.payments;
              return payment?.status === 'approved' && isPsychologyPackageAppointment(parseAppointmentData(payment?.appointment_data));
            });

            if (hasExistingPackage) {
              console.warn('[Webhook ASAAS] Pacote duplicado ignorado para:', activePayment.patient_id, apptData.medico, apptData.data_consulta);
              return NextResponse.json({ received: true, duplicatePackageIgnored: true });
            }
          }
        }

        const { data: consultations, error: consErr } = await supabaseAdmin
          .from('consultations')
          .insert(consultationRows)
          .select('id, appointment_date');

        if (consErr) {
          console.error('[Webhook ASAAS] Erro ao criar consulta:', consErr);
        } else {
          consultationId = consultations?.[0]?.id || null;
          console.log('[Webhook ASAAS] Consulta(s) criada(s) com sucesso para:', apptData.nome_paciente, consultations?.length || 0);
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
