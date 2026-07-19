import { NextResponse } from 'next/server';

const createSupabaseAdmin = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !serviceKey) {
    return {
      auth: { getUser: async () => ({ data: { user: null }, error: null }) },
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
        insert: async () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) }),
        delete: () => ({ eq: async () => ({ error: null }) }),
      }),
      storage: {
        getBucket: async () => ({ data: null }),
        createBucket: async () => ({ error: null }),
        from: () => ({
          upload: async () => ({ error: null }),
          getPublicUrl: () => ({ data: { publicUrl: '' } }),
          remove: async () => ({ error: null }),
        }),
      },
    } as any;
  }

  const { createClient } = require('@supabase/supabase-js');
  return createClient(supabaseUrl, serviceKey);
};

const supabaseAdmin = createSupabaseAdmin();

const getFileType = (file: File) => {
  if (file.type) return file.type;

  const ext = file.name.split('.').pop()?.toLowerCase();
  if (['png', 'jpg', 'jpeg', 'webp', 'heic', 'heif'].includes(ext || '')) {
    return `image/${ext === 'jpg' ? 'jpeg' : ext}`;
  }
  if (ext === 'pdf') return 'application/pdf';

  return 'application/octet-stream';
};

const getStoragePathFromPublicUrl = (publicUrl: string) => {
  const marker = '/medical-documents/';
  const cleanUrl = publicUrl.split('?')[0];
  const markerIndex = cleanUrl.indexOf(marker);
  if (markerIndex === -1) return '';

  return decodeURIComponent(cleanUrl.slice(markerIndex + marker.length));
};

const validateDoctor = async (userId: string) => {
  const { data: doctorSetting, error: doctorError } = await supabaseAdmin
    .from('doctor_settings')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (doctorError) {
    throw new Error(`Erro ao validar medico: ${doctorError.message}`);
  }

  return Boolean(doctorSetting);
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

    const isDoctor = await validateDoctor(user.id);
    if (!isDoctor) {
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

export async function DELETE(req: Request) {
  try {
    const { user, error: authError } = await getUserFromRequest(req);
    if (authError || !user) {
      return NextResponse.json({ error: authError }, { status: 401 });
    }

    const isDoctor = await validateDoctor(user.id);
    if (!isDoctor) {
      return NextResponse.json({ error: 'Apenas medicos autorizados podem excluir documentos.' }, { status: 403 });
    }

    const { documentId } = await req.json();
    if (!documentId) {
      return NextResponse.json({ error: 'Documento nao informado.' }, { status: 400 });
    }

    const { data: documentRecord, error: findError } = await supabaseAdmin
      .from('issued_documents')
      .select('id, document_url')
      .eq('id', documentId)
      .maybeSingle();

    if (findError) {
      return NextResponse.json({ error: `Erro ao localizar documento: ${findError.message}` }, { status: 500 });
    }

    if (!documentRecord) {
      return NextResponse.json({ error: 'Documento nao encontrado.' }, { status: 404 });
    }

    const storagePath = getStoragePathFromPublicUrl(String(documentRecord.document_url || ''));
    if (storagePath) {
      await supabaseAdmin.storage.from('medical-documents').remove([storagePath]);
    }

    const { error: deleteError } = await supabaseAdmin
      .from('issued_documents')
      .delete()
      .eq('id', documentId);

    if (deleteError) {
      return NextResponse.json({ error: `Erro ao excluir documento: ${deleteError.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, deletedId: documentId });
  } catch (error: any) {
    console.error('Erro ao excluir documento medico:', error);
    return NextResponse.json({ error: error.message || 'Erro ao excluir documento.' }, { status: 500 });
  }
}
