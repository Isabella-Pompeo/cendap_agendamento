import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    console.log("Webhook InfinitePay recebido:", payload);
    
    // A estrutura exata depende da doc da InfinitePay.
    // Normalmente enviam o ID da transação e o novo status.
    const txId = payload.id || payload.transaction_id || payload.metadata?.tx_id;
    const status = payload.status; // ex: 'approved', 'paid', 'declined'

    if (!txId) {
      return NextResponse.json({ error: "ID da transação não encontrado no payload" }, { status: 400 });
    }

    // Se o pagamento foi aprovado
    if (status === 'approved' || status === 'paid' || payload.event === 'payment.approved' || payload.event === 'transaction.approved') {
      
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
        console.error("Erro ao atualizar pagamento no Supabase:", pError);
        return NextResponse.json({ error: "Pagamento não encontrado" }, { status: 404 });
      }

      console.log(`Pagamento ${payment.id} aprovado. Avisando Planilha...`);
      
      // 3. Avisamos a Planilha do Google
      const GOOGLE_SHEETS_API = 'https://script.google.com/macros/s/AKfycbxXLDeq4DoUOWUlmAM4yWdnPDxyWPBbzFbOSoMRNlsavPJNvtiKWUzok8ed2RkzvcSY/exec';
      
      try {
          // Se tivermos os dados do agendamento salvos, criamos a linha na planilha agora
          if (payment.appointment_data) {
              console.log("Criando novo agendamento na planilha via Webhook...");
              const appointmentData = {
                  ...payment.appointment_data,
                  pagamento: payment.id,
                  status: 'Pago' // Força status Pago na criação
              };

              await fetch(GOOGLE_SHEETS_API, {
                  method: 'POST',
                  headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                  body: JSON.stringify(appointmentData)
              });
              console.log("Agendamento criado na planilha com sucesso!");
          } else {
              // Fallback para o comportamento antigo de apenas atualizar status (se a linha já existir)
              console.log("Dados do agendamento não encontrados, tentando atualizar status por ID de pagamento...");
              await fetch(GOOGLE_SHEETS_API, {
                  method: 'POST',
                  headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                  body: JSON.stringify({ 
                      action: 'update_status_by_payment_id', 
                      pagamento: payment.id,
                      status: 'Pago'
                  })
              });
          }
      } catch (sheetError) {
          console.error("Erro ao processar planilha no webhook:", sheetError);
      }
    }

    return NextResponse.json({ success: true, message: "Webhook processado" });
  } catch (error: any) {
    console.error("Erro no Webhook da InfinitePay:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
