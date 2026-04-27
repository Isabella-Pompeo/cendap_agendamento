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

const getUserFromRequest = async (req: Request) => {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');

  if (!token) {
    return { user: null, error: 'Sessão não encontrada. Faça login novamente.' };
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    return { user: null, error: 'Sessão inválida. Faça login novamente.' };
  }

  return { user: data.user, error: null };
};

export async function GET(req: Request) {
  try {
    const { user, error: authError } = await getUserFromRequest(req);
    if (authError || !user) {
      return NextResponse.json({ error: authError }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from('patient_uploads')
      .select('*')
      .eq('patient_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: `Erro ao listar exames: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, exams: data || [] });
  } catch (error: any) {
    console.error('Erro ao listar exames:', error);
    return NextResponse.json({ error: error.message || 'Erro ao listar exames.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { user, error: authError } = await getUserFromRequest(req);
    if (authError || !user) {
      return NextResponse.json({ error: authError }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Arquivo não recebido.' }, { status: 400 });
    }

    if (file.size > 30 * 1024 * 1024) {
      return NextResponse.json({ error: 'O arquivo é muito grande. O limite máximo é de 30MB.' }, { status: 400 });
    }

    const fileType = getFileType(file);
    const isImage = fileType.startsWith('image/');
    const isPdf = fileType === 'application/pdf';

    if (!isImage && !isPdf) {
      return NextResponse.json({ error: 'Formato não suportado. Envie PDF ou imagem.' }, { status: 400 });
    }

    const userId = user.id;
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const storagePath = `${userId}/${uniqueSuffix}.${fileExt}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabaseAdmin.storage
      .from('patient-exams')
      .upload(storagePath, buffer, {
        cacheControl: '3600',
        contentType: fileType,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: `Erro no Storage: ${uploadError.message}` }, { status: 500 });
    }

    const { data: urlData } = supabaseAdmin.storage
      .from('patient-exams')
      .getPublicUrl(storagePath);

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('cpf')
      .eq('id', userId)
      .maybeSingle();

    const { data: uploadRecord, error: dbError } = await supabaseAdmin
      .from('patient_uploads')
      .insert({
        patient_id: userId,
        patient_cpf: profile?.cpf || '',
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_type: fileType,
      })
      .select()
      .single();

    if (dbError) {
      await supabaseAdmin.storage.from('patient-exams').remove([storagePath]);
      return NextResponse.json({ error: `Erro no histórico: ${dbError.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, upload: uploadRecord });
  } catch (error: any) {
    console.error('Erro ao enviar exame:', error);
    return NextResponse.json({ error: error.message || 'Erro ao enviar exame.' }, { status: 500 });
  }
}
