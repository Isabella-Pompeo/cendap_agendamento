
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://dvkphzzuincokfybsqrj.supabase.co";
const supabaseServiceKey = process.argv[2];

if (!supabaseServiceKey) {
  console.error('Passe a chave service_role como argumento!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkCols() {
  const { data, error } = await supabase.from('consultations').select('*').limit(1);
  if (error) console.error('Erro:', error);
  else console.log('Colunas de consultations:', Object.keys(data[0] || {}));
}

checkCols();
