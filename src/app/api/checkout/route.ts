import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Temporariamente usando a chave hardcoded para garantir que o Vercel não falhe por falta de variável de ambiente
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2a3Boenp1aW5jb2tmeWJzcXJqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjI1OTI1NiwiZXhwIjoyMDkxODM1MjU2fQ.DeQ29YCP-K4bTH7GJjgKcMc9jTZ3oVuH2JPL5UnKqUA';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  SERVICE_KEY
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { patientId, amount, doctorName, appointmentDate, patientName, patientPhone, appointmentData } = body;

    const INFINITEPAY_API_URL = 'https://api.infinitepay.io/invoices/public/checkout/links';
    const INFINITEPAY_HANDLE = process.env.INFINITEPAY_HANDLE || 'luiz-andre-067';

    // 1. Criamos o registro no banco ANTES para ter um ID e poder usar como order_nsu
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
        console.error("Erro ao inserir no Supabase:", insertError);
        throw new Error("Erro ao registrar pagamento no banco.");
    }

    const orderNsu = payment.id; // Usamos o ID do Supabase como NSU

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `https://${req.headers.get('host')}`;

    // Preço em centavos -> reais (InfinitePay espera valor em centavos)
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
      headers: {
        'Content-Type': 'application/json',
      },
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

    // 2. Atualizamos o registro no banco com o ID/Slug da InfinitePay para o webhook saber quem é
    const { error: updateError } = await supabase
      .from('payments')
      .update({ 
        infinitepay_tx_id: txData.slug || txData.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', payment.id);

    if (updateError) {
      console.error('[Checkout] Erro ao atualizar infinitepay_tx_id:', updateError);
      // Não travamos o fluxo aqui para o usuário não perder o link, mas o log nos dirá o erro
    }

    // A InfinitePay retorna a URL do checkout no campo 'url' ou 'link'
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
