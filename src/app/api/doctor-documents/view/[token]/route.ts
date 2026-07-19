import { NextResponse } from 'next/server';

const createSupabaseAdmin = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !serviceKey) {
    return {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      }),
      storage: {
        from: () => ({
          createSignedUrl: async () => ({ data: null, error: null }),
        }),
      },
    } as any;
  }

  const { createClient } = require('@supabase/supabase-js');
  return createClient(supabaseUrl, serviceKey);
};

const supabaseAdmin = createSupabaseAdmin();

const getStoragePathFromPublicUrl = (publicUrl: string) => {
  const marker = '/medical-documents/';
  const cleanUrl = publicUrl.split('?')[0];
  const markerIndex = cleanUrl.indexOf(marker);
  if (markerIndex === -1) return '';

  return decodeURIComponent(cleanUrl.slice(markerIndex + marker.length));
};

export async function GET(_req: Request, context: any) {
  try {
    const { token } = await context.params;

    if (!token) {
      return NextResponse.json({ error: 'Documento nao informado.' }, { status: 400 });
    }

    const { data: documentRecord, error: findError } = await supabaseAdmin
      .from('issued_documents')
      .select('document_url, status')
      .eq('validation_token', token)
      .maybeSingle();

    if (findError) {
      return NextResponse.json({ error: `Erro ao localizar documento: ${findError.message}` }, { status: 500 });
    }

    if (!documentRecord || documentRecord.status !== 'signed') {
      return NextResponse.json({ error: 'Documento nao encontrado.' }, { status: 404 });
    }

    const storagePath = getStoragePathFromPublicUrl(String(documentRecord.document_url || ''));
    if (!storagePath) {
      return NextResponse.json({ error: 'Arquivo do documento nao localizado.' }, { status: 404 });
    }

    const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
      .from('medical-documents')
      .createSignedUrl(storagePath, 60);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      return NextResponse.json({
        error: `Nao foi possivel abrir o documento: ${signedUrlError?.message || 'link indisponivel'}`,
      }, { status: 500 });
    }

    return NextResponse.redirect(signedUrlData.signedUrl);
  } catch (error: any) {
    console.error('Erro ao abrir documento medico:', error);
    return NextResponse.json({ error: error.message || 'Erro ao abrir documento.' }, { status: 500 });
  }
}
