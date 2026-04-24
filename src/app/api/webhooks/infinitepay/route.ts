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
    
    const { status: pStatus, event: pEvent, payload: innerPayload } = payload;
    const data = innerPayload?.data || payload.data || payload;
    const txId = data.id || data.slug || payload.id || payload.slug;
    const orderNsu = data.order_nsu || data.external_id || data.order_id || payload.order_id || payload.order_nsu;
    const status = pStatus || data.status;
    const event = pEvent;

    console.log(`[Webhook InfinitePay] Analisando Transação: ${txId}, NSU: ${orderNsu}, Status: ${status}, Event: ${event}`);

    if (!txId && !orderNsu) {
      console.error("[Webhook InfinitePay] Identificador da transação não encontrado no payload");
      return NextResponse.json({ error: "Identificador não encontrado" }, { status: 400 });
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
      
      // 1. Tenta identificar o pagamento no Supabase
      // Prioridade 1: order_nsu (nosso UUID de pagamento)
      // Prioridade 2: infinitepay_tx_id (o ID/Slug que salvamos após criar o checkout)
      let activePayment = null;

      if (orderNsu) {
        console.log(`[Webhook InfinitePay] Buscando pagamento por order_nsu: ${orderNsu}`);
        const { data: pByNsu } = await supabase
          .from('payments')
          .select()
          .eq('id', orderNsu)
          .maybeSingle();
        
        if (pByNsu) activePayment = pByNsu;
      }

      if (!activePayment && txId) {
        console.log(`[Webhook InfinitePay] Buscando pagamento por txId: ${txId}`);
        const { data: pByTx } = await supabase
          .from('payments')
          .select()
          .eq('infinitepay_tx_id', txId)
          .maybeSingle();
        
        if (pByTx) activePayment = pByTx;
      }

      if (activePayment) {
        // Se já estiver aprovado, apenas ignoramos para não duplicar consulta
        if (activePayment.status === 'approved') {
            console.log(`[Webhook InfinitePay] Pagamento ${activePayment.id} já estava aprovado.`);
            return NextResponse.json({ status: "already_approved" });
        }

        // Atualiza para aprovado e salva o txId caso estivesse faltando
        await supabase
          .from('payments')
          .update({ 
            status: 'approved', 
            updated_at: new Date().toISOString(),
            infinitepay_tx_id: activePayment.infinitepay_tx_id || txId
          })
          .eq('id', activePayment.id);
      }

      if (!activePayment) {
        console.error("[Webhook InfinitePay] Pagamento não localizado no banco de dados.");
        return NextResponse.json({ error: "Pagamento não localizado" }, { status: 404 });
      }

      console.log(`[Webhook InfinitePay] Pagamento ${activePayment.id} processado no banco. Sincronizando com Planilha/Consultas...`);
      
      const GOOGLE_SHEETS_API = 'https://script.google.com/macros/s/AKfycbxXLDeq4DoUOWUlmAM4yWdnPDxyWPBbzFbOSoMRNlsavPJNvtiKWUzok8ed2RkzvcSY/exec';
      
      try {
          if (activePayment.appointment_data) {
              console.log("[Webhook InfinitePay] Criando agendamento na planilha...");
              
              // Garante que appointment_data seja um objeto (Supabase pode retornar como string em alguns casos)
              let appointmentDataRaw = activePayment.appointment_data;
              if (typeof appointmentDataRaw === 'string') {
                  try {
                      appointmentDataRaw = JSON.parse(appointmentDataRaw);
                  } catch (e) {
                      console.error("[Webhook InfinitePay] Erro ao parsear appointment_data:", e);
                  }
              }

              const appointmentData = {
                  ...appointmentDataRaw,
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
                      
                      // Converte data de DD/MM/YYYY (Planilha) para YYYY-MM-DD (Banco/Filtros)
                      let dbDate = appointmentData.data_consulta;
                      if (dbDate && dbDate.includes('/')) {
                          const [d, m, y] = dbDate.split('/');
                          dbDate = `${y}-${m}-${d}`;
                      }

                      // Extrai o doctor_id de dentro do appointment_data se existir
                      // Nota: doctor_id e outras colunas extras foram removidas do insert 
                      // pois a tabela consultations atual possui apenas as colunas básicas.
                      // O painel do médico e o perfil do paciente já buscam dados do perfil via join.

                      const { error: consError } = await supabase
                          .from('consultations')
                          .insert({
                              patient_id: activePayment.patient_id,
                              payment_id: activePayment.id,
                              doctor_name: appointmentData.medico || 'Dr. André',
                              appointment_date: dbDate || new Date().toISOString(),
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
