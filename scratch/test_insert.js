
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = "https://dvkphzzuincokfybsqrj.supabase.co";
const supabaseServiceKey = process.argv[2];
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testInsert() {
  console.log('--- Testando Insert ---');
  const { data, error } = await supabase.from('consultations').insert({
    doctor_name: 'Teste',
    status: 'scheduled'
  }).select();
  
  if (error) {
    console.error('Erro no insert:', JSON.stringify(error, null, 2));
  } else {
    console.log('Sucesso:', data);
  }
}
testInsert();
