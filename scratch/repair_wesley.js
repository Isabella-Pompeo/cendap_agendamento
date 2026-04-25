
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dvkphzzuincokfybsqrj.supabase.co';
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2a3Boenp1aW5jb2tmeWJzcXJqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjI1OTI1NiwiZXhwIjoyMDkxODM1MjU2fQ.DeQ29YCP-K4bTH7GJjgKcMc9jTZ3oVuH2JPL5UnKqUA";

const supabase = createClient(supabaseUrl, supabaseKey);

async function repair() {
  const { data, error } = await supabase
    .from('consultations')
    .update({ appointment_date: '2026-05-04T17:00:00-03:00' })
    .eq('id', '10753020-5095-42aa-9ef3-194384b73447');

  if (error) {
    console.error(error);
  } else {
    console.log("Registro do Wesley corrigido com sucesso para 04/05 às 17:00!");
  }
}

repair();
