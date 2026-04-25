
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = "https://dvkphzzuincokfybsqrj.supabase.co";
const supabaseServiceKey = process.argv[2];
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debug() {
  const { data, error } = await supabase.from('consultations').select('*');
  console.log('Error:', error);
  console.log('Data (all):', JSON.stringify(data, null, 2));
}
debug();
