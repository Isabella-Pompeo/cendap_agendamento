'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import styles from './ProfileModal.module.css';
import { ChevronLeft, ChevronRight, User as UserIcon, CalendarDays, FileText, Settings, LogOut, Info, ShieldCheck, Phone, Fingerprint, Stethoscope, Hash, TicketPercent, Download, Camera } from 'lucide-react';
import { supabase } from '../lib/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ProfileModalProps {
  onClose: () => void;
}

export default function ProfileModal({ onClose }: ProfileModalProps) {
  useEffect(() => {
    // Bloqueia o scroll do corpo da página ao abrir o modal
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    
    return () => {
      // Restaura o scroll ao fechar
      document.body.style.overflow = originalStyle;
    };
  }, []);

  const { user, profile, signOut, refreshProfile } = useAuth();
  
  // Auto-refresh profile if missing but user is logged in (handles registration lag)
  useEffect(() => {
    if (user && !profile) {
      const timer = setTimeout(() => {
        refreshProfile();
      }, 2000); 
      return () => clearTimeout(timer);
    }
  }, [user, profile, refreshProfile]);

  const [activeView, setActiveView] = useState<'menu' | 'info' | 'appointments' | 'appointment_detail' | 'avatar_selector' | 'documents'>('menu');
  const [selectedApt, setSelectedApt] = useState<any | null>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(false);
  
  const [documents, setDocuments] = useState<any[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  
  // Edit states
  const [editingAptId, setEditingAptId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ nome_paciente: '', telefone: '', cpf: '' });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState<string | null>(null);
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);

  const AVAILABLE_AVATARS = [
    { url: '/avatar-homem.png', gender: 'male' },
    { url: '/avatar-mulher.png', gender: 'female' },
    { url: '/avatars/avatar-1.png', gender: 'male' },
    { url: '/avatars/avatar-2.png', gender: 'female' },
    { url: '/avatars/avatar-3.png', gender: 'female' },
    { url: '/avatars/avatar-4.png', gender: 'male' },
  ];

  const generateReceiptPDF = async (apt: any) => {
    setIsGeneratingPDF(apt.id);
    try {
      const doc = new jsPDF();
      
      // Cores institucionais
      const primaryRed = [203, 30, 40]; // #cb1e28
      const grayText = [100, 116, 139];
      
      // Carregar Logo com dimensões
      const loadImage = (url: string): Promise<{ data: string, width: number, height: number }> => {
        return new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = 'Anonymous';
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            
            // Adicionamos um pequeno recorte (crop) de 5% para remover bordas indesejadas/marcas de corte
            const cropPercent = 0.05;
            const sx = img.width * cropPercent;
            const sy = img.height * cropPercent;
            const sWidth = img.width * (1 - 2 * cropPercent);
            const sHeight = img.height * (1 - 2 * cropPercent);
            
            canvas.width = sWidth;
            canvas.height = sHeight;
            
            ctx?.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);
            resolve({ 
              data: canvas.toDataURL('image/png'), 
              width: sWidth, 
              height: sHeight 
            });
          };
          img.onerror = () => resolve({ data: '', width: 0, height: 0 });
          img.src = url;
        });
      };

      const logo = await loadImage('/logo-cendap.png');
      
      // Header
      if (logo.data) {
        // Calcular aspect ratio para não deformar a logo
        const maxWidth = 50;
        const maxHeight = 25;
        let finalWidth = maxWidth;
        let finalHeight = (logo.height * maxWidth) / logo.width;

        if (finalHeight > maxHeight) {
          finalHeight = maxHeight;
          finalWidth = (logo.width * maxHeight) / logo.height;
        }

        doc.addImage(logo.data, 'PNG', 15, 12, finalWidth, finalHeight);
      } else {
        doc.setFontSize(22);
        doc.setTextColor(primaryRed[0], primaryRed[1], primaryRed[2]);
        doc.text('CENDAP', 15, 25);
      }

      // Dados da Clínica (Lado Direito)
      doc.setFontSize(9);
      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      doc.text('CNPJ: 10.695.431/0001-73', 195, 18, { align: 'right' });
      doc.text('WhatsApp: (91) 98109-7045', 195, 23, { align: 'right' });
      doc.text('Capitão Poço - PA', 195, 28, { align: 'right' });
      doc.text('Trav. José Barros da Silva, 806', 195, 33, { align: 'right' });

      // Linha Decorativa
      doc.setDrawColor(primaryRed[0], primaryRed[1], primaryRed[2]);
      doc.setLineWidth(0.5);
      doc.line(15, 40, 195, 40);
      
      doc.setFontSize(18);
      doc.setTextColor(0, 0, 0);
      doc.text('COMPROVANTE DE AGENDAMENTO', 105, 55, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      doc.text(`Protocolo: ${apt.id}`, 105, 62, { align: 'center' });

      // Tabela de Dados
      autoTable(doc, {
        startY: 75,
        theme: 'grid',
        head: [['Informação', 'Detalhes']],
        body: [
          ['Paciente', (apt.nome_paciente || profile?.full_name || 'Não informado').toUpperCase()],
          ['CPF', apt.cpf || 'Não informado'],
          ['Médico', formatDoctorName(apt.medico)],
          ['Especialidade', apt.especialidade || apt.tipo || 'Consulta'],
          ['Data da Consulta', formatDate(apt.data_consulta)],
          ['Horário', formatTime(apt.horario) || 'Ordem de Chegada'],
          ['Status', apt.status || 'Pendente'],
        ],
        headStyles: {
          fillColor: [primaryRed[0], primaryRed[1], primaryRed[2]],
          textColor: [255, 255, 255],
          fontSize: 12,
          fontStyle: 'bold'
        },
        bodyStyles: {
          fontSize: 11,
          textColor: [30, 41, 59]
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        columnStyles: {
          0: { cellWidth: 50, fontStyle: 'bold' }
        }
      });

      // Rodapé
      const finalY = (doc as any).lastAutoTable.finalY + 15;
      
      doc.setFontSize(10);
      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      doc.text('Informações e Instruções:', 15, finalY);
      
      doc.setFontSize(9);
      doc.text('1. Funcionamento: Segunda a sexta-feira, das 06:30 às 16:00.', 15, finalY + 7);
      doc.text('2. O atendimento é realizado por ordem de chegada na clínica.', 15, finalY + 12);
      doc.text('3. Este documento é apenas um comprovante de agendamento realizado pelo site oficial.', 15, finalY + 17);

      doc.setDrawColor(226, 232, 240);
      doc.line(15, 275, 195, 275);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Documento gerado em ${new Date().toLocaleString('pt-BR')} via agendacendap.com.br`, 105, 282, { align: 'center' });

      // Salvar
      doc.save(`Comprovante_CENDAP_${apt.id}.pdf`);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Erro ao gerar o comprovante. Tente novamente.');
    } finally {
      setIsGeneratingPDF(null);
    }
  };

  const formatCpfEdit = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
    if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`;
  };

  const GOOGLE_SHEETS_API = 'https://script.google.com/macros/s/AKfycbxXLDeq4DoUOWUlmAM4yWdnPDxyWPBbzFbOSoMRNlsavPJNvtiKWUzok8ed2RkzvcSY/exec';

  const fetchAppointments = async () => {
    // Normaliza o CPF para 11 dígitos com zeros à esquerda
    let cleanedCpf = (profile?.cpf || "").replace(/\D/g, "");
    if (cleanedCpf.length > 0) {
      cleanedCpf = cleanedCpf.padStart(11, '0');
    }

    if (!cleanedCpf || cleanedCpf.length !== 11) {
      console.warn("CPF inválido para busca:", cleanedCpf);
      setAppointments([]);
      return;
    }

    setIsLoadingAppointments(true);
    try {
      const response = await fetch(GOOGLE_SHEETS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'list_by_cpf', cpf: cleanedCpf })
      });
      const data = await response.json();
      if (data.result === 'success') {
        setAppointments(data.data || []);
      } else {
        console.error("Erro da API:", data.message);
        setAppointments([]);
      }
    } catch (err) {
      console.error("Erro ao buscar agendamentos:", err);
      setAppointments([]);
    } finally {
      setIsLoadingAppointments(false);
    }
  };

  const fetchDocuments = async () => {
    if (!user) return;
    setIsLoadingDocuments(true);
    try {
      const { data, error } = await supabase
        .from('issued_documents')
        .select('*')
        .eq('patient_id', user.id)
        .eq('status', 'signed')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setDocuments(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingDocuments(false);
    }
  };

  const handleCancelAppointment = async (id: string) => {
    if(!confirm("Deseja realmente cancelar este agendamento?")) return;
    
    // Update local state temporarily to reflect immediate feedback
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'Cancelado', isCancelling: true } : a));
    
    try {
        const response = await fetch(GOOGLE_SHEETS_API, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'cancel', id: id.trim() })
        });
        const data = await response.json();
        if (data.result !== 'success') {
             fetchAppointments(); // Revert
             alert('Erro ao cancelar. Tente novamente.');
        } else {
             setAppointments(prev => prev.map(a => a.id === id ? { ...a, isCancelling: false } : a));
        }
    } catch (e) {
        console.error(e);
        fetchAppointments(); // Revert
        alert('Erro ao cancelar. Tente novamente.');
    }
  };

  const handleEditClick = (apt: any) => {
      setEditingAptId(apt.id);
      setEditData({
          nome_paciente: apt.nome_paciente || '',
          telefone: apt.telefone || '',
          cpf: apt.cpf || ''
      });
  };

  const handleSaveEdit = async (id: string) => {
      setIsSavingEdit(true);
      try {
          const response = await fetch(GOOGLE_SHEETS_API, {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain;charset=utf-8' },
              body: JSON.stringify({
                  action: 'edit_patient_data',
                  id: id.trim(),
                  ...editData
              })
          });
          const data = await response.json();
          if (data.result === 'success') {
              setAppointments(prev => prev.map(a => a.id === id ? { ...a, nome: editData.nome_paciente, telefone: editData.telefone, cpf: editData.cpf } : a));
              setEditingAptId(null);
          } else {
              alert('Erro ao atualizar os dados.');
          }
      } catch (e) {
          console.error(e);
          alert('Erro de conexão ao salvar.');
      } finally {
          setIsSavingEdit(false);
      }
  };

  const handleSignOut = async () => {
    await signOut();
    onClose();
    window.location.assign('/login?logout=success');
  };

  const handleSaveAvatar = async (url: string) => {
    if (!user) return;
    setIsUpdatingAvatar(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: url })
        .eq('id', user.id);

      if (!error) {
        await refreshProfile();
        setActiveView('menu');
      } else {
        alert('Erro ao atualizar avatar: ' + error.message);
      }
    } catch (e) {
      console.error(e);
      alert('Erro ao conectar com o servidor.');
    } finally {
      setIsUpdatingAvatar(false);
    }
  };

  const formatPhone = (phone: string) => {
    if (!phone) return '';
    const cleaned = ('' + phone).replace(/\D/g, '');
    const match = cleaned.match(/^(\d{2})(\d{5})(\d{4})$/);
    if (match) {
      return `(${match[1]}) ${match[2]}-${match[3]}`;
    }
    return phone;
  };

  const checkIsFemale = (name: string | undefined) => {
    if (!name) return false;
    const firstName = name.trim().split(' ')[0].toLowerCase();
    
    const isFemale = 
      firstName.endsWith('a') || 
      firstName.endsWith('ieli') || 
      firstName.endsWith('elly') ||
      ['kelly', 'suely', 'thay', 'gaby', 'raquel', 'lais', 'ellen', 'yasmin', 'heloisa', 'beatriz', 'alice', 'iris', 'ruth', 'ester'].includes(firstName);

    const maleExceptions = ['luca', 'nicolas', 'wesley', 'sidney', 'vanderley', 'roney', 'darcy', 'amauri'];
    if (maleExceptions.includes(firstName)) return false;

    return isFemale;
  };

  const isUserFemale = checkIsFemale(profile?.full_name);

  const getAvatarImage = (name: string | undefined) => {
    // 0. Prioridade para o avatar escolhido no banco
    if (profile?.avatar_url) return profile.avatar_url;

    if (isUserFemale) return '/avatar-mulher.png';
    return '/avatar-homem.png';
  };

  const avatarUrl = getAvatarImage(profile?.full_name);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    // Se for formato ISO (contém 'T' ou '-')
    if (dateStr.includes('T') || (dateStr.includes('-') && dateStr.length > 10)) {
      try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        });
      } catch (e) {
        return dateStr;
      }
    }
    return dateStr;
  };

  const getStatusKey = (status: string | undefined) => {
    const s = status || 'Pendente';
    if (s === 'Aguardando Pagamento') return 'Aguardando';
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase().replace(/\s/g, '');
  };

  const formatDoctorName = (name: string | undefined) => {
    if (!name || name.trim() === '') return 'Médico a definir';
    const cleaned = name.trim();
    if (cleaned.toLowerCase().startsWith('dr') || cleaned.toLowerCase().startsWith('dra')) {
      return cleaned;
    }
    return `Dr(a). ${cleaned}`;
  };

  const formatTime = (timeStr: string | undefined) => {
    if (!timeStr) return '';
    // Se for formato ISO (ex: 1899-12-30T19:06:28.000Z)
    if (timeStr.includes('T')) {
      try {
        const date = new Date(timeStr);
        if (!isNaN(date.getTime())) {
          // Usamos getHours e getMinutes para pegar o horário local do navegador
          // Isso resolve o problema do offset histórico (LMT) de 1899 do Google Sheets
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          return `${hours}:${minutes}`;
        }
      } catch (e) {
        return timeStr;
      }
    }
    return timeStr;
  };

  return (
    <div className={styles.overlay} onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div className={styles.modalMobileContainer}>
        {/* Background Shapes (Medical Pattern) */}
        <div className={styles.bgShapes}>
          <svg viewBox="0 0 400 350" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
            {/* Cruzes Médicas */}
            <g stroke="rgba(255,255,255,0.15)" strokeWidth="3">
              <path d="M50,40 h12 m-6,-6 v12" />
              <path d="M350,120 h10 m-5,-5 v10" />
              <path d="M300,30 h8 m-4,-4 v8" />
              <path d="M40,250 h10 m-5,-5 v10" />
            </g>
            
            {/* Linhas de Batimento (ECG) */}
            <g fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="2">
              <path d="M120,50 l5,0 l3,-10 l5,20 l3,-10 l5,0" />
              <path d="M280,220 l4,0 l2,-8 l4,16 l2,-8 l4,0" />
            </g>

            {/* Cápsulas/Pílulas */}
            <g fill="rgba(255,255,255,0.1)">
              <rect x="330" y="50" width="20" height="10" rx="5" transform="rotate(35 340 55)" />
              <rect x="80" y="180" width="16" height="8" rx="4" transform="rotate(-20 88 184)" />
              <rect x="220" y="20" width="14" height="7" rx="3.5" transform="rotate(10 227 23.5)" />
            </g>
          </svg>
        </div>

        {/* Header */}
        <div className={styles.header}>
          {activeView !== 'menu' ? (
            <button className={styles.backButton} onClick={() => {
              if (activeView === 'appointment_detail') {
                setActiveView('appointments');
              } else if (activeView === 'avatar_selector') {
                setActiveView('menu');
              } else {
                setActiveView('menu');
              }
            }}>
              <ChevronLeft size={24} /> Voltar
            </button>
          ) : (
            <button className={styles.backButton} onClick={onClose}>
              <ChevronLeft size={24} /> Fechar
            </button>
          )}
        </div>
        
        {/* Profile Top Layer */}
        <div className={styles.profileTop}>
          <div className={styles.avatarWrapper} onClick={() => setActiveView('avatar_selector')}>
            <div className={styles.avatarInner}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <UserIcon size={48} strokeWidth={2} />
              )}
            </div>
            <div className={styles.avatarOverlay}>
              <Camera size={24} />
              <span>Trocar</span>
            </div>
          </div>
          <h2 className={styles.name}>
            {profile?.full_name ? profile.full_name : (
              <span style={{ fontSize: '0.9rem', opacity: 0.8, cursor: user ? 'pointer' : 'default' }} onClick={() => user && refreshProfile()}>
                {user ? 'Carregando perfil...' : 'Visitante'}
                {user && !profile && <span style={{ display: 'block', fontSize: '0.7rem', textDecoration: 'underline', marginTop: '4px' }}>Clique para atualizar</span>}
              </span>
            )}
          </h2>
          <span className={styles.role}>Paciente</span>
        </div>

        {/* Content Wrapper (Bottom Sheet) */}
        <div className={styles.contentWrapper}>
          
          {activeView === 'menu' ? (
            <>
              <button className={styles.menuItem} onClick={() => setActiveView('info')}>
                <div className={`${styles.menuIconWrapper} ${styles.iconPink}`}>
                  <UserIcon size={24} />
                </div>
                <span className={styles.menuText}>Dados Pessoais</span>
                <ChevronRight size={20} className={styles.chevron} />
              </button>

              <button className={styles.menuItem} onClick={() => {
                setActiveView('appointments');
                fetchAppointments();
              }}>
                <div className={`${styles.menuIconWrapper} ${styles.iconPurple}`}>
                  <CalendarDays size={24} />
                </div>
                <span className={styles.menuText}>Meus Agendamentos</span>
                <ChevronRight size={20} className={styles.chevron} />
              </button>

              <button className={styles.menuItem} onClick={() => {
                setActiveView('documents');
                fetchDocuments();
              }}>
                <div className={`${styles.menuIconWrapper} ${styles.iconBlue}`} style={{ background: '#eff6ff', color: '#3b82f6' }}>
                  <FileText size={24} />
                </div>
                <span className={styles.menuText}>Meus Documentos e Receitas</span>
                <ChevronRight size={20} className={styles.chevron} />
              </button>



              <button className={styles.menuItem} onClick={handleSignOut}>
                <div className={`${styles.menuIconWrapper} ${styles.iconGray}`}>
                  <LogOut size={24} />
                </div>
                <span className={styles.menuText}>Sair da conta</span>
                <ChevronRight size={20} className={styles.chevron} />
              </button>
            </>
          ) : activeView === 'info' ? (
            <div className={styles.infoCard}>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Nome Completo</span>
                <span className={styles.infoValue}>{profile?.full_name}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>CPF</span>
                <span className={styles.infoValue}>
                  {profile?.cpf?.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}
                </span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Telefone / WhatsApp</span>
                <span className={styles.infoValue}>{formatPhone(profile?.phone || '')}</span>
              </div>
              <button className={styles.editPhotoInfoBtn} onClick={() => setActiveView('avatar_selector')}>
                <Camera size={20} />
                Alterar Foto de Perfil
              </button>
            </div>
          ) : activeView === 'appointments' ? (
             <div className={styles.appointmentsList}>
                {isLoadingAppointments ? (
                  <div className={styles.loadingText}>Carregando agendamentos...</div>
                ) : (appointments && appointments.length > 0) ? (
                  appointments.map((apt, idx) => (
                    <div key={idx} className={`${styles.appointmentCard} ${styles['card' + getStatusKey(apt.status)]}`}>
                      {editingAptId === apt.id ? (
                        <div className={styles.editForm}>
                             <div className={styles.inputGroup}>
                                 <label>Nome do Paciente</label>
                                 <input value={editData.nome_paciente} onChange={(e) => setEditData({...editData, nome_paciente: e.target.value})} className={styles.input} />
                             </div>
                             <div className={styles.inputGroup}>
                                 <label>CPF</label>
                                 <input value={editData.cpf} onChange={(e) => setEditData({...editData, cpf: formatCpfEdit(e.target.value)})} maxLength={14} className={styles.input} />
                             </div>
                             <div className={styles.inputGroup}>
                                 <label>Telefone</label>
                                 <input value={editData.telefone} onChange={(e) => setEditData({...editData, telefone: e.target.value})} className={styles.input} />
                             </div>
                             <div className={styles.editActions}>
                                 <button onClick={() => setEditingAptId(null)} className={styles.cancelEditBtn} disabled={isSavingEdit}>Voltar</button>
                                 <button onClick={() => handleSaveEdit(apt.id)} className={styles.saveEditBtn} disabled={isSavingEdit}>
                                     {isSavingEdit ? 'Salvando...' : 'Salvar'}
                                 </button>
                             </div>
                        </div>
                      ) : (
                        <>
                          <div 
                            className={styles.appointmentClickArea}
                            onClick={() => {
                              setSelectedApt(apt);
                              setActiveView('appointment_detail');
                            }}
                          >
                            <div className={styles.appointmentHeader}>
                              <span className={styles.appointmentDate}>{formatDate(apt.data_consulta)} às {formatTime(apt.horario)}</span>
                              <span className={`${styles.statusBadge} ${styles['status' + getStatusKey(apt.status)]}`}>
                                {apt.status || 'Pendente'}
                              </span>
                            </div>
                            <h4 className={styles.appointmentDoctor}>{formatDoctorName(apt.medico)}</h4>
                            <p className={styles.appointmentSpecialty}>{apt.especialidade || apt.tipo}</p>
                          </div>
                          <div className={styles.appointmentFooter}>
                            <span className={styles.appointmentId}>ID: {apt.id}</span>
                            <div className={styles.actionButtons}>
                              {apt.status !== 'Cancelado' && !apt.isCancelling && (
                                  <>
                                    <button 
                                      className={styles.pdfBtn} 
                                      onClick={() => generateReceiptPDF(apt)}
                                      disabled={isGeneratingPDF === apt.id}
                                    >
                                      <FileText size={14} />
                                      {isGeneratingPDF === apt.id ? '...' : 'PDF'}
                                    </button>
                                    <button className={styles.editBtn} onClick={() => handleEditClick(apt)}>Editar</button>
                                    <button className={styles.cancelBtn} onClick={() => handleCancelAppointment(apt.id)}>Cancelar</button>
                                  </>
                              )}
                              {apt.tipo === 'Telemedicina' && apt.status !== 'Cancelado' && !apt.isCancelling && (
                                  <button 
                                      className={styles.pdfBtn} 
                                      onClick={async () => {
                                          try {
                                              const res = await fetch('/api/telemedicine/room', {
                                                  method: 'POST',
                                                  headers: { 'Content-Type': 'application/json' },
                                                  body: JSON.stringify({
                                                      appointmentId: apt.id,
                                                      patientId: user?.id,
                                                      doctorName: apt.medico,
                                                      appointmentDate: apt.data_consulta,
                                                      isDoctor: false
                                                  })
                                              });
                                              const data = await res.json();
                                              if (data.success && data.url) {
                                                  const urlWithToken = `${data.url}?t=${data.token}`;
                                                  window.open(urlWithToken, '_blank');
                                              } else {
                                                  alert('Erro ao entrar na sala: ' + data.error);
                                              }
                                          } catch(e) {
                                              console.error(e);
                                              alert('Erro ao conectar com servidor.');
                                          }
                                      }}
                                      style={{ backgroundColor: '#2563eb', color: 'white', border: 'none', gap: '4px' }}
                                  >
                                      <Camera size={14} /> Entrar na Sala
                                  </button>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                ) : (
                  <div className={styles.emptyState}>
                    <div className={styles.emptyIcon} style={{ fontSize: '3rem', marginBottom: '16px' }}>🔍</div>
                    <p style={{ fontWeight: 600, color: '#0f172a' }}>Nenhum agendamento encontrado.</p>
                  </div>
                )}
             </div>
          ) : activeView === 'appointment_detail' && selectedApt ? (
            <div className={styles.detailView}>
              <div className={`${styles.detailHeader} ${styles['card' + getStatusKey(selectedApt.status)]}`}>
                <div className={styles.detailIconWrapper}>
                  <CalendarDays size={32} />
                </div>
                <div className={styles.detailHeaderInfo}>
                  <h3 className={styles.detailTitle}>{formatDate(selectedApt.data_consulta)}</h3>
                  <p className={styles.detailSubtitle}>{formatTime(selectedApt.horario)}</p>
                </div>
                <span className={`${styles.statusBadge} ${styles['status' + getStatusKey(selectedApt.status)]}`}>
                  {selectedApt.status || 'Pendente'}
                </span>
              </div>

              <div className={styles.detailContent}>
                <div className={styles.detailItem}>
                  <div className={styles.detailItemIcon}>
                    <UserIcon size={20} />
                  </div>
                  <div className={styles.detailItemText}>
                    <span className={styles.detailLabel}>Paciente</span>
                    <span className={styles.detailValue}>{selectedApt.nome_paciente || profile?.full_name}</span>
                  </div>
                </div>

                <div className={styles.detailItem}>
                  <div className={styles.detailItemIcon}>
                    <Fingerprint size={20} />
                  </div>
                  <div className={styles.detailItemText}>
                    <span className={styles.detailLabel}>CPF</span>
                    <span className={styles.detailValue}>{selectedApt.cpf?.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") || 'Não informado'}</span>
                  </div>
                </div>

                <div className={styles.detailItem}>
                  <div className={styles.detailItemIcon}>
                    <Phone size={20} />
                  </div>
                  <div className={styles.detailItemText}>
                    <span className={styles.detailLabel}>WhatsApp</span>
                    <span className={styles.detailValue}>{formatPhone(selectedApt.telefone || '') || 'Não informado'}</span>
                  </div>
                </div>

                <div className={styles.detailItem}>
                  <div className={styles.detailItemIcon}>
                    <Stethoscope size={20} />
                  </div>
                  <div className={styles.detailItemText}>
                    <span className={styles.detailLabel}>Médico Responsável</span>
                    <span className={styles.detailValue}>
                      {formatDoctorName(selectedApt.medico)}
                    </span>
                  </div>
                </div>

                <div className={styles.detailItem}>
                  <div className={styles.detailItemIcon}>
                    <FileText size={20} />
                  </div>
                  <div className={styles.detailItemText}>
                    <span className={styles.detailLabel}>Especialidade / Procedimento</span>
                    <span className={styles.detailValue}>{selectedApt.especialidade || selectedApt.tipo}</span>
                  </div>
                </div>

                {selectedApt.cupom && (
                  <div className={`${styles.detailItem} ${styles.couponItem}`}>
                    <div className={`${styles.detailItemIcon} ${styles.couponIcon}`}>
                      <TicketPercent size={20} />
                    </div>
                    <div className={styles.detailItemText}>
                      <span className={styles.detailLabel}>Cupom de Desconto</span>
                      <span className={styles.detailValue}>{selectedApt.cupom}</span>
                    </div>
                  </div>
                )}

                <div className={styles.detailItem}>
                  <div className={styles.detailItemIcon}>
                    <Hash size={20} />
                  </div>
                  <div className={styles.detailItemText}>
                    <span className={styles.detailLabel}>ID da Solicitação</span>
                    <span className={styles.detailValue}>{selectedApt.id}</span>
                  </div>
                </div>
              </div>

              <button 
                className={styles.pdfBtnFull} 
                onClick={() => generateReceiptPDF(selectedApt)}
                disabled={isGeneratingPDF === selectedApt.id}
              >
                <FileText size={20} />
                {isGeneratingPDF === selectedApt.id ? 'Gerando comprovante...' : 'Baixar Comprovante em PDF'}
              </button>
            </div>
          ) : activeView === 'avatar_selector' ? (
            <div className={styles.avatarSelectorView}>
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', color: '#1e293b' }}>Escolha sua foto</h3>
              <p style={{ margin: '0 0 1.5rem', fontSize: '0.9rem', color: '#64748b' }}>Selecione uma das opções abaixo para o seu perfil:</p>
              
              <div className={styles.avatarSelectorGrid}>
                {AVAILABLE_AVATARS
                  .filter(av => isUserFemale ? av.gender === 'female' : av.gender === 'male')
                  .map((av, idx) => (
                    <div 
                      key={idx} 
                      className={`${styles.avatarOption} ${avatarUrl === av.url ? styles.avatarOptionActive : ''}`}
                      onClick={() => handleSaveAvatar(av.url)}
                    >
                      <img src={av.url} alt={`Avatar ${idx}`} />
                      {isUpdatingAvatar && avatarUrl === av.url && (
                        <div className={styles.avatarLoadingOverlay}>
                          <div className="spinner">...</div>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ) : activeView === 'documents' ? (
             <div className={styles.appointmentsList}>
                {isLoadingDocuments ? (
                  <div className={styles.loadingText}>Carregando documentos...</div>
                ) : documents.length > 0 ? (
                  documents.map((doc, idx) => (
                    <div key={idx} className={`${styles.appointmentCard} ${styles.cardConfirmado}`}>
                      <div className={styles.appointmentHeader}>
                        <span className={styles.appointmentDate}>{formatDate(doc.created_at)}</span>
                        <span className={`${styles.statusBadge} ${styles.statusConfirmado}`}>
                          Assinado
                        </span>
                      </div>
                      <h4 className={styles.appointmentDoctor}>
                         {doc.type === 'prescription' ? 'Receita Médica' : doc.type === 'exam' ? 'Pedido de Exame' : 'Atestado'}
                      </h4>
                      <div className={styles.appointmentFooter} style={{ marginTop: '12px' }}>
                         <button 
                             className={styles.pdfBtnFull} 
                             onClick={() => window.open(doc.document_url, '_blank')}
                             style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                         >
                            <Download size={16} /> Baixar PDF
                         </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className={styles.emptyState}>
                    Nenhum documento assinado disponível no momento.
                  </div>
                )}
             </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
