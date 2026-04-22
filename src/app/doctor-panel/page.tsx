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
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  useEffect(() => {
    fetchConsultations();
  }, []);

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

  const generateDraftPDF = () => {
    if (!activeConsultation) return;
    
    const doc = new jsPDF();
    const patientName = activeConsultation.profiles?.full_name || 'Paciente';
    const patientCpf = activeConsultation.profiles?.cpf || '';
    
    doc.setFontSize(20);
    doc.text('CENDAP - Telemedicina', 105, 20, { align: 'center' });
    
    doc.setFontSize(14);
    doc.text(docType === 'prescription' ? 'RECEITUÁRIO MÉDICO' : 'PEDIDO DE EXAME', 105, 35, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`Paciente: ${patientName}`, 20, 50);
    doc.text(`CPF: ${patientCpf}`, 20, 58);
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 20, 66);
    
    doc.line(20, 72, 190, 72);
    
    // Conteúdo
    doc.setFontSize(11);
    const splitText = doc.splitTextToSize(docContent, 170);
    doc.text(splitText, 20, 85);
    
    // Espaço para assinatura
    doc.line(60, 250, 150, 250);
    doc.text('Assinatura do Médico', 105, 258, { align: 'center' });
    
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

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
      
      {/* Sidebar - Lista de Pacientes */}
      <div style={{ width: '320px', backgroundColor: 'white', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px', backgroundColor: '#0f172a', color: 'white' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Stethoscope size={20} /> Painel Médico
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>Dr. André - CENDAP</p>
        </div>
        
        <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0', fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CalendarDays size={18} /> Consultas de Hoje
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
                  backgroundColor: activeConsultation?.id === cons.id ? '#eff6ff' : 'white',
                  borderLeft: activeConsultation?.id === cons.id ? '4px solid #3b82f6' : '4px solid transparent',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                    <UserIcon size={20} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, color: '#0f172a', fontSize: '0.95rem' }}>{cons.profiles?.full_name || 'Paciente sem nome'}</h4>
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
              <div style={{ flex: 1, backgroundColor: 'white', display: 'flex', flexDirection: 'column', minWidth: '350px' }}>
                <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0' }}>
                  <h3 style={{ margin: '0 0 16px 0', color: '#0f172a', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileText size={18} /> Emissão de Documentos
                  </h3>
                  
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                    <button 
                      onClick={() => setDocType('prescription')}
                      style={{ flex: 1, padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: docType === 'prescription' ? '#eff6ff' : 'white', borderColor: docType === 'prescription' ? '#3b82f6' : '#cbd5e1', color: docType === 'prescription' ? '#1d4ed8' : '#475569', cursor: 'pointer', fontWeight: 500 }}
                    >
                      Receita
                    </button>
                    <button 
                      onClick={() => setDocType('exam')}
                      style={{ flex: 1, padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: docType === 'exam' ? '#eff6ff' : 'white', borderColor: docType === 'exam' ? '#3b82f6' : '#cbd5e1', color: docType === 'exam' ? '#1d4ed8' : '#475569', cursor: 'pointer', fontWeight: 500 }}
                    >
                      Pedido de Exame
                    </button>
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
                        style={{ width: '100%', padding: '10px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '6px', cursor: docContent.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: docContent.trim() ? 1 : 0.5 }}
                      >
                        <Download size={16} /> Baixar Rascunho PDF
                      </button>
                      <p style={{ margin: '8px 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>Assine o PDF gerado utilizando o Gov.br.</p>
                    </div>

                    {/* Passo 2: Upload do Assinado */}
                    <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Passo 2: Enviar Documento Assinado</p>
                      <label 
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '10px', backgroundColor: 'white', color: '#3b82f6', border: '1px dashed #3b82f6', borderRadius: '6px', cursor: 'pointer', boxSizing: 'border-box' }}
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
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
