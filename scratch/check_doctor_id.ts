
import { createClient } from '@supabase/supabase-js';

// Não precisamos mais de dotenv aqui, vamos passar as chaves direto ou usar o que já temos
const supabaseUrl = "https://dvkphzzuincokfybsqrj.supabase.co";
// Peguei esta chave do seu .env.local anteriormente
const supabaseServiceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2a3Boenp1aW5jb2tmeWJzcXJqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjI1OTI1NiwiZXhwIjoyMDkxODM1MjU2fQ.DeQ29YCP-K4bTH7GJjgKcMc9jTZ3oVuH2JPL5UnKqUA";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkDoctors() {
  console.log('--- Buscando médicos em doctor_settings ---');
  const { data: settings, error: sError } = await supabase.from('doctor_settings').select('*');
  if (sError) console.error('Erro settings:', sError);
  else console.log('Settings:', JSON.stringify(settings, null, 2));

  console.log('\n--- Buscando perfis de médicos ---');
  const { data: profiles, error: pError } = await supabase.from('profiles').select('*').ilike('full_name', '%André%');
  if (pError) console.error('Erro profiles:', pError);
  else console.log('Profiles:', JSON.stringify(profiles, null, 2));
}

checkDoctors();
