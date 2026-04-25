
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dvkphzzuincokfybsqrj.supabase.co';
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2a3Boenp1aW5jb2tmeWJzcXJqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjI1OTI1NiwiZXhwIjoyMDkxODM1MjU2fQ.DeQ29YCP-K4bTH7GJjgKcMc9jTZ3oVuH2JPL5UnKqUA";

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixPayment() {
  // 1. Busca o pagamento aprovado mais recente desse paciente
  const { data: payData, error: payError } = await supabase
    .from('payments')
    .select('id, status, patient_id')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(1);

  if (payError || !payData.length) {
    console.error("Pagamento aprovado não encontrado.");
    return;
  }

  const paymentId = payData[0].id;
  console.log("Pagamento encontrado:", paymentId);

  // 2. Vincula o pagamento à consulta do Wesley
  const { data, error } = await supabase
    .from('consultations')
    .update({ payment_id: paymentId })
    .eq('id', '10753020-5095-42aa-9ef3-194384b73447');

  if (error) {
    console.error(error);
  } else {
    console.log("Status de pagamento vinculado com sucesso! Agora deve aparecer como PAGO.");
  }
}

fixPayment();
