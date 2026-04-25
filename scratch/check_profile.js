
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = "https://dvkphzzuincokfybsqrj.supabase.co";
const supabaseServiceKey = process.argv[2];
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkProfile() {
  const pid = "12993d9d-5917-4e57-b5a3-1600c2a61e03";
  const { data, error } = await supabase.from('profiles').select('*').eq('id', pid).single();
  if (error) console.error('Erro profile:', error);
  else console.log('Profile encontrado:', data);
}
checkProfile();
