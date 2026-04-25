'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import jsPDF from 'jspdf';
import { Camera, FileText, Download, Upload, LogOut, User as UserIcon, Stethoscope, CalendarDays, CheckCircle, Phone, Fingerprint, Copy, RefreshCw } from 'lucide-react';

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

export default function DoctorPanel() {
  const [consultations, setConsultations] = useState<any[]>([]);
  const [activeConsultation, setActiveConsultation] = useState<any | null>(null);
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [docType, setDocType] = useState<'prescription' | 'exam'>('prescription');
  const [docContent, setDocContent] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [activeTab, setActiveTab] = useState<'notes' | 'documents'>('notes');
  const [patientHistory, setPatientHistory] = useState<any[]>([]);
  const [formFields, setFormFields] = useState<Record<string, any>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const { user, isLoading: isAuthContextLoading, onlineUsers } = useAuth();
  const [currentConsultationDocs, setCurrentConsultationDocs] = useState<any[]>([]);
  const [sidebarFilter, setSidebarFilter] = useState<'today' | 'future' | 'all'>('today');
  const [isCopyingLink, setIsCopyingLink] = useState(false);
  
  const DOCUMENT_MODELS: Record<'prescription' | 'exam', { id: string; title: string; content: string }[]> = {
    prescription: [
      { id: 'default', title: 'Receita Padrão', content: 'USO INTERNO:\n\n1. [Medicamento 1] ---------------- [Dose 1]\nTomar: [Posologia 1]\n\n2. [Medicamento 2] ---------------- [Dose 2]\nTomar: [Posologia 2]\n\n3. [Medicamento 3] ---------------- [Dose 3]\nTomar: [Posologia 3]' },
      { id: 'injetavel', title: 'Receita com Injetável', content: 'USO ORAL:\n\n1. [Medicamento Oral] ---------------- [Dose Oral]\nTomar: [Posologia Oral]\n\nUSO INJETÁVEL:\n\n1. [Medicamento Injetável] ---------------- [Dose Injetável]\nAplicar: [Posologia Injetável]' }
    ],
    exam: [
      {
        id: 'ficha2025', 
        title: 'Ficha Modelo 2025 (Laboratório)', 
        content: `SOLICITAÇÃO DE EXAMES LABORATORIAIS - CENDAP

Informações Adicionais:
[ ] Jejum de 8-12h  [ ] Febre  [ ] Gestante  Convênio: [Convenio]

Solicito os seguintes exames:
[ ] HEMOGRAMA
[ ] URINA-EAS
[ ] FEZES-EPF
[ ] ABO/RH
[ ] VDRL
[ ] BHCG
[ ] GLICEMIA
[ ] COL.TOTAL
[ ] COL. T e F (HDL, LDL, VLDL)
[ ] TRIGLICERÍDEOS
[ ] URÉIA
[ ] CREATININA
[ ] ÁCIDO ÚRICO
[ ] TGO/AST
[ ] TGP/ALT
[ ] BILIRUBINAS T e F
[ ] VHS
[ ] ASO
[ ] PCR
[ ] F. REUMATÓIDE
[ ] COAGULOGRAMA
[ ] PROTEINAS TOTAIS
[ ] ALBUMINA
[ ] ESCARRO
[ ] PROTEINAS T e F
[ ] SECREÇÃO (BAC + EFRE)
[ ] TOXO IGG/IGM
[ ] RUBÉOLA IGG/IGM
[ ] CMV IGG/IGM
[ ] IONOGRAMA (SÓDIO, FÓSFORO, POTÁSSIO, CÁLCIO)
[ ] FOSF. ALCALINA
[ ] GAMA GT
[ ] COOMBS DIRETO/INDIRETO
[ ] PSA T/L
[ ] FERRITINA
[ ] FERRO SERICO
[ ] VIT D-25 /HIDROXI
[ ] VITAMINA B12
[ ] GLICEMIA PÓS-PRANDIAL
[ ] TTGO
[ ] LÍPASE / AMÍLASE
[ ] HEMOGLOBINA GLICADA
[ ] DESIDROGENASE – DHL
[ ] FAN-HELP 2
[ ] ANTI-HVA IGG/IGM
[ ] ANTI-HCV / ANTI-HBS / HSAG
[ ] HIV
[ ] TAP / TTPA
[ ] DENGUE
[ ] MICOLÓGICO DIRETO
[ ] TSH / T4L / T4T / T3L / T3T
[ ] FSH / LH
[ ] ESTRADIOL / PROGESTERONA / PROLACTINA
[ ] TESTOSTERONA T E L / CORTISOL
[ ] CEA / CA 15-3 / CA125 / CA19-9 / IGE TOTAL

Outros Exames:
[Outros Exames]

Justificativa Clínica:
[Justificativa]`
      }
    ]
  };

  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const verifyAccess = async () => {
      // Se o contexto ainda está carregando, não faz nada
      if (isAuthContextLoading) return;

      // Se não tem usuário, redireciona para login
      if (!user) {
        window.location.href = '/login';
        return;
      }

      try {
        // Verifica se o usuário é um médico autorizado
        const { data: doctorSetting, error: dbError } = await supabase
          .from('doctor_settings')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (dbError || !doctorSetting) {
          console.warn('Usuário não autorizado no painel médico:', user.id);
          alert('Acesso negado. Apenas médicos autorizados podem acessar este painel.');
          window.location.href = '/';
          return;
        }

        setIsAuthorized(true);
        setIsAuthChecking(false);
        fetchConsultations();
      } catch (err) {
        console.error('Erro crítico na verificação de acesso:', err);
        window.location.href = '/';
      }
    };

    verifyAccess();
  }, [user, isAuthContextLoading]);

  const fetchConsultations = async (filter: 'today' | 'future' | 'all' = sidebarFilter) => {
    setIsRefreshing(true);
    let query = supabase
      .from('consultations')
      .select(`
        *,
        profiles ( full_name, cpf, phone, avatar_url ),
        payments ( status )
      `);

    const now = new Date();
    // Obtém a data de hoje no formato YYYY-MM-DD considerando o fuso local do Brasil
    const todayStr = now.toLocaleDateString('en-CA'); 

    if (filter === 'today') {
      query = query
        .gte('appointment_date', `${todayStr}T00:00:00`)
        .lte('appointment_date', `${todayStr}T23:59:59`);
    } else if (filter === 'future') {
      query = query
        .gt('appointment_date', `${todayStr}T23:59:59`);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (!error && data) {
      setConsultations(data);
    }
    setIsRefreshing(false);
  };

  const handleStartConsultation = async (cons: any) => {
    setActiveConsultation(cons);
    setClinicalNotes(cons.clinical_notes || '');
    setRoomUrl(null); // Reseta a sala ao trocar de paciente
    fetchPatientHistory(cons.patient_id, cons.id);
    fetchConsultationDocuments(cons.id);
  };

  const fetchConsultationDocuments = async (consultationId: string) => {
    const { data, error } = await supabase
      .from('issued_documents')
      .select('*')
      .eq('consultation_id', consultationId)
      .eq('status', 'signed')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setCurrentConsultationDocs(data);
    }
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
        const { error } = await supabase
            .from('consultations')
            .update({ clinical_notes: clinicalNotes })
            .eq('id', activeConsultation.id);
        
        if (error) throw error;
        
        // Atualiza a lista local
        setConsultations(prev => prev.map(c => c.id === activeConsultation.id ? { ...c, clinical_notes: clinicalNotes } : c));
        alert('Evolução clínica salva com sucesso!');
    } catch (e) {
        console.error(e);
        alert('Erro ao salvar prontuário.');
    } finally {
        setIsSavingNotes(false);
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

      // Atualiza a lista local
      setConsultations(prev => prev.map(c => c.id === activeConsultation.id ? { ...c, status: 'completed' } : c));
      setActiveConsultation(null);
      setRoomUrl(null);
      alert('Atendimento finalizado com sucesso!');
    } catch (e) {
      console.error(e);
      alert('Erro ao finalizar atendimento.');
    }
  };

  const handleModelSelect = (modelId: string) => {
    const model = DOCUMENT_MODELS[docType].find(m => m.id === modelId);
    if (!model) {
      setDocContent('');
      setFormFields({});
      return;
    }

    setDocContent(model.content);
    
    // Detecta campos dinâmicos
    const newFields: Record<string, any> = {};
    
    // 1. Detecta Checkboxes: [ ] EXAME
    // Suporta minúsculas, acentos e hifens
    const checkboxRegex = /\[ \]\s*([a-zA-Z0-9\s/().,\u00C0-\u00FF-]+)/g;
    let match;
    while ((match = checkboxRegex.exec(model.content)) !== null) {
      newFields[`cb_${match[1].trim()}`] = false;
    }

    // 2. Detecta Inputs: [Nome do Campo]
    // Evita pegar os checkboxes já processados e suporta acentos
    const inputRegex = /\[([A-Z][a-zA-Z0-9\s\u00C0-\u00FF]+)\]/g;
    while ((match = inputRegex.exec(model.content)) !== null) {
      const fieldName = match[1].trim();
      if (!newFields[`cb_${fieldName}`]) {
        newFields[`in_${fieldName}`] = '';
      }
    }

    setFormFields(newFields);
  };

  const getFinalContent = () => {
    let content = docContent;
    
    // Substitui Checkboxes e Inputs
    Object.keys(formFields).forEach(key => {
      if (key.startsWith('cb_')) {
        const label = key.replace('cb_', '');
        const replacement = formFields[key] ? '[X]' : '[ ]';
        content = content.split(`[ ] ${label}`).join(`${replacement} ${label}`);
      } else if (key.startsWith('in_')) {
        const label = key.replace('in_', '');
        const val = formFields[key] || '';
        content = content.split(`[${label}]`).join(val);
      }
    });

    // Pós-processamento para Prescrições: Limpar itens não preenchidos e re-numerar
    if (docType === 'prescription') {
      const lines = content.split('\n');
      const finalLines: string[] = [];
      let currentItemNum = 1;
      let pendingHeader: string | null = null;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const nextLine = (lines[i + 1] || '').trim();
        
        // 1. Detecta cabeçalhos (ex: "USO ORAL:", "USO INJETÁVEL:")
        // Consideramos cabeçalho se terminar com : e não começar com número (para não confundir com itens)
        if (line.endsWith(':') && !/^\d+\./.test(line)) {
          pendingHeader = line;
          continue;
        }

        // 2. Detecta início de um item numerado (ex: "1. ", "2. ", etc)
        const itemMatch = line.match(/^(\d+)\.\s*(.*)/);
        
        if (itemMatch) {
          const medicationContent = itemMatch[2];
          // Detecta posologia (Tomar ou Aplicar)
          const posologiaMatch = nextLine.match(/^(Tomar:|Aplicar:)\s*(.*)/);
          const posologiaContent = posologiaMatch ? nextLine : '';
          
          // Verifica se o item tem conteúdo real (remove placeholders residuais, hifens e espaços)
          const cleanMed = medicationContent.replace(/\[.*?\]|[-_\s]/g, '');
          const cleanPos = posologiaContent.replace(/Tomar:|Aplicar:|\[.*?\]|\s/g, '');
          
          const hasRealContent = cleanMed.length > 0 || cleanPos.length > 0;
          
          if (hasRealContent) {
            // Se tivermos um cabeçalho pendente, adicionamos ele agora que sabemos que há conteúdo
            if (pendingHeader) {
              if (finalLines.length > 0) finalLines.push(''); // Espaço entre seções
              finalLines.push(pendingHeader);
              pendingHeader = null;
            }

            // Adiciona o item re-numerado
            finalLines.push(`${currentItemNum}. ${medicationContent}`);
            currentItemNum++;
            
            // Se a próxima linha era a posologia deste item, adiciona ela e pula o índice
            if (posologiaContent) {
              finalLines.push(posologiaContent);
              i++;
            }
          } else {
            // Item vazio: ignora esta linha e a próxima se for o campo de posologia
            if (posologiaContent) i++;
          }
        } else if (line !== '' && !line.startsWith('Tomar:') && !line.startsWith('Aplicar:')) {
          // Outras linhas (instruções gerais, etc) que não sejam posologias órfãs
          // Se houver um cabeçalho pendente, ele é mantido para essas instruções se for o caso
          // Mas normalmente instruções gerais não vêm sob "USO ORAL:" se não houver remédios
          if (pendingHeader) {
            finalLines.push(pendingHeader);
            pendingHeader = null;
          }
          finalLines.push(line);
        }
      }
      
      return finalLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    }

    return content;
  };

  const generateDraftPDF = async () => {
    if (!activeConsultation) return;
    
    const doc = new jsPDF();
    const finalContent = getFinalContent();
    const patientName = activeConsultation.profiles?.full_name || 'Paciente';
    const patientCpf = activeConsultation.profiles?.cpf || '';
    
    const primaryRed = [203, 30, 40];
    const darkGray = [30, 41, 59];
    const pageHeight = doc.internal.pageSize.getHeight();
    let currentY = 100;

    const renderHeader = (isFirstPage: boolean) => {
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, 210, 40, 'F');
        
        try {
            // Desenha a logo
            doc.addImage('/logo-cendap.png', 'PNG', 15, 8, 24, 24);
            
            // Mascara as bordas da imagem para remover artefatos cinzas/bordas do arquivo original
            doc.setDrawColor(255, 255, 255);
            doc.setLineWidth(0.5);
            doc.rect(15, 8, 24, 24, 'S'); // Desenha um retângulo branco sobre o limite da imagem
        } catch(e) {}

        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        doc.text('CENTRO DE DIAGNÓSTICO DE CAPITÃO POÇO', 195, 12, { align: 'right' });
        doc.text('Trav. José Barros Silva, 806 - Centro', 195, 17, { align: 'right' });
        doc.text('WhatsApp: (91) 98109-7045', 195, 22, { align: 'right' });
        doc.text('cdlacp@gmail.com | agendacendap.com.br', 195, 27, { align: 'right' });

        doc.setDrawColor(primaryRed[0], primaryRed[1], primaryRed[2]);
        doc.setLineWidth(0.8);
        doc.line(15, 32, 195, 32);

        if (isFirstPage) {
            doc.setFontSize(18);
            doc.setTextColor(primaryRed[0], primaryRed[1], primaryRed[2]);
            doc.text(docType === 'prescription' ? 'RECEITUÁRIO MÉDICO' : 'SOLICITAÇÃO DE EXAMES', 105, 52, { align: 'center' });
            
            doc.setFillColor(248, 250, 252);
            doc.rect(15, 60, 180, 20, 'F');
            doc.setFontSize(11);
            doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
            doc.text(`PACIENTE: ${patientName.toUpperCase()}`, 20, 68);
            doc.text(`CPF: ${patientCpf}`, 20, 75);
            doc.text(`DATA: ${new Date().toLocaleDateString('pt-BR')}`, 190, 68, { align: 'right' });
        }
    };

    const renderFooter = () => {
        const pageCount = (doc.internal as any).getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            
            // Posição dinâmica da assinatura: Receitas ficam um pouco mais altas, pedidos de exame ficam baixos (para Gov.br)
            const sigBaseY = docType === 'prescription' ? pageHeight - 45 : pageHeight - 30;
            const lineY = sigBaseY - 5;

            doc.setDrawColor(226, 232, 240);
            doc.line(15, lineY - 5, 195, lineY - 5);
            
            doc.setFontSize(8.5);
            doc.setTextColor(100, 116, 139);
            doc.text(`Documento gerado via Telemedicina CENDAP - Página ${i} de ${pageCount}`, 105, pageHeight - 8, { align: 'center' });

            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(0.2);
            doc.line(65, sigBaseY - 5, 145, sigBaseY - 5);
            doc.setFontSize(11);
            doc.setTextColor(0, 0, 0);
            doc.text('Dr. André Pontes', 105, sigBaseY, { align: 'center' });
            doc.setFontSize(9);
            doc.text('CRM/PA 7703', 105, sigBaseY + 5, { align: 'center' });
        }
    };

    renderHeader(true);

    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    
    const lines = finalContent.split('\n');
    currentY = 88;
    const col1X = 15;
    const col2X = 108; // 2 colunas mais afastadas para evitar sobreposição
    const lineHeight = 4.2; // Bem compacto para caber tudo

    let pendingExam: string | null = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const isExamLine = line.startsWith('[ ]') || line.startsWith('[X]') || line.startsWith('[x]');
        
        if (isExamLine) {
            doc.setFontSize(8); // Fonte pequena para segurança
            if (!pendingExam) {
                pendingExam = line;
            } else {
                // Renderiza o par
                doc.text(pendingExam, col1X, currentY);
                doc.text(line, col2X, currentY);
                pendingExam = null;
                currentY += lineHeight;
            }
        } else {
            // Renderiza pendente antes de mudar de seção
            if (pendingExam) {
                doc.setFontSize(8);
                doc.text(pendingExam, col1X, currentY);
                pendingExam = null;
                currentY += lineHeight;
            }
            
            doc.setFontSize(10); // Volta para fonte normal
            
            if (line === '') {
                currentY += 1.2;
                continue;
            }

            const splitLine = doc.splitTextToSize(lines[i], 175);
            for (const s of splitLine) {
                if (currentY > pageHeight - 35) {
                    doc.addPage();
                    renderHeader(false);
                    currentY = 42;
                }
                doc.text(s, 15, currentY);
                currentY += lineHeight + 0.8;
            }
        }

        if (currentY > pageHeight - 35) {
            doc.addPage();
            renderHeader(false);
            currentY = 42;
        }
    }
    
    // Renderiza pendente final
    if (pendingExam) {
        doc.setFontSize(8);
        doc.text(pendingExam, col1X, currentY);
        currentY += lineHeight;
    }
    
    if (currentY > pageHeight - 32) {
        doc.addPage();
        renderHeader(false);
    }
    
    renderFooter();
    doc.save(`Rascunho_${docType}_${patientName.replace(/\s+/g, '_')}.pdf`);
  };

  const handleUploadSignedDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConsultation) return;

    setIsUploading(true);
    setUploadSuccess(false);

    try {
      const fileName = `${activeConsultation.patient_id}/${Date.now()}_${file.name}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('medical-documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('medical-documents')
        .getPublicUrl(fileName);

      const { error: dbError } = await supabase
        .from('issued_documents')
        .insert({
          consultation_id: activeConsultation.id,
          patient_id: activeConsultation.patient_id,
          type: docType,
          status: 'signed',
          document_url: urlData.publicUrl
        });

      if (dbError) throw dbError;

      setUploadSuccess(true);
      setDocContent('');
      fetchConsultationDocuments(activeConsultation.id);
      setTimeout(() => setUploadSuccess(false), 5000);
    } catch (error: any) {
      console.error('Erro no upload:', error);
      alert('Erro ao enviar documento assinado: ' + error.message);
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  if (isAuthChecking || isAuthContextLoading) {
    return (
      <div style={{ display: 'flex', height: '100vh', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', color: '#64748b', gap: '16px' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #e2e8f0', borderTop: '3px solid #cb1e28', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
        <span style={{ fontWeight: 500 }}>Verificando credenciais médicas...</span>
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
                      <span style={{ fontSize: '0.75rem', color: '#cb1e28', fontWeight: 700 }}>
                        {(() => {
                          if (!cons.appointment_date) return '';
                          try {
                            // Converte para objeto Date e formata forçando o fuso de Brasília
                            const date = new Date(cons.appointment_date);
                            return date.toLocaleTimeString('pt-BR', { 
                              hour: '2-digit', 
                              minute: '2-digit',
                              timeZone: 'America/Sao_Paulo' 
                            });
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

              {/* Área de Documentos e Prontuário */}
              <div style={{ flex: 1, backgroundColor: 'white', display: 'flex', flexDirection: 'column', minWidth: '400px' }}>
                <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0' }}>
                  <button 
                    onClick={() => setActiveTab('notes')}
                    style={{ flex: 1, padding: '16px', border: 'none', backgroundColor: activeTab === 'notes' ? 'white' : '#f8fafc', borderBottom: activeTab === 'notes' ? '3px solid #cb1e28' : 'none', color: activeTab === 'notes' ? '#cb1e28' : '#64748b', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Prontuário
                  </button>
                  <button 
                    onClick={() => setActiveTab('documents')}
                    style={{ flex: 1, padding: '16px', border: 'none', backgroundColor: activeTab === 'documents' ? 'white' : '#f8fafc', borderBottom: activeTab === 'documents' ? '3px solid #cb1e28' : 'none', color: activeTab === 'documents' ? '#cb1e28' : '#64748b', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Prescrições
                  </button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                  {activeTab === 'notes' ? (
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

                      {/* Histórico do Paciente */}
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
                  ) : (
                    <div>
                      <h3 style={{ margin: '0 0 16px 0', color: '#0f172a', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileText size={18} /> Emissão de Documentos
                      </h3>
                      
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                        <button 
                          onClick={() => setDocType('prescription')}
                          style={{ flex: 1, padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: docType === 'prescription' ? '#fef2f2' : 'white', borderColor: docType === 'prescription' ? '#cb1e28' : '#cbd5e1', color: docType === 'prescription' ? '#cb1e28' : '#475569', cursor: 'pointer', fontWeight: 500 }}
                        >
                          Receita
                        </button>
                        <button 
                          onClick={() => setDocType('exam')}
                          style={{ flex: 1, padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: docType === 'exam' ? '#fef2f2' : 'white', borderColor: docType === 'exam' ? '#cb1e28' : '#cbd5e1', color: docType === 'exam' ? '#cb1e28' : '#475569', cursor: 'pointer', fontWeight: 500 }}
                        >
                          Pedido de Exame
                        </button>
                      </div>

                      {/* Seletor de Modelos */}
                      <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#64748b', marginBottom: '6px' }}>Usar um modelo pronto:</label>
                        <select 
                          onChange={(e) => handleModelSelect(e.target.value)}
                          style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                        >
                          <option value="">Selecione um modelo (vazio)...</option>
                          {DOCUMENT_MODELS[docType].map(m => (
                            <option key={m.id} value={m.id}>{m.title}</option>
                          ))}
                        </select>
                      </div>

                      {/* Campos do Formulário Dinâmico */}
                      {Object.keys(formFields).length > 0 && (
                        <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#f1f5f9', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: '#334155', fontWeight: 700 }}>Preencher Informações:</h4>
                          
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
                            {/* Renderizar Inputs de Texto Primeiro */}
                            {Object.keys(formFields).filter(k => k.startsWith('in_')).map(key => (
                              <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{key.replace('in_', '')}</label>
                                <input 
                                  type="text"
                                  value={formFields[key]}
                                  onChange={(e) => setFormFields({...formFields, [key]: e.target.value})}
                                  placeholder={`Digite ${key.replace('in_', '').toLowerCase()}...`}
                                  style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                                />
                              </div>
                            ))}

                            {/* Renderizar Checkboxes para Exames */}
                            {Object.keys(formFields).filter(k => k.startsWith('cb_')).length > 0 && (
                              <div style={{ marginTop: '8px' }}>
                                <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '8px' }}>Selecione os Exames:</label>
                                <div style={{ 
                                  display: 'grid', 
                                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', 
                                  gap: '8px',
                                  maxHeight: '300px',
                                  overflowY: 'auto',
                                  padding: '8px',
                                  backgroundColor: 'white',
                                  borderRadius: '6px',
                                  border: '1px solid #e2e8f0'
                                }}>
                                  {Object.keys(formFields).filter(k => k.startsWith('cb_')).map(key => (
                                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.7rem', color: '#475569', cursor: 'pointer', lineHeight: '1.2' }}>
                                      <input 
                                        type="checkbox"
                                        checked={formFields[key]}
                                        onChange={(e) => setFormFields({...formFields, [key]: e.target.checked})}
                                        style={{ width: '14px', height: '14px', flexShrink: 0 }}
                                      />
                                      {key.replace('cb_', '')}
                                    </label>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <textarea 
                        value={getFinalContent()}
                        readOnly
                        placeholder={docType === 'prescription' ? "Descreva os medicamentos e posologia..." : "Descreva os exames solicitados..."}
                        style={{ width: '100%', height: '150px', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '6px', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box', backgroundColor: '#f8fafc', color: '#64748b', fontSize: '0.85rem' }}
                      />

                      <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {/* Passo 1: Gerar Rascunho */}
                        <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Passo 1: Gerar Documento</p>
                          <button 
                            onClick={generateDraftPDF}
                            disabled={!getFinalContent().trim()}
                            style={{ width: '100%', padding: '10px', backgroundColor: '#cb1e28', color: 'white', border: 'none', borderRadius: '6px', cursor: getFinalContent().trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: getFinalContent().trim() ? 1 : 0.5 }}
                          >
                            <Download size={16} /> Baixar Rascunho PDF
                          </button>
                          <p style={{ margin: '8px 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>Assine o PDF gerado utilizando o Gov.br.</p>
                        </div>

                        {/* Passo 2: Upload do Assinado */}
                        <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Passo 2: Enviar Documento Assinado</p>
                          <label 
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '10px', backgroundColor: 'white', color: '#cb1e28', border: '1px dashed #cb1e28', borderRadius: '6px', cursor: 'pointer', boxSizing: 'border-box' }}
                          >
                            {isUploading ? (
                              <span>Enviando...</span>
                            ) : (
                              <>
                                <Upload size={16} /> Selecionar PDF Assinado
                              </>
                            )}
                            <input 
                              type="file" 
                              accept="application/pdf" 
                              style={{ display: 'none' }} 
                              onChange={handleUploadSignedDocument}
                              disabled={isUploading}
                            />
                          </label>
                          {uploadSuccess && (
                            <p style={{ margin: '8px 0 0 0', fontSize: '0.8rem', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <CheckCircle size={14} /> Enviado ao paciente com sucesso!
                            </p>
                          )}
                        </div>

                        {/* Lista de Documentos Enviados */}
                        {currentConsultationDocs.length > 0 && (
                          <div style={{ marginTop: '12px' }}>
                            <p style={{ margin: '0 0 10px 0', fontSize: '0.85rem', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <CheckCircle size={16} style={{ color: '#16a34a' }} /> Documentos Enviados:
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {currentConsultationDocs.map(doc => (
                                <div key={doc.id} style={{ padding: '8px 12px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <FileText size={14} style={{ color: '#16a34a' }} />
                                    <span style={{ fontSize: '0.8rem', color: '#166534', fontWeight: 500 }}>
                                      {doc.type === 'prescription' ? 'Receita' : 'Exame'} - {new Date(doc.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                  <a href={doc.document_url} target="_blank" rel="noopener noreferrer" style={{ color: '#166534', fontSize: '0.75rem', fontWeight: 600, textDecoration: 'underline' }}>Ver</a>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
