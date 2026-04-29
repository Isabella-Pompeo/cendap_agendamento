'use client';

import { useRef, useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Camera, FileText, LogOut, User as UserIcon, Stethoscope, CalendarDays, CheckCircle, Phone, Fingerprint, Copy, RefreshCw, Paperclip, Image as ImageIcon, FileUp, Send } from 'lucide-react';

// Helpers de Formatação
const formatCPF = (cpf: string) => {
  if (!cpf) return '';
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
};

const formatPhone = (phone: string) => {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
};

const formatAppointmentDate = (dateStr?: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
};

const formatAppointmentTime = (dateStr?: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';

  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
};

export default function DoctorPanel() {
  const [consultations, setConsultations] = useState<any[]>([]);
  const [activeConsultation, setActiveConsultation] = useState<any | null>(null);
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [patientHistory, setPatientHistory] = useState<any[]>([]);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const { session, user, isLoading: isAuthContextLoading, onlineUsers } = useAuth();
  const [sidebarFilter, setSidebarFilter] = useState<'today' | 'future' | 'all'>('today');
  const [isCopyingLink, setIsCopyingLink] = useState(false);
  const [patientExams, setPatientExams] = useState<any[]>([]);
  const [issuedDocuments, setIssuedDocuments] = useState<any[]>([]);
  const [documentType, setDocumentType] = useState<'prescription' | 'exam'>('prescription');
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [documentUploadStatus, setDocumentUploadStatus] = useState('');
  const documentFileInputRef = useRef<HTMLInputElement | null>(null);

  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const getDocumentLabel = (type?: string) => {
    if (type === 'prescription') return 'Receita Medica';
    if (type === 'exam') return 'Pedido de Exame';
    return 'Documento';
  };

  useEffect(() => {
    let isMounted = true;
    const timeoutId = setTimeout(() => {
      if (isMounted && isAuthChecking) {
        console.warn('Tempo limite atingido na verificação de acesso médico.');
        setAuthError('A verificação está demorando mais que o esperado. Verifique sua conexão ou tente novamente.');
        setIsAuthChecking(false);
      }
    }, 15000); // 15 segundos de timeout

    const verifyAccess = async () => {
      if (isAuthContextLoading && !user) return;

      if (!user && !isAuthContextLoading) {
        clearTimeout(timeoutId);
        window.location.href = '/login';
        return;
      }

      try {
        setAuthError(null);

        // Adicionando um timeout manual para a query do Supabase caso ela trave
        const { data: doctorSetting, error: dbError } = await Promise.race([
          supabase.from('doctor_settings').select('*').eq('user_id', user.id).maybeSingle(),
          new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Timeout na consulta ao banco')), 12000))
        ]);

        if (!isMounted) return;

        if (dbError) {
          console.error('Erro ao consultar doctor_settings:', dbError);
          throw dbError;
        }

        if (!doctorSetting) {
          clearTimeout(timeoutId);
          alert('Acesso negado. Apenas médicos autorizados podem acessar este painel.');
          window.location.href = '/';
          return;
        }

        setIsAuthorized(true);
        setIsAuthChecking(false);
        clearTimeout(timeoutId);
        fetchConsultations();
      } catch (err: any) {
        if (!isMounted) return;
        setAuthError(`Erro na verificação: ${err.message || 'Erro desconhecido'}`);
        setIsAuthChecking(false);
        clearTimeout(timeoutId);
      }
    };

    verifyAccess();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [user, isAuthContextLoading]);

  const fetchPatientExams = async (patientId: string, patientCpf?: string, consultationId?: string) => {
    let query = supabase
      .from('patient_uploads')
      .select('*');

    if (consultationId) {
      query = query.eq('consultation_id', consultationId);
    } else if (patientCpf) {
      query = query.or(`patient_id.eq.${patientId},patient_cpf.eq.${patientCpf}`);
    } else {
      query = query.eq('patient_id', patientId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (!error && data) {
      setPatientExams(data);
    }
  };

  const fetchIssuedDocuments = async (consultationId: string) => {
    const { data, error } = await supabase
      .from('issued_documents')
      .select('*')
      .eq('consultation_id', consultationId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setIssuedDocuments(data);
    }
  };

  useEffect(() => {
    if (activeConsultation?.patient_id) {
      const cpf = activeConsultation.profiles?.cpf;
      fetchPatientExams(activeConsultation.patient_id, cpf, activeConsultation.id);
      fetchIssuedDocuments(activeConsultation.id);

      const channel = supabase
        .channel(`patient-exams-${activeConsultation.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'patient_uploads',
            filter: `consultation_id=eq.${activeConsultation.id}`
          },
          (payload: any) => {
            if (payload.eventType === 'INSERT') {
              setPatientExams(prev => {
                  if (prev.some(e => e.id === payload.new.id)) return prev;
                  return [payload.new, ...prev];
              });
            } else if (payload.eventType === 'DELETE') {
              setPatientExams(prev => prev.filter(e => e.id !== payload.old.id));
            }
          }
        )
        .subscribe();

      const documentsChannel = supabase
        .channel(`doctor-documents-${activeConsultation.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'issued_documents',
            filter: `consultation_id=eq.${activeConsultation.id}`
          },
          (payload: any) => {
            if (payload.eventType === 'INSERT') {
              setIssuedDocuments(prev => {
                if (prev.some(doc => doc.id === payload.new.id)) return prev;
                return [payload.new, ...prev];
              });
            } else if (payload.eventType === 'UPDATE') {
              setIssuedDocuments(prev => prev.map(doc => doc.id === payload.new.id ? payload.new : doc));
            } else if (payload.eventType === 'DELETE') {
              setIssuedDocuments(prev => prev.filter(doc => doc.id !== payload.old.id));
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
        supabase.removeChannel(documentsChannel);
      };
    } else {
      setPatientExams([]);
      setIssuedDocuments([]);
    }
  }, [activeConsultation]);

  const fetchConsultations = async (filter: 'today' | 'future' | 'all' = sidebarFilter) => {
    try {
      setIsRefreshing(true);
      let query = supabase
        .from('consultations')
        .select(`
          *,
          profiles ( full_name, cpf, phone, avatar_url ),
          payments ( status )
        `);

      const now = new Date();
      const todayStr = now.toLocaleDateString('en-CA');

      if (filter === 'today') {
        query = query
          .gte('appointment_date', `${todayStr}T00:00:00`)
          .lte('appointment_date', `${todayStr}T23:59:59`);
      } else if (filter === 'future') {
        query = query
          .gt('appointment_date', `${todayStr}T23:59:59`)
          .neq('status', 'completed');
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (!error && data) {
        setConsultations(data);
        if (activeConsultation) {
          const currentActive = data.find(c => c.id === activeConsultation.id);
          if (currentActive) {
            fetchPatientExams(currentActive.patient_id, currentActive.profiles?.cpf, currentActive.id);
          }
        }
      }
    } catch (err) {
      console.error('Erro ao buscar consultas:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleStartConsultation = async (cons: any) => {
    setActiveConsultation(cons);
    setClinicalNotes(cons.clinical_notes || '');
    setRoomUrl(null); // Reseta a sala ao trocar de paciente
    fetchPatientHistory(cons.patient_id, cons.id);
  };

  const handleJoinRoom = async () => {
    if (!activeConsultation) return;

    setIsJoiningRoom(true);
    // Gerar token de médico para a sala já existente
    try {
        const res = await fetch('/api/telemedicine/room', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                appointmentId: activeConsultation.id,
                patientId: activeConsultation.patient_id,
                doctorName: activeConsultation.doctor_name,
                appointmentDate: activeConsultation.appointment_date,
                isDoctor: true
            })
        });
        const data = await res.json();
        if (data.success) {
            setRoomUrl(`${data.url}?t=${data.token}`);
        } else {
            alert('Erro ao entrar na sala: ' + data.error);
        }
    } catch(e) {
        console.error(e);
        alert('Erro ao conectar com servidor.');
    } finally {
        setIsJoiningRoom(false);
    }
  };

  const handleCopyPatientLink = async () => {
    if (!activeConsultation) return;

    setIsCopyingLink(true);
    try {
        const res = await fetch('/api/telemedicine/room', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                appointmentId: activeConsultation.id,
                patientId: activeConsultation.patient_id,
                doctorName: activeConsultation.doctor_name,
                appointmentDate: activeConsultation.appointment_date,
                isDoctor: false, // Token de paciente
                shouldUpdateStatus: false
            })
        });
        const data = await res.json();
        if (data.success) {
            const link = `${data.url}?t=${data.token}`;
            await navigator.clipboard.writeText(link);
            alert('Link copiado com sucesso! Você pode enviar para o paciente.');
        }
    } catch(e) {
        alert('Erro ao gerar link.');
    } finally {
        setIsCopyingLink(false);
    }
  };

  const fetchPatientHistory = async (patientId: string, currentConsId: string) => {
    setIsLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('consultations')
        .select('*')
        .eq('patient_id', patientId)
        .neq('id', currentConsId)
        .not('clinical_notes', 'is', null)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setPatientHistory(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const saveClinicalNotes = async () => {
    if (!activeConsultation) return;
    setIsSavingNotes(true);
    try {
        const { data, error } = await supabase
            .from('consultations')
            .update({ clinical_notes: clinicalNotes })
            .eq('id', activeConsultation.id)
            .select()
            .single();

        if (error) throw error;

        // Atualiza a lista local
        setActiveConsultation(data);
        setConsultations(prev => prev.map(c => c.id === activeConsultation.id ? { ...c, ...data } : c));
        alert('Evolução clínica salva com sucesso!');
    } catch (e) {
        console.error(e);
        alert('Erro ao salvar prontuário.');
    } finally {
        setIsSavingNotes(false);
    }
  };

  const getDoctorDocumentFileType = (file: File) => {
    if (file.type) return file.type;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (['png', 'jpg', 'jpeg', 'webp', 'heic', 'heif'].includes(ext || '')) {
      return `image/${ext === 'jpg' ? 'jpeg' : ext}`;
    }
    if (ext === 'pdf') return 'application/pdf';

    return '';
  };

  const handleUploadDoctorDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConsultation) return;

    if (!session?.access_token) {
      alert('Sua sessao expirou. Faca login novamente para enviar o documento.');
      if (documentFileInputRef.current) documentFileInputRef.current.value = '';
      return;
    }

    if (file.size > 30 * 1024 * 1024) {
      alert('O arquivo e muito grande. O limite maximo e de 30MB.');
      if (documentFileInputRef.current) documentFileInputRef.current.value = '';
      return;
    }

    const fileType = getDoctorDocumentFileType(file);
    if (!fileType.startsWith('image/') && fileType !== 'application/pdf') {
      alert('Formato nao suportado. Envie PDF ou imagem.');
      if (documentFileInputRef.current) documentFileInputRef.current.value = '';
      return;
    }

    setIsUploadingDocument(true);
    setDocumentUploadStatus('Enviando documento...');

    try {
      const formData = new FormData();
      formData.append('file', file, file.name);
      formData.append('consultationId', activeConsultation.id);
      formData.append('patientId', activeConsultation.patient_id);
      formData.append('type', documentType);

      const response = await fetch('/api/doctor-documents/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`
        },
        body: formData
      });
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Nao foi possivel enviar o documento.');
      }

      if (result.document) {
        setIssuedDocuments(prev => {
          if (prev.some(doc => doc.id === result.document.id)) return prev;
          return [result.document, ...prev];
        });
      }

      setDocumentUploadStatus('Documento enviado para o paciente.');
      setTimeout(() => setDocumentUploadStatus(''), 2500);
    } catch (error: any) {
      console.error('Erro ao enviar documento:', error);
      setDocumentUploadStatus('');
      alert('Erro ao enviar documento: ' + (error.message || 'Erro desconhecido.'));
    } finally {
      setIsUploadingDocument(false);
      if (documentFileInputRef.current) documentFileInputRef.current.value = '';
    }
  };

  const handleFinishConsultation = async () => {
    if (!activeConsultation) return;

    if (!confirm('Deseja realmente finalizar este atendimento? Esta ação mudará o status para Realizado.')) return;

    try {
      const { error } = await supabase
        .from('consultations')
        .update({ status: 'completed' })
        .eq('id', activeConsultation.id);

      if (error) throw error;

      // Atualiza a lista local. Em "Futuros", consulta realizada deve sair da fila.
      setConsultations(prev => {
        const updated = prev.map(c => c.id === activeConsultation.id ? { ...c, status: 'completed' } : c);
        return sidebarFilter === 'future' ? updated.filter(c => c.id !== activeConsultation.id) : updated;
      });
      setActiveConsultation(null);
      setRoomUrl(null);
      alert('Atendimento finalizado com sucesso!');
    } catch (e) {
      console.error(e);
      alert('Erro ao finalizar atendimento.');
    }
  };

  if (!authError && (isAuthChecking || (isAuthContextLoading && !user))) {
    return (
      <div style={{ display: 'flex', height: '100vh', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', color: '#64748b', gap: '20px', padding: '20px', textAlign: 'center' }}>
        <div style={{ width: '45px', height: '45px', border: '3px solid #e2e8f0', borderTop: '3px solid #cb1e28', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '1.1rem' }}>Verificando credenciais médicas...</span>
          <span style={{ fontSize: '0.9rem', color: '#64748b' }}>Aguarde enquanto validamos seu acesso ao painel.</span>
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div style={{ display: 'flex', height: '100vh', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', padding: '20px', textAlign: 'center' }}>
        <div style={{ width: '64px', height: '64px', backgroundColor: '#fee2e2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
          <Stethoscope size={32} color="#ef4444" />
        </div>
        <h2 style={{ color: '#0f172a', margin: '0 0 10px 0' }}>Problema na Verificação</h2>
        <p style={{ color: '#64748b', maxWidth: '400px', margin: '0 0 24px 0', lineHeight: '1.5' }}>
          {authError}
        </p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: '12px 24px', backgroundColor: '#cb1e28', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
          >
            Tentar Novamente
          </button>
          <button
            onClick={() => window.location.href = '/'}
            style={{ padding: '12px 24px', backgroundColor: 'white', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
          >
            Voltar ao Início
          </button>
        </div>
      </div>
    );
  }


  if (!isAuthorized) return null;

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>

      {/* Sidebar - Lista de Pacientes */}
      <div style={{ width: '320px', backgroundColor: 'white', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px', backgroundColor: 'white', borderBottom: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', position: 'relative' }}>
          <button
            onClick={() => fetchConsultations(sidebarFilter)}
            disabled={isRefreshing}
            title="Atualizar lista"
            style={{
              position: 'absolute',
              right: '12px',
              top: '12px',
              background: 'none',
              border: 'none',
              color: isRefreshing ? '#cb1e28' : '#94a3b8',
              cursor: isRefreshing ? 'not-allowed' : 'pointer',
              padding: '8px',
              borderRadius: '8px',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              animation: isRefreshing ? 'spin 1s linear infinite' : 'none'
            }}
          >
            <RefreshCw size={18} />
          </button>
          <img src="/logo-cendap.png" alt="CENDAP Logo" style={{ height: '40px', marginBottom: '12px', objectFit: 'contain' }} />
          <h2 style={{ margin: 0, fontSize: '1rem', color: '#0f172a', fontWeight: 700 }}>
             Painel Médico
          </h2>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#cb1e28', fontWeight: 600 }}>Dr. André - CENDAP</p>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0' }}>
          <button
            onClick={() => { setSidebarFilter('today'); fetchConsultations('today'); }}
            style={{
              flex: 1,
              padding: '12px',
              backgroundColor: sidebarFilter === 'today' ? 'white' : '#f8fafc',
              border: 'none',
              borderBottom: sidebarFilter === 'today' ? '2px solid #cb1e28' : 'none',
              color: sidebarFilter === 'today' ? '#cb1e28' : '#64748b',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontSize: '0.85rem'
            }}
          >
            <CalendarDays size={16} /> Hoje
          </button>
          <button
            onClick={() => { setSidebarFilter('future'); fetchConsultations('future'); }}
            style={{
              flex: 1,
              padding: '12px',
              backgroundColor: sidebarFilter === 'future' ? 'white' : '#f8fafc',
              border: 'none',
              borderBottom: sidebarFilter === 'future' ? '2px solid #cb1e28' : 'none',
              color: sidebarFilter === 'future' ? '#cb1e28' : '#64748b',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontSize: '0.85rem'
            }}
          >
            <CalendarDays size={16} /> Futuros
          </button>
          <button
            onClick={() => { setSidebarFilter('all'); fetchConsultations('all'); }}
            style={{
              flex: 1,
              padding: '12px',
              backgroundColor: sidebarFilter === 'all' ? 'white' : '#f8fafc',
              border: 'none',
              borderBottom: sidebarFilter === 'all' ? '2px solid #cb1e28' : 'none',
              color: sidebarFilter === 'all' ? '#cb1e28' : '#64748b',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontSize: '0.85rem'
            }}
          >
            <Stethoscope size={16} /> Todas
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {consultations.length === 0 ? (
            <p style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>Nenhuma consulta encontrada.</p>
          ) : (
            consultations.map(cons => (
              <div
                key={cons.id}
                onClick={() => handleStartConsultation(cons)}
                style={{
                  padding: '16px',
                  borderBottom: '1px solid #f1f5f9',
                  cursor: 'pointer',
                  backgroundColor: activeConsultation?.id === cons.id ? '#fef2f2' : 'white',
                  borderLeft: activeConsultation?.id === cons.id ? '4px solid #cb1e28' : '4px solid transparent',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ position: 'relative' }}>
                    <div style={{
                      width: '50px',
                      height: '50px',
                      borderRadius: '12px',
                      backgroundColor: activeConsultation?.id === cons.id ? '#fee2e2' : '#f1f5f9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: activeConsultation?.id === cons.id ? '#cb1e28' : '#64748b',
                      overflow: 'hidden',
                      border: activeConsultation?.id === cons.id ? '2px solid #cb1e28' : '2px solid transparent',
                      transition: 'all 0.2s'
                    }}>
                      {cons.profiles?.avatar_url ? (
                        <img src={cons.profiles.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <UserIcon size={24} />
                      )}
                    </div>
                    {/* Indicador de Status */}
                    <div style={{
                      position: 'absolute',
                      bottom: '-2px',
                      right: '-2px',
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      border: '2px solid white',
                      backgroundColor: cons.status === 'completed' ? '#10b981' : cons.status === 'in_progress' ? '#3b82f6' : '#94a3b8'
                    }}></div>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h4 style={{
                        margin: 0,
                        color: '#0f172a',
                        fontSize: '0.95rem',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {cons.profiles?.full_name || 'Paciente sem nome'}
                      </h4>
                      <span style={{ flexShrink: 0, textAlign: 'right', fontSize: '0.75rem', color: '#cb1e28', fontWeight: 700, lineHeight: 1.25 }}>
                        {(() => {
                          if (!cons.appointment_date) return '';
                          try {
                            // Converte para objeto Date e formata forçando o fuso de Brasília
                            return (
                              <>
                                <span style={{ display: 'block' }}>{formatAppointmentDate(cons.appointment_date)}</span>
                                <span style={{ display: 'block' }}>{formatAppointmentTime(cons.appointment_date)}</span>
                              </>
                            );
                          } catch (e) {
                            return '';
                          }
                        })()}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                      <p style={{ margin: 0, color: '#64748b', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Fingerprint size={12} /> {formatCPF(cons.profiles?.cpf)}
                      </p>
                      <p style={{ margin: 0, color: '#64748b', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Phone size={12} /> {formatPhone(cons.profiles?.phone)}
                      </p>
                    </div>

                    <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '0.7rem',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        backgroundColor: cons.status === 'completed' ? '#ecfdf5' : cons.status === 'in_progress' ? '#eff6ff' : '#f1f5f9',
                        color: cons.status === 'completed' ? '#059669' : cons.status === 'in_progress' ? '#2563eb' : '#475569',
                        fontWeight: 600,
                        textTransform: 'uppercase'
                      }}>
                        {cons.status === 'completed' ? 'Realizado' : cons.status === 'in_progress' ? 'Em Atendimento' : 'Aguardando'}
                      </span>

                      {/* Indicador de Online */}
                      {onlineUsers.has(cons.patient_id) && (
                        <span style={{
                          fontSize: '0.7rem',
                          padding: '2px 8px',
                          borderRadius: '10px',
                          backgroundColor: '#dcfce7',
                          color: '#16a34a',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          boxShadow: '0 0 8px rgba(22, 163, 74, 0.2)'
                        }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#16a34a' }}></span>
                          PACIENTE ONLINE
                        </span>
                      )}

                      {/* Badge de Pagamento - Apenas para agendados */}
                      {cons.status === 'scheduled' && (
                        <span style={{
                          fontSize: '0.7rem',
                          padding: '2px 8px',
                          borderRadius: '10px',
                          backgroundColor: cons.payments?.status === 'approved' ? '#f0fdf4' : '#fff7ed',
                          color: cons.payments?.status === 'approved' ? '#16a34a' : '#ea580c',
                          border: cons.payments?.status === 'approved' ? '1px solid #bbf7d0' : '1px solid #fed7aa',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}>
                          {cons.payments?.status === 'approved' ? '✓ Pago' : '! Pendente'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!activeConsultation ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#94a3b8' }}>
            <Camera size={64} style={{ opacity: 0.2, marginBottom: '16px' }} />
            <h3 style={{ margin: 0, color: '#475569' }}>Selecione um paciente</h3>
            <p>Clique em um paciente na lista ao lado para iniciar o atendimento.</p>
          </div>
        ) : (
          <>
            {/* Header da Consulta */}
            <div style={{ padding: '16px 24px', backgroundColor: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                  {activeConsultation.profiles?.avatar_url ? (
                    <img src={activeConsultation.profiles.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                      <UserIcon size={24} />
                    </div>
                  )}
                </div>
                <div>
                  <h2 style={{ margin: 0, color: '#0f172a', fontSize: '1.25rem', fontWeight: 700 }}>{activeConsultation.profiles?.full_name}</h2>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                    <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Fingerprint size={14} /> {formatCPF(activeConsultation.profiles?.cpf)}
                    </p>
                    <a
                      href={`https://wa.me/55${activeConsultation.profiles?.phone?.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ margin: 0, color: '#2563eb', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none', fontWeight: 600 }}
                    >
                      <Phone size={14} /> {formatPhone(activeConsultation.profiles?.phone)}
                    </a>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={handleFinishConsultation}
                  style={{ padding: '8px 16px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <CheckCircle size={18} /> Finalizar Atendimento
                </button>
              </div>
            </div>

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              {/* Área de Vídeo */}
              <div style={{ flex: 2, borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', backgroundImage: 'url(/clinic-real.jpg)', backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative', overflow: 'hidden' }}>
                {roomUrl ? (
                  <iframe
                    src={roomUrl}
                    allow="camera; microphone; fullscreen; display-capture"
                    style={{ width: '100%', height: '100%', border: 'none', position: 'relative', zIndex: 2 }}
                  />
                ) : (
                  <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#0f172a',
                    gap: '24px',
                    padding: '40px',
                    textAlign: 'center',
                    backgroundColor: 'rgba(255, 255, 255, 0.75)',
                    backdropFilter: 'blur(12px)',
                    zIndex: 1
                  }}>
                    <div style={{
                        width: '100px',
                        height: '100px',
                        borderRadius: '32px',
                        backgroundColor: 'white',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '10px',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.08)'
                    }}>
                        <Camera size={48} style={{ color: '#cb1e28' }} />
                    </div>
                    <div style={{ zIndex: 2 }}>
                        <h3 style={{ margin: '0 0 12px 0', fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>Pronto para iniciar?</h3>
                        <p style={{ margin: 0, color: '#475569', fontSize: '1rem', maxWidth: '380px', lineHeight: '1.6', fontWeight: 500 }}>
                            Conecte-se com seu paciente agora. A sala de vídeo segura está preparada para a sua consulta.
                        </p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '380px' }}>
                        <button
                            onClick={handleJoinRoom}
                            disabled={isJoiningRoom}
                            style={{
                                padding: '16px 32px',
                                backgroundColor: '#cb1e28',
                                color: 'white',
                                border: 'none',
                                borderRadius: '16px',
                                fontSize: '1rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '12px',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                boxShadow: '0 8px 25px rgba(203, 30, 40, 0.25)',
                                zIndex: 2,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                width: '100%'
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 12px 30px rgba(203, 30, 40, 0.35)';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 8px 25px rgba(203, 30, 40, 0.25)';
                            }}
                        >
                            {isJoiningRoom ? 'Conectando...' : <><Camera size={22} /> INICIAR ATENDIMENTO AGORA</>}
                        </button>

                        <button
                            onClick={handleCopyPatientLink}
                            disabled={isCopyingLink}
                            style={{
                                padding: '12px 24px',
                                backgroundColor: 'white',
                                color: '#475569',
                                border: '1px solid #e2e8f0',
                                borderRadius: '12px',
                                fontSize: '0.9rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                transition: 'all 0.2s',
                                width: '100%'
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.backgroundColor = '#f8fafc';
                                e.currentTarget.style.borderColor = '#cbd5e1';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.backgroundColor = 'white';
                                e.currentTarget.style.borderColor = '#e2e8f0';
                            }}
                        >
                            {isCopyingLink ? 'Gerando link...' : <><Copy size={18} /> Copiar Link p/ Paciente</>}
                        </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Área de Prontuário */}
              <div style={{ flex: 1, backgroundColor: 'white', display: 'flex', flexDirection: 'column', minWidth: '400px' }}>
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: '#0f172a', fontWeight: 700 }}>Nova Evolução Clínica</h3>
                      <textarea
                        value={clinicalNotes}
                        onChange={(e) => setClinicalNotes(e.target.value)}
                        placeholder="Descreva aqui o histórico, sintomas e conduta da consulta..."
                        style={{ width: '100%', minHeight: '200px', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box', lineHeight: '1.5', fontSize: '0.95rem' }}
                      />
                      <button
                        onClick={saveClinicalNotes}
                        disabled={isSavingNotes}
                        style={{ marginTop: '12px', padding: '12px', backgroundColor: '#cb1e28', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                      >
                        {isSavingNotes ? 'Salvando...' : <><CheckCircle size={18} /> Salvar Evolução</>}
                      </button>
                    </div>

                    {activeConsultation?.clinical_notes && (
                      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
                        <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: '#0f172a', fontWeight: 700 }}>Evolução deste atendimento</h3>
                        <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>
                              {new Date(activeConsultation.appointment_date).toLocaleDateString('pt-BR')}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Atendimento atual</span>
                          </div>
                          <p style={{ margin: 0, fontSize: '0.9rem', color: '#334155', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                            {activeConsultation.clinical_notes}
                          </p>
                        </div>
                      </div>
                    )}

                    <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <h3 style={{ margin: 0, fontSize: '1rem', color: '#0f172a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Paperclip size={18} style={{ color: '#db2777' }} /> Exames Enviados pelo Paciente
                          </h3>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <button
                                  onClick={() => fetchPatientExams(activeConsultation.patient_id, activeConsultation.profiles?.cpf, activeConsultation.id)}
                                  style={{
                                      background: 'none',
                                      border: 'none',
                                      color: '#64748b',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      padding: '4px'
                                  }}
                                  title="Atualizar exames"
                              >
                                  <RefreshCw size={14} />
                              </button>
                              {patientExams.length > 0 && (
                                  <span style={{ fontSize: '0.75rem', color: '#db2777', fontWeight: 700, backgroundColor: '#fdf2f8', padding: '2px 8px', borderRadius: '10px' }}>
                                      {patientExams.length} arquivo(s)
                                  </span>
                              )}
                          </div>
                      </div>

                      {patientExams.length === 0 ? (
                        <p style={{ fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic' }}>Nenhum exame enviado para esta consulta.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {patientExams.map(exam => (
                            <div key={exam.id} style={{
                                padding: '10px 14px',
                                backgroundColor: 'white',
                                borderRadius: '10px',
                                border: '1px solid #e2e8f0',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                transition: 'all 0.2s'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                                <div style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '8px',
                                    backgroundColor: exam.file_type?.includes('pdf') ? '#fee2e2' : '#ecfdf5',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: exam.file_type?.includes('pdf') ? '#ef4444' : '#10b981'
                                }}>
                                  {exam.file_type?.includes('pdf') ? <FileText size={16} /> : <ImageIcon size={16} />}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <p style={{
                                      margin: 0,
                                      fontSize: '0.85rem',
                                      fontWeight: 600,
                                      color: '#1e293b',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis'
                                  }}>
                                      {exam.file_name}
                                  </p>
                                  <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8' }}>
                                      {new Date(exam.created_at).toLocaleDateString('pt-BR')}
                                  </p>
                                </div>
                              </div>
                              <a
                                  href={exam.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                      padding: '6px 12px',
                                      backgroundColor: '#f8fafc',
                                      color: '#475569',
                                      fontSize: '0.75rem',
                                      fontWeight: 700,
                                      textDecoration: 'none',
                                      borderRadius: '6px',
                                      border: '1px solid #e2e8f0'
                                  }}
                              >
                                  Abrir
                              </a>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
                        <h3 style={{ margin: 0, fontSize: '1rem', color: '#0f172a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <FileUp size={18} style={{ color: '#0f766e' }} /> Enviar Receitas e Exames
                        </h3>
                        {issuedDocuments.length > 0 && (
                          <span style={{ fontSize: '0.75rem', color: '#0f766e', fontWeight: 700, backgroundColor: '#ccfbf1', padding: '2px 8px', borderRadius: '10px' }}>
                            {issuedDocuments.length} enviado(s)
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 1fr) minmax(180px, 1.4fr)', gap: '10px', alignItems: 'center' }}>
                        <select
                          value={documentType}
                          onChange={(e) => setDocumentType(e.target.value as 'prescription' | 'exam')}
                          disabled={isUploadingDocument}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            border: '1px solid #cbd5e1',
                            borderRadius: '8px',
                            backgroundColor: 'white',
                            color: '#0f172a',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            cursor: isUploadingDocument ? 'not-allowed' : 'pointer'
                          }}
                        >
                          <option value="prescription">Receita Medica</option>
                          <option value="exam">Pedido de Exame</option>
                        </select>
                        <button
                          onClick={() => documentFileInputRef.current?.click()}
                          disabled={isUploadingDocument}
                          style={{
                            width: '100%',
                            padding: '11px 14px',
                            backgroundColor: isUploadingDocument ? '#94a3b8' : '#0f766e',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: isUploadingDocument ? 'not-allowed' : 'pointer',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                          }}
                        >
                          {isUploadingDocument ? 'Enviando...' : <><Send size={16} /> Enviar ao Paciente</>}
                        </button>
                        <input
                          ref={documentFileInputRef}
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.heif,image/*,application/pdf"
                          onChange={handleUploadDoctorDocument}
                          disabled={isUploadingDocument}
                          style={{ display: 'none' }}
                        />
                      </div>

                      {documentUploadStatus && (
                        <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: '#0f766e', fontWeight: 600 }}>
                          {documentUploadStatus}
                        </p>
                      )}

                      {issuedDocuments.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                          {issuedDocuments.map(doc => (
                            <div key={doc.id} style={{
                              padding: '10px 14px',
                              backgroundColor: 'white',
                              borderRadius: '10px',
                              border: '1px solid #e2e8f0',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: '10px'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                                <div style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '8px',
                                  backgroundColor: doc.type === 'prescription' ? '#eef2ff' : '#ecfeff',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: doc.type === 'prescription' ? '#4f46e5' : '#0891b2'
                                }}>
                                  <FileText size={16} />
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>
                                    {getDocumentLabel(doc.type)}
                                  </p>
                                  <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8' }}>
                                    {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                                  </p>
                                </div>
                              </div>
                              {doc.document_url && (
                                <a
                                  href={doc.document_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    padding: '6px 12px',
                                    backgroundColor: '#f8fafc',
                                    color: '#475569',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    textDecoration: 'none',
                                    borderRadius: '6px',
                                    border: '1px solid #e2e8f0',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  Abrir
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
                      <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: '#0f172a', fontWeight: 700 }}>Histórico do Paciente</h3>
                      {isLoadingHistory ? (
                        <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Carregando histórico...</p>
                      ) : patientHistory.length === 0 ? (
                        <p style={{ fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic' }}>Nenhum atendimento anterior registrado.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {patientHistory.map(h => (
                            <div key={h.id} style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>
                                  {new Date(h.appointment_date).toLocaleDateString('pt-BR')}
                                </span>
                                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Dr. André</span>
                              </div>
                              <p style={{ margin: 0, fontSize: '0.9rem', color: '#334155', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                                {h.clinical_notes}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
