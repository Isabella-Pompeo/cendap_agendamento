
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = "https://dvkphzzuincokfybsqrj.supabase.co";
const supabaseServiceKey = process.argv[2];
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fix() {
  const andreUUID = "42a5b4b2-c90f-4ac8-b83d-32eb296b3de6";
  const pid = "12993d9d-5917-4e57-b5a3-1600c2a61e03"; // Wesley's ID from check_payments
  
  console.log('--- Criando consulta manual para o Wesley ---');
  const { data, error } = await supabase.from('consultations').insert({
    patient_id: pid,
    doctor_id: andreUUID,
    doctor_name: 'Dr. André Pontes',
    appointment_date: "2026-04-25T12:00:00Z",
    status: 'scheduled'
  }).select();

  if (error) console.error('Erro:', JSON.stringify(error, null, 2));
  else console.log('Consulta criada e vinculada com sucesso:', data);
}
fix();
