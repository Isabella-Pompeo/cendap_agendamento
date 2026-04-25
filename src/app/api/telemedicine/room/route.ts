import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createDailyRoom, createMeetingToken } from '../../../../lib/telemedicine';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const { appointmentId, patientId, doctorName, appointmentDate, isDoctor, shouldUpdateStatus = true } = await req.json();

    if (!appointmentId || !patientId) {
      return NextResponse.json({ error: "Parâmetros ausentes." }, { status: 400 });
    }

    // Tentar encontrar uma consulta existente priorizando o ID recebido
    let consultation = null;

    if (appointmentId && appointmentId !== 'temp') {
      const { data } = await supabase
        .from('consultations')
        .select('*')
        .eq('id', appointmentId)
        .single();
      consultation = data;
    }

    // Se não encontrou pelo ID (ex: link direto antigo), tenta por patient_id e data de hoje
    if (!consultation) {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('consultations')
        .select('*')
        .eq('patient_id', patientId)
        .eq('appointment_date', today)
        .limit(1)
        .maybeSingle();
      consultation = data;
    }

    if (!consultation) {
      // Se não existe, cria a sala no Daily e a consulta no banco
      const room = await createDailyRoom(`consulta-${patientId}-${Date.now()}`);
      
      const { data: newConsulta, error: insertErr } = await supabase
        .from('consultations')
        .insert({
          patient_id: patientId,
          doctor_name: doctorName || 'Dr. André',
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
    } else if (!consultation.daily_room_url) {
      // A consulta existe (criada via webhook), mas a sala ainda não foi criada
      const room = await createDailyRoom(`consulta-${patientId}-${Date.now()}`);
      
      const { data: updatedConsulta, error: updateErr } = await supabase
        .from('consultations')
        .update({
          daily_room_url: room.url,
          daily_room_name: room.name,
          status: shouldUpdateStatus ? 'in_progress' : consultation.status
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

    // Gera um token para acesso à sala
    const token = await createMeetingToken(consultation.daily_room_name, isDoctor);

    return NextResponse.json({ 
      success: true, 
      url: consultation.daily_room_url,
      token: token,
      consultationId: consultation.id
    });

  } catch (error: any) {
    console.error("Erro na rota de telemedicina:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
