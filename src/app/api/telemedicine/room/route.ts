import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createDailyRoom, createMeetingToken } from '../../../../lib/telemedicine';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const { appointmentId, patientId, doctorName, appointmentDate, isDoctor } = await req.json();

    if (!appointmentId || !patientId) {
      return NextResponse.json({ error: "Parâmetros ausentes." }, { status: 400 });
    }

    // Tentar encontrar uma consultation existente
    // Usamos o appointmentId como referência cruzada ou criamos baseado no patient e date.
    // Para simplificar, vamos buscar se já existe uma sala para esse patient_id e data (hoje).
    
    // Como appointment_date vem como string, precisamos comparar as datas
    const dateStart = new Date();
    dateStart.setHours(0,0,0,0);
    const dateEnd = new Date();
    dateEnd.setHours(23,59,59,999);

    const { data: existingConsulta, error: fetchErr } = await supabase
      .from('consultations')
      .select('*')
      .eq('patient_id', patientId)
      .gte('created_at', dateStart.toISOString())
      .lte('created_at', dateEnd.toISOString())
      .limit(1)
      .single();

    let consultation = existingConsulta;

    if (!consultation || fetchErr) {
      // Se não existe, cria a sala no Daily e a consulta no banco
      const room = await createDailyRoom(`consulta-${patientId}-${Date.now()}`);
      
      const { data: newConsulta, error: insertErr } = await supabase
        .from('consultations')
        .insert({
          patient_id: patientId,
          doctor_name: doctorName || 'Dr. André',
          appointment_date: appointmentDate || new Date().toISOString(),
          status: 'in_progress',
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
          status: 'in_progress'
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
