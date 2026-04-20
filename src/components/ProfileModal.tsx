'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import styles from './ProfileModal.module.css';
import { ChevronLeft, ChevronRight, User as UserIcon, CalendarDays, FileText, Settings, LogOut, Info, ShieldCheck, Phone, Fingerprint, Stethoscope, Hash, TicketPercent } from 'lucide-react';

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

  const [activeView, setActiveView] = useState<'menu' | 'info' | 'appointments' | 'appointment_detail'>('menu');
  const [selectedApt, setSelectedApt] = useState<any | null>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(false);
  
  // Edit states
  const [editingAptId, setEditingAptId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ nome_paciente: '', telefone: '', cpf: '' });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const formatCpfEdit = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
    if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`;
  };

  const GOOGLE_SHEETS_API = 'https://script.google.com/macros/s/AKfycbxXLDeq4DoUOWUlmAM4yWdnPDxyWPBbzFbOSoMRNlsavPJNvtiKWUzok8ed2RkzvcSY/exec';

  const fetchAppointments = async () => {
    if (!profile?.cpf) return;
    setIsLoadingAppointments(true);
    try {
      const response = await fetch(GOOGLE_SHEETS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'list_by_cpf', cpf: profile.cpf })
      });
      const data = await response.json();
      if (data.result === 'success') {
        setAppointments(data.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingAppointments(false);
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
          nome_paciente: apt.nome || '',
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

  const formatPhone = (phone: string) => {
    if (!phone) return '';
    const cleaned = ('' + phone).replace(/\D/g, '');
    const match = cleaned.match(/^(\d{2})(\d{5})(\d{4})$/);
    if (match) {
      return `(${match[1]}) ${match[2]}-${match[3]}`;
    }
    return phone;
  };

  const getAvatarImage = (name: string | undefined) => {
    if (!name) return null;
    const firstName = name.trim().split(' ')[0].toLowerCase();
    
    // Heurística de gênero baseada no nome (padrão Brasil)
    // 1. Nomes femininos: geralmente terminam em 'a', 'ieli', 'elly' ou estão em lista específica
    const isFemale = 
      firstName.endsWith('a') || 
      firstName.endsWith('ieli') || 
      firstName.endsWith('elly') ||
      ['kelly', 'suely', 'thay', 'gaby', 'raquel', 'lais', 'ellen', 'yasmin', 'heloisa', 'beatriz', 'alice', 'iris', 'ruth', 'ester'].includes(firstName);

    // 2. Exceções masculinas que poderiam cair na regra acima (ex: Luca) ou nomes comuns em 'y'
    const maleExceptions = ['luca', 'nicolas', 'wesley', 'sidney', 'vanderley', 'roney', 'darcy', 'amauri'];
    if (maleExceptions.includes(firstName)) return '/avatar-homem.png';

    if (isFemale) return '/avatar-mulher.png';
    
    // 3. Caso padrão (masculino)
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
    // Remove espaços e garante o formato TitleCase (ex: "Confirmado")
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase().replace(/\s/g, '');
  };

  return (
    <div className={styles.overlay} onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div className={styles.modalMobileContainer}>
        {/* Background Shapes */}
        <div className={styles.bgShapes}>
          <svg viewBox="0 0 400 350" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="350" cy="40" r="120" fill="rgba(255, 255, 255, 0.08)" />
            <circle cx="20" cy="180" r="80" fill="rgba(255, 255, 255, 0.04)" />
            <path d="M0,250 Q150,320 400,200 L400,0 L0,0 Z" fill="rgba(0, 0, 0, 0.05)" />
            <circle cx="200" cy="60" r="180" fill="rgba(255, 255, 255, 0.03)" />
          </svg>
        </div>

        {/* Header */}
        <div className={styles.header}>
          {activeView !== 'menu' ? (
            <button className={styles.backButton} onClick={() => {
              if (activeView === 'appointment_detail') {
                setActiveView('appointments');
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
          <div className={styles.avatarWrapper}>
            <div className={styles.avatarInner}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <UserIcon size={48} strokeWidth={2} />
              )}
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
            </div>
          ) : activeView === 'appointments' ? (
             <div className={styles.appointmentsList}>
                {isLoadingAppointments ? (
                  <div className={styles.loadingText}>Carregando agendamentos...</div>
                ) : appointments.length > 0 ? (
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
                              <span className={styles.appointmentDate}>{formatDate(apt.data_consulta)} às {apt.horario}</span>
                              <span className={`${styles.statusBadge} ${styles['status' + getStatusKey(apt.status)]}`}>
                                {apt.status || 'Pendente'}
                              </span>
                            </div>
                            <h4 className={styles.appointmentDoctor}>{(apt.medico && apt.medico.trim() !== '') ? `Dr(a). ${apt.medico}` : 'Médico a definir'}</h4>
                            <p className={styles.appointmentSpecialty}>{apt.especialidade || apt.tipo}</p>
                          </div>
                          <div className={styles.appointmentFooter}>
                            <span className={styles.appointmentId}>ID: {apt.id}</span>
                            <div className={styles.actionButtons}>
                              {apt.status !== 'Cancelado' && !apt.isCancelling && (
                                  <>
                                    <button className={styles.editBtn} onClick={() => handleEditClick(apt)}>Editar</button>
                                    <button className={styles.cancelBtn} onClick={() => handleCancelAppointment(apt.id)}>Cancelar</button>
                                  </>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                ) : (
                  <div className={styles.emptyState}>
                    Nenhum agendamento encontrado para este CPF.
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
                  <p className={styles.detailSubtitle}>{selectedApt.horario}</p>
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
                    <span className={styles.detailValue}>{selectedApt.nome || profile?.full_name}</span>
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
                      {(selectedApt.medico && selectedApt.medico.trim() !== '') ? `Dr(a). ${selectedApt.medico}` : 'Médico a definir'}
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
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
