
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const getEnv = (key) => env.split('\n').find(l => l.startsWith(key))?.split('=')[1]?.trim();

const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const supabaseKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(supabaseUrl, supabaseKey);

async function createTestConsultation() {
  // 1. Encontrar o Dr. André
  const { data: doctor } = await supabase
    .from('doctor_settings')
    .select('*')
    .single();

  if (!doctor) {
    console.error('Doutor não encontrado.');
    return;
  }

  // 2. Encontrar um paciente de teste ou usar o primeiro perfil
  const { data: patient } = await supabase
    .from('profiles')
    .select('*')
    .limit(1)
    .single();

  if (!patient) {
    console.error('Paciente não encontrado.');
    return;
  }

  // 3. Criar a consulta
  const { data, error } = await supabase
    .from('consultations')
    .insert({
      patient_id: patient.id,
      doctor_name: 'Dr. André Pontes',
      status: 'scheduled',
      appointment_date: new Date().toISOString(),
      clinical_notes: 'Consulta de teste para telemedicina.'
    })
    .select()
    .single();

  if (error) {
    console.error('Erro ao criar consulta:', error);
  } else {
    console.log('Consulta de teste criada com sucesso:', data.id);
  }
}

createTestConsultation();
