
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://dvkphzzuincokfybsqrj.supabase.co";
const supabaseServiceKey = process.argv[2];

if (!supabaseServiceKey) {
  console.error('Passe a chave service_role como argumento!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkDoctors() {
  console.log('--- Buscando perfis de médicos ---');
  const { data: profiles, error: pError } = await supabase.from('profiles').select('*').ilike('full_name', '%André%');
  if (pError) console.error('Erro profiles:', pError);
  else console.log('Profiles:', JSON.stringify(profiles, null, 2));

  console.log('\n--- Buscando todos de doctor_settings ---');
  const { data: settings, error: sError } = await supabase.from('doctor_settings').select('*');
  if (sError) console.error('Erro settings:', sError);
  else console.log('Settings:', JSON.stringify(settings, null, 2));
}

checkDoctors();
