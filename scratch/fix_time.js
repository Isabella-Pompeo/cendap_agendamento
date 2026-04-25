
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = "https://dvkphzzuincokfybsqrj.supabase.co";
const supabaseServiceKey = process.argv[2];
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fix() {
  console.log('--- Corrigindo horário da consulta do Wesley ---');
  
  // Atualiza a consulta do Wesley para 17:00
  const { data, error } = await supabase
    .from('consultations')
    .update({ 
      appointment_date: "2026-04-25T17:00:00" // Sem Z para ser interpretado como local
    })
    .ilike('doctor_name', '%André%');

  if (error) console.error('Erro ao corrigir:', error);
  else console.log('Horário corrigido!');
}

fix();
