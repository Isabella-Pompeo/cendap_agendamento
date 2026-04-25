import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2a3Boenp1aW5jb2tmeWJzcXJqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjI1OTI1NiwiZXhwIjoyMDkxODM1MjU2fQ.DeQ29YCP-K4bTH7GJjgKcMc9jTZ3oVuH2JPL5UnKqUA';
const ASAAS_API_KEY = process.env.ASAAS_API_KEY; 
const ASAAS_API_URL = 'https://api.asaas.com/v3';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  SERVICE_KEY
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { patientId, amount, doctorName, patientName, patientPhone, patientCpf, appointmentData } = body;

    if (!ASAAS_API_KEY) {
        return NextResponse.json({ error: 'ASAAS_API_KEY não configurada no .env.local' }, { status: 500 });
    }

    console.log(`[ASAAS Sandbox] Iniciando checkout para ${patientName}`);

    // 1. Registro inicial no Supabase
    const { data: paymentRecord, error: insertError } = await supabase
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

    if (insertError) throw new Error(`Supabase: ${insertError.message}`);

    // 2. Buscar/Criar Cliente no ASAAS
    const cleanCpf = patientCpf.replace(/\D/g, '');
    const customerSearchRes = await fetch(`${ASAAS_API_URL}/customers?cpfCnpj=${cleanCpf}`, {
        headers: { 'access_token': ASAAS_API_KEY }
    });
    const customerSearchData = await customerSearchRes.json();
    
    let customerId = '';
    if (customerSearchData.data && customerSearchData.data.length > 0) {
        customerId = customerSearchData.data[0].id;
    } else {
        const newCustomerRes = await fetch(`${ASAAS_API_URL}/customers`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'access_token': ASAAS_API_KEY 
            },
            body: JSON.stringify({
                name: patientName,
                cpfCnpj: cleanCpf,
                mobilePhone: patientPhone
            })
        });
        const newCustomerData = await newCustomerRes.json();
        if (newCustomerData.errors) throw new Error(`ASAAS Cliente: ${newCustomerData.errors[0].description}`);
        customerId = newCustomerData.id;
    }

    // 3. Criar Cobrança (Pix)
    const priceInReais = amount / 100;
    const paymentRes = await fetch(`${ASAAS_API_URL}/payments`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'access_token': ASAAS_API_KEY 
        },
        body: JSON.stringify({
            customer: customerId,
            billingType: 'PIX',
            value: priceInReais,
            dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
            description: `Telemedicina CENDAP - ${doctorName}`,
            externalReference: paymentRecord.id
        })
    });

    const paymentData = await paymentRes.json();
    if (paymentData.errors) throw new Error(`ASAAS Pagamento: ${paymentData.errors[0].description}`);

    // 4. Obter Pix Dados
    const pixDataRes = await fetch(`${ASAAS_API_URL}/payments/${paymentData.id}/pixQrCode`, {
        headers: { 'access_token': ASAAS_API_KEY }
    });
    const pixData = await pixDataRes.json();

    // 5. Vincular ID do ASAAS
    await supabase
        .from('payments')
        .update({ infinitepay_tx_id: paymentData.id })
        .eq('id', paymentRecord.id);

    return NextResponse.json({
        paymentId: paymentRecord.id,
        pixCopiaECola: pixData.payload,
        pixQrCode: pixData.encodedImage,
        checkoutUrl: paymentData.invoiceUrl
    });

  } catch (error: any) {
    console.error('[ASAAS Sandbox] Erro:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
