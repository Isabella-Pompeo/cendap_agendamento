'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import jsPDF from 'jspdf';
import { Camera, FileText, Download, Upload, LogOut, User as UserIcon, Stethoscope, CalendarDays, CheckCircle } from 'lucide-react';

export default function DoctorPanel() {
  const [consultations, setConsultations] = useState<any[]>([]);
  const [activeConsultation, setActiveConsultation] = useState<any | null>(null);
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [docType, setDocType] = useState<'prescription' | 'exam'>('prescription');
  const [docContent, setDocContent] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [activeTab, setActiveTab] = useState<'notes' | 'documents'>('notes');
  const [isUploading, setIsUploading] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  
  const DOCUMENT_MODELS: Record<'prescription' | 'exam', { id: string; title: string; content: string }[]> = {
    prescription: [
      { id: 'default', title: 'Receita Padrão', content: 'USO INTERNO:\n\n1. [Medicamento] ---------------- [Dose]\nTomar 1 comprimido via oral a cada 8 horas por 7 dias.\n\n2. [Medicamento] ---------------- [Dose]\nTomar 1 cápsula em jejum por 30 dias.' },
      { id: 'especial', title: 'Controle Especial', content: 'RECEITUÁRIO DE CONTROLE ESPECIAL\n\nPaciente: [Nome]\nEndereço: [Endereço]\n\n1. [Medicamento] ---------------- [Dose]\n[Orientação de uso]' }
    ],
    exam: [
      { id: 'checkup', title: 'Check-up Básico', content: 'Solicito os seguintes exames laboratoriais:\n- Hemograma completo\n- Glicemia de jejum\n- Perfil lipídico completo\n- Ureia e Creatinina\n- TGO e TGP' },
      { id: 'cardio', title: 'Avaliação Cardiológica', content: 'Solicito os seguintes exames:\n- ECG (Eletrocardiograma)\n- Ecocardiograma Transtorácico\n- MAPA 24h\n- Holter 24h' }
    ]
  };

  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    checkAuthAndFetch();
  }, []);

  const checkAuthAndFetch = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      window.location.href = '/login';
      return;
    }

    // Verifica se o usuário é um médico autorizado (está na tabela doctor_settings)
    const { data: doctorSetting, error } = await supabase
      .from('doctor_settings')
      .select('*')
      .eq('user_id', session.user.id)
      .single();

    if (error || !doctorSetting) {
      alert('Acesso negado. Apenas médicos autorizados podem acessar este painel.');
      window.location.href = '/';
      return;
    }

    setIsAuthorized(true);
    setIsAuthChecking(false);
    fetchConsultations();
  };

  const fetchConsultations = async () => {
    const { data, error } = await supabase
      .from('consultations')
      .select(`
        *,
        profiles ( full_name, cpf )
      `)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setConsultations(data);
    }
  };

  const handleStartConsultation = async (cons: any) => {
    setActiveConsultation(cons);
    setClinicalNotes(cons.clinical_notes || '');
    // Gerar token de médico para a sala já existente
    try {
        const res = await fetch('/api/telemedicine/room', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                appointmentId: cons.id,
                patientId: cons.patient_id,
                doctorName: cons.doctor_name,
                appointmentDate: cons.appointment_date,
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
    } catch (e) {
        console.error(e);
        alert('Erro ao salvar prontuário.');
    } finally {
        setIsSavingNotes(false);
    }
  };

  const generateDraftPDF = async () => {
    if (!activeConsultation) return;
    
    const doc = new jsPDF();
    const patientName = activeConsultation.profiles?.full_name || 'Paciente';
    const patientCpf = activeConsultation.profiles?.cpf || '';
    
    // Cores CENDAP
    const primaryRed = [203, 30, 40];
    const darkGray = [30, 41, 59];
    
    // Header
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, 210, 40, 'F');
    
    try {
        // Tenta carregar a logo
        const logoImg = new Image();
        logoImg.src = '/logo-cendap.png';
        doc.addImage('/logo-cendap.png', 'PNG', 15, 10, 45, 20);
    } catch(e) {}

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('CENTRO DE DIAGNÓSTICO DE CAPITÃO POÇO', 195, 15, { align: 'right' });
    doc.text('CNPJ: 10.695.431/0001-73', 195, 20, { align: 'right' });
    doc.text('WhatsApp: (91) 98109-7045', 195, 25, { align: 'right' });

    doc.setDrawColor(primaryRed[0], primaryRed[1], primaryRed[2]);
    doc.setLineWidth(0.8);
    doc.line(15, 35, 195, 35);
    
    // Título do Documento
    doc.setFontSize(18);
    doc.setTextColor(primaryRed[0], primaryRed[1], primaryRed[2]);
    doc.text(docType === 'prescription' ? 'RECEITUÁRIO MÉDICO' : 'SOLICITAÇÃO DE EXAMES', 105, 55, { align: 'center' });
    
    // Dados do Paciente
    doc.setFillColor(248, 250, 252);
    doc.rect(15, 65, 180, 20, 'F');
    doc.setFontSize(11);
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    doc.text(`PACIENTE: ${patientName.toUpperCase()}`, 20, 73);
    doc.text(`CPF: ${patientCpf}`, 20, 80);
    doc.text(`DATA: ${new Date().toLocaleDateString('pt-BR')}`, 190, 73, { align: 'right' });
    
    // Conteúdo
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    const splitText = doc.splitTextToSize(docContent, 170);
    doc.text(splitText, 20, 100);
    
    // Rodapé / Assinatura
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setDrawColor(226, 232, 240);
    doc.line(15, pageHeight - 40, 195, pageHeight - 40);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('Trav. José Barros da Silva, 806 - Capitão Poço, PA', 105, pageHeight - 32, { align: 'center' });
    doc.text('Documento gerado via Telemedicina CENDAP', 105, pageHeight - 27, { align: 'center' });

    // Linha de assinatura
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);
    doc.line(60, pageHeight - 65, 150, pageHeight - 65);
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text('Dr. André Pontes', 105, pageHeight - 60, { align: 'center' });
    doc.setFontSize(9);
    doc.text('CRM/PA 12345', 105, pageHeight - 55, { align: 'center' });
    
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
      setTimeout(() => setUploadSuccess(false), 5000);
    } catch (error: any) {
      console.error('Erro no upload:', error);
      alert('Erro ao enviar documento assinado: ' + error.message);
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  if (isAuthChecking) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', color: '#64748b' }}>
        Verificando credenciais médicas...
      </div>
    );
  }

  if (!isAuthorized) return null;

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
      
      {/* Sidebar - Lista de Pacientes */}
      <div style={{ width: '320px', backgroundColor: 'white', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px', backgroundColor: 'white', borderBottom: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <img src="/logo-cendap.png" alt="CENDAP Logo" style={{ height: '40px', marginBottom: '12px', objectFit: 'contain' }} />
          <h2 style={{ margin: 0, fontSize: '1rem', color: '#0f172a', fontWeight: 700 }}>
             Painel Médico
          </h2>
          <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#cb1e28', fontWeight: 600 }}>Dr. André - CENDAP</p>
        </div>
        
        <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
            <CalendarDays size={18} style={{ color: '#cb1e28' }} /> Consultas de Hoje
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: activeConsultation?.id === cons.id ? '#fee2e2' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: activeConsultation?.id === cons.id ? '#cb1e28' : '#64748b' }}>
                    <UserIcon size={20} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, color: '#0f172a', fontSize: '0.95rem', fontWeight: activeConsultation?.id === cons.id ? 700 : 500 }}>{cons.profiles?.full_name || 'Paciente sem nome'}</h4>
                    <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.8rem' }}>
                      {new Date(cons.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute:'2-digit' })}
                    </p>
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
              <div>
                <h2 style={{ margin: 0, color: '#0f172a', fontSize: '1.25rem' }}>Atendimento: {activeConsultation.profiles?.full_name}</h2>
                <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>CPF: {activeConsultation.profiles?.cpf || 'Não informado'}</p>
              </div>
              <button 
                onClick={() => { setActiveConsultation(null); setRoomUrl(null); }}
                style={{ padding: '8px 16px', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
              >
                Encerrar / Voltar
              </button>
            </div>

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              {/* Área de Vídeo */}
              <div style={{ flex: 2, borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', backgroundColor: '#000' }}>
                {roomUrl ? (
                  <iframe 
                    src={roomUrl}
                    allow="camera; microphone; fullscreen; display-capture"
                    style={{ width: '100%', height: '100%', border: 'none' }}
                  />
                ) : (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                    Conectando na sala...
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
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                      <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: '#0f172a' }}>Observações Clínicas</h3>
                      <textarea 
                        value={clinicalNotes}
                        onChange={(e) => setClinicalNotes(e.target.value)}
                        placeholder="Descreva aqui o histórico, sintomas e conduta da consulta..."
                        style={{ flex: 1, width: '100%', minHeight: '300px', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box', lineHeight: '1.5' }}
                      />
                      <button 
                        onClick={saveClinicalNotes}
                        disabled={isSavingNotes}
                        style={{ marginTop: '16px', padding: '12px', backgroundColor: '#cb1e28', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                      >
                        {isSavingNotes ? 'Salvando...' : <><CheckCircle size={18} /> Salvar Prontuário</>}
                      </button>
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
                          onChange={(e) => {
                            const model = DOCUMENT_MODELS[docType].find(m => m.id === e.target.value);
                            if (model) setDocContent(model.content);
                          }}
                          style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                        >
                          <option value="">Selecione um modelo (vazio)...</option>
                          {DOCUMENT_MODELS[docType].map(m => (
                            <option key={m.id} value={m.id}>{m.title}</option>
                          ))}
                        </select>
                      </div>

                      <textarea 
                        value={docContent}
                        onChange={(e) => setDocContent(e.target.value)}
                        placeholder={docType === 'prescription' ? "Descreva os medicamentos e posologia..." : "Descreva os exames solicitados..."}
                        style={{ width: '100%', height: '200px', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '6px', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                      />

                      <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {/* Passo 1: Gerar Rascunho */}
                        <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Passo 1: Gerar Documento</p>
                          <button 
                            onClick={generateDraftPDF}
                            disabled={!docContent.trim()}
                            style={{ width: '100%', padding: '10px', backgroundColor: '#cb1e28', color: 'white', border: 'none', borderRadius: '6px', cursor: docContent.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: docContent.trim() ? 1 : 0.5 }}
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
