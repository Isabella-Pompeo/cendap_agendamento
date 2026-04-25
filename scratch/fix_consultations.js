
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://dvkphzzuincokfybsqrj.supabase.co";
const supabaseServiceKey = process.argv[2];

if (!supabaseServiceKey) {
  console.error('Passe a chave service_role como argumento!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixConsultation() {
  console.log('--- Corrigindo consultas do Dr. André ---');
  
  const andreUUID = "42a5b4b2-c90f-4ac8-b83d-32eb296b3de6";
  
  // Atualiza consultas que estão com o ID errado ou sem ID mas que são do Dr. André
  const { data, error } = await supabase
    .from('consultations')
    .update({ 
      doctor_id: andreUUID,
      appointment_date: "2026-04-25T12:00:00Z" // Garante que caia em "Hoje"
    })
    .or(`doctor_id.is.null,doctor_id.eq.doc-0-dr-andre-pontes`)
    .ilike('doctor_name', '%André%');

  if (error) console.error('Erro ao corrigir:', error);
  else console.log('Consultas corrigidas com sucesso!');
}

fixConsultation();
