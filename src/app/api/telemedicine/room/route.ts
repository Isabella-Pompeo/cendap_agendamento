import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createDailyRoom, createMeetingToken, dailyRoomExists } from '../../../../lib/telemedicine';

const ROOM_ACCESS_EARLY_MINUTES = 5;

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

const getPatientTokenNotBefore = (appointmentDate?: string | null) => {
  if (!appointmentDate) return undefined;

  const appointmentTime = new Date(appointmentDate).getTime();
  if (Number.isNaN(appointmentTime)) return undefined;

  return Math.floor((appointmentTime - ROOM_ACCESS_EARLY_MINUTES * 60 * 1000) / 1000);
};

const getUserFromRequest = async (supabaseAdmin: any, req: Request) => {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');

  if (!token) {
    return { user: null, error: 'Sessao nao encontrada. Faca login novamente.' };
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    return { user: null, error: 'Sessao invalida. Faca login novamente.' };
  }

  return { user: data.user, error: null };
};

const isDoctorUser = async (supabaseAdmin: any, userId: string) => {
  const { data, error } = await supabaseAdmin
    .from('doctor_settings')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao validar medico: ${error.message}`);
  }

  return Boolean(data);
};

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const { user, error: authError } = await getUserFromRequest(supabase, req);

    if (authError || !user) {
      return NextResponse.json({ error: authError }, { status: 401 });
    }

    const { appointmentId, patientId, doctorName, appointmentDate, isDoctor, shouldUpdateStatus = true } = await req.json();

    if (!appointmentId || !patientId) {
      return NextResponse.json({ error: 'Parametros ausentes.' }, { status: 400 });
    }

    const requesterIsDoctor = await isDoctorUser(supabase, user.id);
    if (isDoctor && !requesterIsDoctor) {
      return NextResponse.json({ error: 'Apenas medicos autorizados podem abrir a sala como medico.' }, { status: 403 });
    }

    if (!requesterIsDoctor && user.id !== patientId) {
      return NextResponse.json({ error: 'Voce nao tem acesso a esta consulta.' }, { status: 403 });
    }

    let consultation = null;

    if (appointmentId && appointmentId !== 'temp') {
      const { data } = await supabase
        .from('consultations')
        .select('*')
        .eq('id', appointmentId)
        .single();
      consultation = data;
    }

    if (consultation && !requesterIsDoctor && consultation.patient_id !== user.id) {
      return NextResponse.json({ error: 'Voce nao tem acesso a esta consulta.' }, { status: 403 });
    }

    if (!consultation) {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('consultations')
        .select('*')
        .eq('patient_id', patientId)
        .gte('appointment_date', `${today}T00:00:00`)
        .lte('appointment_date', `${today}T23:59:59`)
        .limit(1)
        .maybeSingle();
      consultation = data;
    }

    if (!consultation) {
      const room = await createDailyRoom(`consulta-${patientId}-${Date.now()}`);

      const { data: newConsulta, error: insertErr } = await supabase
        .from('consultations')
        .insert({
          patient_id: patientId,
          doctor_name: doctorName || 'Dr. Andre',
          appointment_date: appointmentDate || new Date().toISOString(),
          status: shouldUpdateStatus ? 'in_progress' : 'scheduled',
          daily_room_url: room.url,
          daily_room_name: room.name,
        })
        .select()
        .single();

      if (insertErr || !newConsulta) {
        console.error('Erro ao criar consultation:', insertErr);
        throw new Error('Falha ao criar sala de telemedicina no banco de dados.');
      }
      consultation = newConsulta;
    } else if (!consultation.daily_room_url || !consultation.daily_room_name || !(await dailyRoomExists(consultation.daily_room_name))) {
      const room = await createDailyRoom(`consulta-${patientId}-${Date.now()}`);

      const { data: updatedConsulta, error: updateErr } = await supabase
        .from('consultations')
        .update({
          daily_room_url: room.url,
          daily_room_name: room.name,
          status: shouldUpdateStatus ? 'in_progress' : consultation.status,
        })
        .eq('id', consultation.id)
        .select()
        .single();

      if (updateErr || !updatedConsulta) {
        console.error('Erro ao atualizar consultation com a sala:', updateErr);
        throw new Error('Falha ao atualizar sala de telemedicina.');
      }
      consultation = updatedConsulta;
    }

    if (isDoctor && shouldUpdateStatus && consultation.status !== 'in_progress') {
      const { data: updatedStatus, error: statusErr } = await supabase
        .from('consultations')
        .update({ status: 'in_progress' })
        .eq('id', consultation.id)
        .select()
        .single();

      if (statusErr || !updatedStatus) {
        console.error('Erro ao marcar consulta em andamento:', statusErr);
        throw new Error('Falha ao liberar sala para o paciente.');
      }

      consultation = updatedStatus;
    }

    const tokenNotBefore = isDoctor || consultation.status === 'in_progress'
      ? undefined
      : getPatientTokenNotBefore(consultation.appointment_date);
    const requestOrigin = req.headers.get('origin') || new URL(req.url).origin;
    const token = await createMeetingToken(consultation.daily_room_name, Boolean(isDoctor), {
      notBefore: tokenNotBefore,
      canRecord: Boolean(isDoctor),
      redirectOnMeetingExit: `${requestOrigin}/consulta-encerrada`,
    });

    return NextResponse.json({
      success: true,
      url: consultation.daily_room_url,
      token,
      consultationId: consultation.id,
    });
  } catch (error: any) {
    console.error('Erro na rota de telemedicina:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
