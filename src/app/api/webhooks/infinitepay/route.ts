import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    console.log("[Webhook InfinitePay] Payload recebido:", JSON.stringify(payload, null, 2));
    
    // Identifica o ID da transação e o status
    // A InfinitePay pode enviar status como 'approved', 'paid', 'confirmed' ou via event
    const txId = payload.id || payload.transaction_id || payload.metadata?.tx_id || payload.slug;
    const status = payload.status;
    const event = payload.event;

    console.log(`[Webhook InfinitePay] Analisando Transação: ${txId}, Status: ${status}, Event: ${event}`);

    if (!txId) {
      console.error("[Webhook InfinitePay] ID da transação não encontrado no payload");
      return NextResponse.json({ error: "ID da transação não encontrado no payload" }, { status: 400 });
    }

    // Condições de aprovação (ampla cobertura de possíveis campos da InfinitePay)
    const isApproved = 
      status === 'approved' || 
      status === 'paid' || 
      status === 'confirmed' ||
      event === 'payment.approved' || 
      event === 'transaction.approved' ||
      payload.data?.status === 'approved';

    if (isApproved) {
      console.log(`[Webhook InfinitePay] Pagamento ${txId} APROVADO. Iniciando processamento...`);
      
      // 1. Atualiza o status do pagamento no Supabase
      const { data: payment, error: pError } = await supabase
        .from('payments')
        .update({ 
          status: 'approved', 
          updated_at: new Date().toISOString() 
        })
        .eq('infinitepay_tx_id', txId)
        .select()
        .single();

      if (pError || !payment) {
        console.error("[Webhook InfinitePay] Erro ao atualizar pagamento ou pagamento não encontrado:", pError);
        // Tenta buscar pelo ID do Supabase se o txId falhar (caso order_nsu tenha sido usado)
        const { data: altPayment, error: altError } = await supabase
          .from('payments')
          .update({ status: 'approved' })
          .eq('id', txId) // Alguns sistemas usam order_nsu como ID
          .select()
          .single();

        if (altError || !altPayment) {
           return NextResponse.json({ error: "Pagamento não encontrado no sistema" }, { status: 404 });
        }
        // Se encontrou via fallback, continua com altPayment
        // (Isso ajuda se a InfinitePay devolver o NSU em vez do ID deles)
      }

      const activePayment = payment || (await supabase.from('payments').select().eq('id', txId).single()).data;
      if (!activePayment) return NextResponse.json({ error: "Pagamento não localizado" }, { status: 404 });

      console.log(`[Webhook InfinitePay] Pagamento ${activePayment.id} processado no banco. Sincronizando com Planilha/Consultas...`);
      
      const GOOGLE_SHEETS_API = 'https://script.google.com/macros/s/AKfycbxXLDeq4DoUOWUlmAM4yWdnPDxyWPBbzFbOSoMRNlsavPJNvtiKWUzok8ed2RkzvcSY/exec';
      
      try {
          if (activePayment.appointment_data) {
              console.log("[Webhook InfinitePay] Criando agendamento na planilha...");
              const appointmentData = {
                  ...activePayment.appointment_data,
                  pagamento: activePayment.id,
                  status: 'Pago'
              };

              const sheetRes = await fetch(GOOGLE_SHEETS_API, {
                  method: 'POST',
                  headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                  body: JSON.stringify(appointmentData)
              });
              const sheetResult = await sheetRes.text();
              console.log("[Webhook InfinitePay] Resposta da Planilha:", sheetResult);

              // 2. Se for Telemedicina, cria a consulta no banco
              if (appointmentData.tipo === 'Telemedicina') {
                  console.log("[Webhook InfinitePay] Registrando consulta de Telemedicina...");
                  const { error: consError } = await supabase
                      .from('consultations')
                      .insert({
                          patient_id: activePayment.patient_id,
                          payment_id: activePayment.id,
                          doctor_name: appointmentData.medico || 'Dr. André',
                          appointment_date: appointmentData.data_consulta || new Date().toISOString(),
                          status: 'scheduled'
                      });
                  if (consError) {
                      console.error("[Webhook InfinitePay] Erro ao criar consulta:", consError);
                  } else {
                      console.log("[Webhook InfinitePay] Consulta criada com sucesso!");
                  }
              }
          } else {
              console.log("[Webhook InfinitePay] Sem appointment_data, atualizando apenas status na planilha...");
              await fetch(GOOGLE_SHEETS_API, {
                  method: 'POST',
                  headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                  body: JSON.stringify({ 
                      action: 'update_status_by_payment_id', 
                      pagamento: activePayment.id,
                      status: 'Pago'
                  })
              });
          }
      } catch (err) {
          console.error("[Webhook InfinitePay] Erro no fluxo pós-pagamento:", err);
      }
    } else {
      console.log(`[Webhook InfinitePay] Pagamento ${txId} ignorado (Status: ${status}, Event: ${event})`);
    }

    return NextResponse.json({ success: true, message: "Webhook processado" });
  } catch (error: any) {
    console.error("Erro no Webhook da InfinitePay:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
