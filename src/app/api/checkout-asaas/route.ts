import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2a3Boenp1aW5jb2tmeWJzcXJqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjI1OTI1NiwiZXhwIjoyMDkxODM1MjU2fQ.DeQ29YCP-K4bTH7GJjgKcMc9jTZ3oVuH2JPL5UnKqUA';
const ASAAS_API_KEY = process.env.ASAAS_API_KEY || '$aact_prod_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OmFkZTI5YjkxLWI5MTctNGY3Mi1hYzkwLTlkZGYzMzUwMDMyZDo6JGFhY2hfZDgzNjZjZDktMjUzNS00NzQ0LThkYjctYjRhZDViYTkxZjIx'; 
const ASAAS_API_URL = 'https://api.asaas.com/v3'; // PRODUÇÃO

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  SERVICE_KEY
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { patientId, amount, doctorName, patientName, patientPhone, patientCpf, appointmentData } = body;

    console.log(`[ASAAS Checkout] Iniciando para ${patientName} (${patientCpf})`);

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

    if (insertError) throw new Error(`Erro Supabase: ${insertError.message}`);

    let customerId = '';
    const cleanCpf = patientCpf.replace(/\D/g, '');
    
    const customerSearchRes = await fetch(`${ASAAS_API_URL}/customers?cpfCnpj=${cleanCpf}`, {
        headers: { 'access_token': ASAAS_API_KEY }
    });
    const customerSearchData = await customerSearchRes.json();
    
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
        if (newCustomerData.errors) throw new Error(`Erro ASAAS (Cliente): ${newCustomerData.errors[0].description}`);
        customerId = newCustomerData.id;
    }

    const priceInReais = amount / 100;
    const paymentRes = await fetch(`${ASAAS_API_URL}/payments`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'access_token': ASAAS_API_KEY 
        },
        body: JSON.stringify({
            customer: customerId,
            billingType: 'UNDEFINED', // Permite que o cliente escolha entre Pix ou Cartão no checkout
            value: priceInReais,
            dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
            description: `Consulta Telemedicina - ${doctorName || 'CENDAP'}`,
            externalReference: paymentRecord.id
        })
    });

    const paymentData = await paymentRes.json();
    if (paymentData.errors) throw new Error(`Erro ASAAS (Pagamento): ${paymentData.errors[0].description}`);

    const pixDataRes = await fetch(`${ASAAS_API_URL}/payments/${paymentData.id}/pixQrCode`, {
        headers: { 'access_token': ASAAS_API_KEY }
    });
    const pixData = await pixDataRes.json();

    await supabase
        .from('payments')
        .update({
            asaas_payment_id: paymentData.id,
            updated_at: new Date().toISOString()
        })
        .eq('id', paymentRecord.id);

    return NextResponse.json({
        paymentId: paymentRecord.id,
        checkoutUrl: paymentData.invoiceUrl,
        pixCopiaECola: pixData.payload,
        pixQrCode: pixData.encodedImage,
        asaasId: paymentData.id
    });

  } catch (error: any) {
    console.error('[ASAAS Checkout] Erro:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
