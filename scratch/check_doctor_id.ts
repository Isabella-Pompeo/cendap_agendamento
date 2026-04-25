
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Carrega o .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Faltam variáveis de ambiente!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkDoctors() {
  console.log('--- Buscando médicos em doctor_settings ---');
  const { data: settings, error: sError } = await supabase.from('doctor_settings').select('*');
  if (sError) console.error('Erro settings:', sError);
  else console.log('Settings:', JSON.stringify(settings, null, 2));

  console.log('\n--- Buscando perfis de médicos ---');
  const { data: profiles, error: pError } = await supabase.from('profiles').select('*').limit(10);
  if (pError) console.error('Erro profiles:', pError);
  else console.log('Profiles:', JSON.stringify(profiles, null, 2));
}

checkDoctors();
