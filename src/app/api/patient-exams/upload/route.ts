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

const getStoragePathFromPublicUrl = (publicUrl: string) => {
  const marker = '/patient-exams/';
  const markerIndex = publicUrl.indexOf(marker);
  if (markerIndex === -1) return '';

  return decodeURIComponent(publicUrl.slice(markerIndex + marker.length));
};

const isMissingConsultationColumnError = (error: any) => {
  return String(error?.message || '').includes('patient_uploads.consultation_id');
};

const missingConsultationColumnMessage = 'O banco precisa ser atualizado para separar exames por consulta. Execute o SQL que adiciona consultation_id em patient_uploads.';

const getAppointmentDayRange = (appointmentDate: string) => {
  const date = new Date(appointmentDate);
  if (Number.isNaN(date.getTime())) return null;

  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
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

    const { searchParams } = new URL(req.url);
    const consultationId = searchParams.get('consultationId') || '';

    let query = supabaseAdmin
      .from('patient_uploads')
      .select('*')
      .eq('patient_id', user.id);

    if (consultationId) {
      query = query.eq('consultation_id', consultationId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      if (isMissingConsultationColumnError(error)) {
        return NextResponse.json({ error: missingConsultationColumnMessage }, { status: 500 });
      }

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
    const consultationRef = String(formData.get('consultationId') || '');
    const appointmentDate = String(formData.get('appointmentDate') || '');
    let consultationId = '';

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Arquivo não recebido.' }, { status: 400 });
    }

    if (consultationRef) {
      const { data: consultation, error: consultationError } = await supabaseAdmin
        .from('consultations')
        .select('id, patient_id')
        .eq('id', consultationRef)
        .eq('patient_id', user.id)
        .maybeSingle();

      if (consultationError) {
        return NextResponse.json({ error: `Erro ao validar consulta: ${consultationError.message}` }, { status: 500 });
      }

      consultationId = consultation?.id || '';
    }

    if (!consultationId && consultationRef) {
      const { data: consultationByPayment, error: paymentConsultationError } = await supabaseAdmin
        .from('consultations')
        .select('id, patient_id')
        .eq('payment_id', consultationRef)
        .eq('patient_id', user.id)
        .maybeSingle();

      if (paymentConsultationError) {
        return NextResponse.json({ error: `Erro ao validar consulta: ${paymentConsultationError.message}` }, { status: 500 });
      }

      consultationId = consultationByPayment?.id || '';
    }

    if (!consultationId && appointmentDate) {
      const dayRange = getAppointmentDayRange(appointmentDate);
      if (dayRange) {
        const { data: consultationByDate, error: dateConsultationError } = await supabaseAdmin
          .from('consultations')
          .select('id, patient_id, appointment_date')
          .eq('patient_id', user.id)
          .gte('appointment_date', dayRange.start)
          .lte('appointment_date', dayRange.end)
          .order('appointment_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (dateConsultationError) {
          return NextResponse.json({ error: `Erro ao validar consulta: ${dateConsultationError.message}` }, { status: 500 });
        }

        consultationId = consultationByDate?.id || '';
      }
    }

    if (consultationRef && !consultationId) {
      return NextResponse.json({ error: 'Nao encontramos essa consulta no seu login. Atualize a tela e tente anexar pelo card da telemedicina.' }, { status: 404 });
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
    const storagePath = consultationId
      ? `${userId}/${consultationId}/${uniqueSuffix}.${fileExt}`
      : `${userId}/${uniqueSuffix}.${fileExt}`;
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

    const uploadPayload: Record<string, any> = {
      patient_id: userId,
      patient_cpf: profile?.cpf || '',
      file_name: file.name,
      file_url: urlData.publicUrl,
      file_type: fileType,
    };

    if (consultationId) {
      uploadPayload.consultation_id = consultationId;
    }

    const { data: uploadRecord, error: dbError } = await supabaseAdmin
      .from('patient_uploads')
      .insert(uploadPayload)
      .select()
      .single();

    if (dbError) {
      await supabaseAdmin.storage.from('patient-exams').remove([storagePath]);
      if (isMissingConsultationColumnError(dbError)) {
        return NextResponse.json({ error: missingConsultationColumnMessage }, { status: 500 });
      }
      return NextResponse.json({ error: `Erro no histórico: ${dbError.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, upload: uploadRecord });
  } catch (error: any) {
    console.error('Erro ao enviar exame:', error);
    return NextResponse.json({ error: error.message || 'Erro ao enviar exame.' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { user, error: authError } = await getUserFromRequest(req);
    if (authError || !user) {
      return NextResponse.json({ error: authError }, { status: 401 });
    }

    const { examId } = await req.json();
    if (!examId) {
      return NextResponse.json({ error: 'Exame não informado.' }, { status: 400 });
    }

    const { data: exam, error: findError } = await supabaseAdmin
      .from('patient_uploads')
      .select('*')
      .eq('id', examId)
      .eq('patient_id', user.id)
      .maybeSingle();

    if (findError) {
      return NextResponse.json({ error: `Erro ao localizar exame: ${findError.message}` }, { status: 500 });
    }

    if (!exam) {
      return NextResponse.json({ error: 'Exame não encontrado.' }, { status: 404 });
    }

    const storagePath = getStoragePathFromPublicUrl(String(exam.file_url || ''));

    if (storagePath) {
      const { error: storageError } = await supabaseAdmin.storage
        .from('patient-exams')
        .remove([storagePath]);

      if (storageError) {
        return NextResponse.json({ error: `Erro ao remover arquivo: ${storageError.message}` }, { status: 500 });
      }
    }

    const { error: deleteError } = await supabaseAdmin
      .from('patient_uploads')
      .delete()
      .eq('id', examId)
      .eq('patient_id', user.id);

    if (deleteError) {
      return NextResponse.json({ error: `Erro ao excluir exame: ${deleteError.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, deletedId: examId });
  } catch (error: any) {
    console.error('Erro ao excluir exame:', error);
    return NextResponse.json({ error: error.message || 'Erro ao excluir exame.' }, { status: 500 });
  }
}
