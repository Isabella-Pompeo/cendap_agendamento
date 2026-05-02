import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ASAAS_API_URL = 'https://api.asaas.com/v3';

const requireEnv = (name: string) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} nao configurada.`);
  }
  return value;
};

const getSupabaseAdmin = () =>
  createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  );

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const asaasApiKey = requireEnv('ASAAS_API_KEY');
    const body = await req.json();
    const { patientId, amount, doctorName, patientName, patientPhone, patientCpf, appointmentData } = body;
    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.agendacendap.com.br';

    if (!patientId || !amount || !patientName || !patientPhone || !patientCpf || !appointmentData) {
      return NextResponse.json({ error: 'Dados de checkout incompletos.' }, { status: 400 });
    }

    console.log(`[ASAAS Checkout] Iniciando para ${patientName} (${patientCpf})`);

    const { data: paymentRecord, error: insertError } = await supabase
      .from('payments')
      .insert({
        patient_id: patientId,
        amount,
        status: 'pending',
        payment_method: 'pix',
        appointment_data: appointmentData,
      })
      .select()
      .single();

    if (insertError) throw new Error(`Erro Supabase: ${insertError.message}`);

    let customerId = '';
    const cleanCpf = String(patientCpf).replace(/\D/g, '');

    const customerSearchRes = await fetch(`${ASAAS_API_URL}/customers?cpfCnpj=${cleanCpf}`, {
      headers: { access_token: asaasApiKey },
    });
    const customerSearchData = await customerSearchRes.json();

    if (customerSearchData.data && customerSearchData.data.length > 0) {
      customerId = customerSearchData.data[0].id;
    } else {
      const newCustomerRes = await fetch(`${ASAAS_API_URL}/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          access_token: asaasApiKey,
        },
        body: JSON.stringify({
          name: patientName,
          cpfCnpj: cleanCpf,
          mobilePhone: patientPhone,
        }),
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
        access_token: asaasApiKey,
      },
      body: JSON.stringify({
        customer: customerId,
        billingType: 'UNDEFINED',
        value: priceInReais,
        dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        description: `Consulta Telemedicina - ${doctorName || 'CENDAP'}`,
        externalReference: paymentRecord.id,
        callback: {
          successUrl: `${origin}/?telemedicinePaymentReturn=${paymentRecord.id}`,
        },
      }),
    });

    const paymentData = await paymentRes.json();
    if (paymentData.errors) throw new Error(`Erro ASAAS (Pagamento): ${paymentData.errors[0].description}`);

    const pixDataRes = await fetch(`${ASAAS_API_URL}/payments/${paymentData.id}/pixQrCode`, {
      headers: { access_token: asaasApiKey },
    });
    const pixData = await pixDataRes.json();

    await supabase
      .from('payments')
      .update({
        asaas_payment_id: paymentData.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentRecord.id);

    return NextResponse.json({
      paymentId: paymentRecord.id,
      checkoutUrl: paymentData.invoiceUrl || paymentData.bankSlipUrl || '',
      pixCopiaECola: pixData.payload,
      pixQrCode: pixData.encodedImage,
      asaasId: paymentData.id,
    });
  } catch (error: any) {
    console.error('[ASAAS Checkout] Erro:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
