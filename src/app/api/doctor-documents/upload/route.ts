import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, serviceKey);

const getFileType = (file: File) => {
  if (file.type) return file.type;

  const ext = file.name.split('.').pop()?.toLowerCase();
  if (['png', 'jpg', 'jpeg', 'webp', 'heic', 'heif'].includes(ext || '')) {
    return `image/${ext === 'jpg' ? 'jpeg' : ext}`;
  }
  if (ext === 'pdf') return 'application/pdf';

  return 'application/octet-stream';
};

const ensureMedicalDocumentsBucket = async () => {
  const { data } = await supabaseAdmin.storage.getBucket('medical-documents');
  if (data) return;

  const { error } = await supabaseAdmin.storage.createBucket('medical-documents', {
    public: true,
  });

  if (error && !error.message.toLowerCase().includes('already exists')) {
    throw new Error(`Erro ao preparar bucket medical-documents: ${error.message}`);
  }
};

const getUserFromRequest = async (req: Request) => {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');

  if (!token) {
    return { user: null, error: 'Sessao nao encontrada. Faca login novamente.' };
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    return { user: null, error: 'Sessao invalida. Faca login novamente.' };
  }

  return { user: data.user, error: null };
};

export async function POST(req: Request) {
  try {
    const { user, error: authError } = await getUserFromRequest(req);
    if (authError || !user) {
      return NextResponse.json({ error: authError }, { status: 401 });
    }

    const { data: doctorSetting, error: doctorError } = await supabaseAdmin
      .from('doctor_settings')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (doctorError) {
      return NextResponse.json({ error: `Erro ao validar medico: ${doctorError.message}` }, { status: 500 });
    }

    if (!doctorSetting) {
      return NextResponse.json({ error: 'Apenas medicos autorizados podem enviar documentos.' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file');
    const consultationId = String(formData.get('consultationId') || '');
    const patientId = String(formData.get('patientId') || '');
    const type = String(formData.get('type') || '');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Arquivo nao recebido.' }, { status: 400 });
    }

    if (!consultationId || !patientId) {
      return NextResponse.json({ error: 'Consulta ou paciente nao informado.' }, { status: 400 });
    }

    if (!['prescription', 'exam'].includes(type)) {
      return NextResponse.json({ error: 'Tipo de documento invalido.' }, { status: 400 });
    }

    if (file.size > 30 * 1024 * 1024) {
      return NextResponse.json({ error: 'O arquivo e muito grande. O limite maximo e de 30MB.' }, { status: 400 });
    }

    const fileType = getFileType(file);
    const isImage = fileType.startsWith('image/');
    const isPdf = fileType === 'application/pdf';

    if (!isImage && !isPdf) {
      return NextResponse.json({ error: 'Formato nao suportado. Envie PDF ou imagem.' }, { status: 400 });
    }

    const { data: consultation, error: consultationError } = await supabaseAdmin
      .from('consultations')
      .select('id, patient_id')
      .eq('id', consultationId)
      .eq('patient_id', patientId)
      .maybeSingle();

    if (consultationError) {
      return NextResponse.json({ error: `Erro ao validar consulta: ${consultationError.message}` }, { status: 500 });
    }

    if (!consultation) {
      return NextResponse.json({ error: 'Consulta nao encontrada para este paciente.' }, { status: 404 });
    }

    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const storagePath = `${patientId}/${consultationId}/${type}_${uniqueSuffix}.${fileExt}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    await ensureMedicalDocumentsBucket();

    const { error: uploadError } = await supabaseAdmin.storage
      .from('medical-documents')
      .upload(storagePath, buffer, {
        cacheControl: '3600',
        contentType: fileType,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: `Erro no Storage: ${uploadError.message}` }, { status: 500 });
    }

    const { data: urlData } = supabaseAdmin.storage
      .from('medical-documents')
      .getPublicUrl(storagePath);

    const { data: documentRecord, error: dbError } = await supabaseAdmin
      .from('issued_documents')
      .insert({
        consultation_id: consultationId,
        patient_id: patientId,
        type,
        document_url: urlData.publicUrl,
        status: 'signed',
        signed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (dbError) {
      await supabaseAdmin.storage.from('medical-documents').remove([storagePath]);
      return NextResponse.json({ error: `Erro ao registrar documento: ${dbError.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, document: documentRecord });
  } catch (error: any) {
    console.error('Erro ao enviar documento medico:', error);
    return NextResponse.json({ error: error.message || 'Erro ao enviar documento.' }, { status: 500 });
  }
}
