import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2a3Boenp1aW5jb2tmeWJzcXJqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjI1OTI1NiwiZXhwIjoyMDkxODM1MjU2fQ.DeQ29YCP-K4bTH7GJjgKcMc9jTZ3oVuH2JPL5UnKqUA';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  SERVICE_KEY
);

const GOOGLE_SHEETS_API = 'https://script.google.com/macros/s/AKfycbxXLDeq4DoUOWUlmAM4yWdnPDxyWPBbzFbOSoMRNlsavPJNvtiKWUzok8ed2RkzvcSY/exec';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { patientId, amount, doctorName, appointmentDate, patientName, patientPhone, appointmentData } = body;

    const INFINITEPAY_API_URL = 'https://api.infinitepay.io/invoices/public/checkout/links';
    const INFINITEPAY_HANDLE = process.env.INFINITEPAY_HANDLE || 'luiz-andre-067';

    // 1. Criamos o registro no banco ANTES para ter um ID
    const { data: payment, error: insertError } = await supabase
      .from('payments')
      .insert({
        patient_id: patientId,
        amount: amount,
        status: 'pending',
        payment_method: 'pix',
        appointment_data: appointmentData
      })
      .select()
      .single();

    if (insertError) {
        console.error("[Checkout] Erro ao inserir no Supabase:", insertError);
        throw new Error("Erro ao registrar pagamento no banco.");
    }

    console.log(`[Checkout] Pagamento ${payment.id} criado no banco.`);

    const orderNsu = payment.id;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `https://${req.headers.get('host')}`;
    const priceInCents = typeof amount === 'number' ? amount : 15000;

    const payload = {
      handle: INFINITEPAY_HANDLE,
      items: [
        {
          quantity: 1,
          price: priceInCents,
          description: `Consulta Telemedicina - ${doctorName || 'CENDAP'}`
        }
      ],
      order_nsu: orderNsu,
      webhook_url: `${baseUrl}/api/webhooks/infinitepay`,
      customer: {
        name: patientName || 'Paciente CENDAP',
        phone_number: patientPhone ? `+55${patientPhone.replace(/\D/g, '')}` : undefined
      }
    };

    console.log('[Checkout] Enviando para InfinitePay:', JSON.stringify(payload, null, 2));

    const response = await fetch(INFINITEPAY_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();
    console.log('[Checkout] Resposta InfinitePay status:', response.status, 'body:', responseText);

    if (!response.ok) {
      throw new Error(`InfinitePay retornou status ${response.status}: ${responseText}`);
    }

    let txData;
    try {
      txData = JSON.parse(responseText);
    } catch {
      throw new Error(`Resposta inválida da InfinitePay: ${responseText}`);
    }

    // 2. Salva o ID/Slug da InfinitePay
    const txId = txData.slug || txData.id;
    console.log(`[Checkout] InfinitePay TX ID: ${txId}`);

    const { error: updateError } = await supabase
      .from('payments')
      .update({ 
        infinitepay_tx_id: txId,
        updated_at: new Date().toISOString()
      })
      .eq('id', payment.id);

    if (updateError) {
      console.error('[Checkout] Erro ao atualizar infinitepay_tx_id:', updateError);
    } else {
      console.log(`[Checkout] infinitepay_tx_id salvo com sucesso: ${txId}`);
    }

    // ============================================================
    // 3. NOVO: Já salva na planilha e cria consulta AGORA
    //    Não dependemos mais do webhook para isso.
    //    O pagamento fica como "pending" até o webhook confirmar,
    //    mas o agendamento e a consulta já existem.
    // ============================================================
    
    try {
      if (appointmentData) {
        console.log('[Checkout] Salvando agendamento na planilha e criando consulta...');
        
        const sheetData = {
          ...appointmentData,
          pagamento: payment.id,
          status: 'Aguardando Pagamento'
        };

        // Salva na planilha do Google
        const sheetRes = await fetch(GOOGLE_SHEETS_API, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(sheetData)
        });
        const sheetResult = await sheetRes.text();
        console.log('[Checkout] Resposta da Planilha:', sheetResult);

        // Se for Telemedicina, cria a consulta no banco
        if (appointmentData.tipo === 'Telemedicina') {
          let dbDate = appointmentData.data_consulta;
          if (dbDate && dbDate.includes('/')) {
            const [d, m, y] = dbDate.split('/');
            dbDate = `${y}-${m}-${d}`;
          }

          const { error: consError } = await supabase
            .from('consultations')
            .insert({
              patient_id: patientId,
              payment_id: payment.id,
              doctor_name: appointmentData.medico || 'Dr. André',
              appointment_date: dbDate || new Date().toISOString(),
              status: 'scheduled'
            });

          if (consError) {
            console.error('[Checkout] Erro ao criar consulta:', consError);
          } else {
            console.log('[Checkout] Consulta criada com sucesso!');
          }
        }
      }
    } catch (sheetErr: any) {
      console.error('[Checkout] Erro ao salvar na planilha/consulta (não-fatal):', sheetErr.message);
      // Não travamos o fluxo - o link de pagamento ainda é válido
    }

    // URL do checkout
    const checkoutUrl = txData.url || txData.payment_url || txData.link || txData.receipt_url;

    if (!checkoutUrl) {
      console.error('[Checkout] Resposta sem URL:', txData);
      throw new Error('InfinitePay não retornou URL de checkout');
    }

    return NextResponse.json({
      paymentId: orderNsu,
      checkoutUrl: checkoutUrl,
      mock: false
    });

  } catch (error: any) {
    console.error('[Checkout] Erro:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
