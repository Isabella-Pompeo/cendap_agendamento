'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import styles from './ProfileModal.module.css';
import { ChevronLeft, ChevronRight, User as UserIcon, CalendarDays, FileText, Settings, LogOut, Info, ShieldCheck, Phone, Fingerprint, Stethoscope, Hash, TicketPercent, Download, Camera, Upload, Trash2, Paperclip, ImageIcon } from 'lucide-react';
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

  useEffect(() => {
    if (user) {
      fetchAppointments();
    }
  }, [user]);

  const [activeView, setActiveView] = useState<'menu' | 'info' | 'appointments' | 'appointment_detail' | 'avatar_selector' | 'documents' | 'exams'>('menu');
  const [selectedApt, setSelectedApt] = useState<any | null>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(false);
  
  const [documents, setDocuments] = useState<any[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  
  const [exams, setExams] = useState<any[]>([]);
  const [isLoadingExams, setIsLoadingExams] = useState(false);
  const [isUploadingExam, setIsUploadingExam] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
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

    // Formata o CPF para o padrão da planilha (XXX.XXX.XXX-XX)
    const formattedCpf = cleanedCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");

    setIsLoadingAppointments(true);
    try {
      // 1. Promessa da Planilha com Timeout de 5 segundos
      const fetchWithTimeout = async (url: string, options: any, timeout = 5000) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        try {
          const response = await fetch(url, { ...options, signal: controller.signal });
          clearTimeout(id);
          return await response.json();
        } catch (e) {
          clearTimeout(id);
          console.warn("Sheets fetch timed out or failed");
          return { result: 'error' };
        }
      };

      const sheetPromise = fetchWithTimeout(GOOGLE_SHEETS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'list_by_cpf', cpf: formattedCpf })
      });

      // 2. Busca no Supabase (Telemedicina)
      const supabasePromise = user ? supabase
        .from('consultations')
        .select('*, payments(status)')
        .eq('patient_id', user.id)
        .order('created_at', { ascending: false }) : Promise.resolve({ data: [] });

      const [sheetData, supabaseResult] = await Promise.all([sheetPromise, supabasePromise]);
      
      let mergedAppointments: any[] = [];

      // Função de normalização ultra-agressiva
      const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

      // 1. Processa dados do Supabase PRIMEIRO (eles são a prioridade pois têm botões de ação)
      const supabaseData = (supabaseResult as any).data || [];
      supabaseData.forEach((cons: any) => {
        mergedAppointments.push({
          id: cons.id,
          nome_paciente: profile?.full_name,
          cpf: formattedCpf,
          medico: cons.doctor_name,
          data_consulta: cons.appointment_date || new Date().toISOString(),
          horario: cons.appointment_date || new Date().toISOString(),
          tipo: 'Telemedicina',
          status: (cons.status === 'scheduled' || cons.status === 'in_progress') ? 'Confirmado' : 
                  cons.status === 'completed' ? 'Realizado' : 
                  (cons.payments?.status === 'approved') ? 'Confirmado' : 'Pendente',
          pagamento: cons.payment_id,
          isFromSupabase: true
        });
      });

      // 2. Processa dados da planilha e ADICIONA apenas se não houver duplicata no banco
      if (sheetData.result === 'success' && sheetData.data) {
        sheetData.data.forEach((sheetApt: any) => {
          const sRawDate = (sheetApt.data_consulta || "").trim();
          const sParts = sRawDate.split(/[\/\-]/);
          let sDay = "", sMonth = "", sYear = "";
          
          if (sParts.length >= 3) {
            if (sParts[0].length === 4) { 
              sYear = sParts[0]; sMonth = sParts[1].padStart(2, '0'); sDay = sParts[2].padStart(2, '0');
            } else { 
              sDay = sParts[0].padStart(2, '0'); sMonth = sParts[1].padStart(2, '0'); sYear = sParts[2];
            }
          }
          const sheetKey = `${sDay}${sMonth}${sYear}`;
          const sheetDoc = normalize(sheetApt.medico || "").replace(/^dr/g, "");

          const existingApt = mergedAppointments.find(dbApt => {
            // 1. Verificação Mestra: ID de Pagamento
            if (dbApt.pagamento && sheetApt.pagamento && dbApt.pagamento === sheetApt.pagamento) return true;

            // 2. Verificação de Reforço: Data e Médico
            let dbDay = "", dbMonth = "", dbYear = "";
            if (dbApt.data_consulta) {
              const d = new Date(dbApt.data_consulta);
              dbDay = String(d.getDate()).padStart(2, '0');
              dbMonth = String(d.getMonth() + 1).padStart(2, '0');
              dbYear = String(d.getFullYear());
            }
            const dbKey = `${dbDay}${dbMonth}${dbYear}`;
            const dbDoc = normalize(dbApt.medico || "").replace(/^dr/g, "");

            const sameDate = sheetKey === dbKey;
            const sameDoctor = sheetDoc.includes(dbDoc) || dbDoc.includes(sheetDoc);
            const isDrAndre = (sheetDoc.includes("andre") || dbDoc.includes("andre"));
            
            return sameDate && (sameDoctor || isDrAndre);
          });

          if (existingApt) {
            // SE ENCONTROU DUPLICATA: Se a planilha diz que está Pago, atualiza o status do banco
            if (sheetApt.status === 'Pago' || sheetApt.status === 'Confirmado') {
              existingApt.status = sheetApt.status;
            }
          } else {
            // Se não é duplicata, adiciona normalmente
            mergedAppointments.push(sheetApt);
          }
        });
      }

      // 3. PENTE FINO FINAL: Remove duplicatas da lista já mesclada
      const finalAppointments: any[] = [];
      const seenKeys = new Set();

      mergedAppointments.forEach(apt => {
        const d = new Date(apt.data_consulta);
        const dateKey = isNaN(d.getTime()) ? apt.data_consulta : `${d.getDate()}${d.getMonth()+1}${d.getFullYear()}`;
        const docKey = normalize(apt.medico || "").replace(/^dr/g, "");
        const compositeKey = `${dateKey}-${docKey}`;

        if (!seenKeys.has(compositeKey)) {
          finalAppointments.push(apt);
          seenKeys.add(compositeKey);
        } else if (apt.isFromSupabase) {
          // Se já vimos esse dia/médico mas o atual é do Supabase, substitui o anterior
          const idx = finalAppointments.findIndex(a => {
            const ad = new Date(a.data_consulta);
            const adKey = isNaN(ad.getTime()) ? a.data_consulta : `${ad.getDate()}${ad.getMonth()+1}${ad.getFullYear()}`;
            const adDoc = normalize(a.medico || "").replace(/^dr/g, "");
            return adKey === dateKey && adDoc === docKey;
          });
          if (idx !== -1) finalAppointments[idx] = apt;
        }
      });

      // Ordena por data (mais recente primeiro)
      finalAppointments.sort((a, b) => {
        const parseDate = (d: string) => {
          if (!d) return 0;
          if (d.includes('T') || d.includes('-')) return new Date(d).getTime();
          if (d.includes('/')) {
            const [day, month, year] = d.split('/');
            return new Date(`${year}-${month}-${day}T12:00:00`).getTime();
          }
          return 0;
        };
        return parseDate(b.data_consulta) - parseDate(a.data_consulta);
      });

      setAppointments(finalAppointments);
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

  const fetchExams = async () => {
    if (!user) return;
    setIsLoadingExams(true);
    try {
      const { data, error } = await supabase
        .from('patient_uploads')
        .select('*')
        .eq('patient_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setExams(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingExams(false);
    }
  };

  const handleUploadExam = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Formatos aceitos: PNG, JPEG, PDF
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      alert('Formato não suportado. Por favor, envie arquivos PDF, PNG ou JPEG.');
      return;
    }

    setIsUploadingExam(true);
    setUploadProgress(10);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('patient-exams')
        .upload(fileName, file);

      if (uploadError) throw uploadError;
      setUploadProgress(60);

      const { data: urlData } = supabase.storage
        .from('patient-exams')
        .getPublicUrl(fileName);

      const { data: uploadDataResult, error: dbError } = await supabase
        .from('patient_uploads')
        .insert({
          patient_id: user.id,
          patient_cpf: profile?.cpf,
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_type: file.type
        })
        .select()
        .single();

      if (dbError) throw dbError;

      setUploadProgress(100);
      setTimeout(() => {
        setIsUploadingExam(false);
        setUploadProgress(0);
        fetchExams();
      }, 500);
    } catch (error: any) {
      console.error('Erro no upload:', error);
      alert('Erro ao enviar exame: ' + error.message);
      setIsUploadingExam(false);
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const handleDeleteExam = async (exam: any) => {
    if (!confirm('Tem certeza que deseja excluir este exame?')) return;

    try {
      // Extrair o path relativo do Storage da URL pública
      // A URL segue o padrão: .../storage/v1/object/public/patient-exams/USER_ID/FILENAME
      const urlParts = exam.file_url.split('/');
      const fileName = urlParts.pop();
      const userId = urlParts.pop();
      const storagePath = `${userId}/${fileName}`;

      const { error: storageError } = await supabase.storage
        .from('patient-exams')
        .remove([storagePath]);

      if (storageError) console.error('Erro ao deletar do storage:', storageError);

      const { error: dbError } = await supabase
        .from('patient_uploads')
        .delete()
        .eq('id', exam.id);

      if (dbError) throw dbError;

      fetchExams();
    } catch (e: any) {
      console.error(e);
      alert('Erro ao excluir exame: ' + e.message);
    }
  };

  const handleCancelAppointment = async (id: string) => {
    if(!confirm("Deseja realmente cancelar este agendamento?")) return;
    
    const apt = appointments.find(a => a.id === id);
    if (!apt) return;

    // Update local state temporarily to reflect immediate feedback
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'Cancelado', isCancelling: true } : a));
    
    try {
        if (apt.isFromSupabase) {
          // 1. Atualiza no Supabase
          const { error } = await supabase
            .from('consultations')
            .update({ status: 'cancelled' })
            .eq('id', id);

          if (error) throw error;
        }

        // 2. Tenta atualizar na planilha (seja de onde for)
        const response = await fetch(GOOGLE_SHEETS_API, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'cancel', id: id.trim() })
        });
        const data = await response.json();
        
        // Se falhou na planilha mas é do banco, a gente ainda considera sucesso no banco
        if (data.result !== 'success' && !apt.isFromSupabase) {
             fetchAppointments(); // Revert
             alert('Erro ao cancelar na planilha. Tente novamente.');
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
      const apt = appointments.find(a => a.id === id);
      try {
          if (apt?.isFromSupabase) {
              // No Supabase só podemos editar os dados do perfil ou se houver campos específicos na consulta
              // Por enquanto, atualizamos o status/logs se necessário ou apenas refletimos que a edição foi tentada
              // Na prática, dados do paciente (nome/cpf/tel) vêm do perfil do Supabase, não da consulta.
              console.log("Edição de consulta do Supabase disparada");
          }

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
          if (data.result === 'success' || apt?.isFromSupabase) {
              setAppointments(prev => prev.map(a => a.id === id ? { ...a, nome_paciente: editData.nome_paciente, telefone: editData.telefone, cpf: editData.cpf } : a));
              setEditingAptId(null);
          } else {
              alert('Erro ao atualizar os dados na planilha.');
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
    if (s === 'Em Andamento') return 'EmAndamento';
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
          <span className={styles.role}>
            {user?.email === '67224504220@paciente.cendap.com.br' ? 'Médico' : 'Paciente'}
          </span>
        </div>

        {/* Content Wrapper (Bottom Sheet) */}
        <div className={styles.contentWrapper}>
          
          {activeView === 'menu' ? (
            <>
              {user?.email === '67224504220@paciente.cendap.com.br' && (
                <button className={styles.menuItem} onClick={() => window.location.href = '/doctor-panel'} style={{ border: '2px solid #8b5cf6', background: '#fefaff', marginBottom: '16px' }}>
                  <div className={`${styles.menuIconWrapper} ${styles.iconPurple}`} style={{ background: '#f5f3ff', color: '#8b5cf6' }}>
                    <Stethoscope size={24} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1 }}>
                     <span className={styles.menuText} style={{ fontWeight: 800, color: '#6d28d9', margin: 0, paddingLeft: 0 }}>Painel de Telemedicina</span>
                     <span style={{ fontSize: '0.75rem', color: '#8b5cf6', marginTop: '2px' }}>Acessar suas consultas e salas</span>
                  </div>
                  <ChevronRight size={20} className={styles.chevron} style={{ color: '#8b5cf6' }} />
                </button>
              )}

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
                <div className={`${styles.menuIconWrapper} ${styles.iconPurple}`}>
                  <FileText size={24} />
                </div>
                <span className={styles.menuText}>Meus Documentos</span>
                <ChevronRight size={20} className={styles.chevron} />
              </button>

              {appointments.some(apt => apt.tipo === 'Telemedicina') && (
                <button className={styles.menuItem} onClick={() => {
                  setActiveView('exams');
                  fetchExams();
                }}>
                  <div className={`${styles.menuIconWrapper} ${styles.iconPink}`}>
                    <Paperclip size={24} />
                  </div>
                  <span className={styles.menuText}>Meus Exames</span>
                  <ChevronRight size={20} className={styles.chevron} />
                </button>
              )}



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
                                <>
                                  <button 
                                      className={styles.attachExamsShortcut}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveView('exams');
                                        fetchExams();
                                      }}
                                  >
                                      <Paperclip size={14} className={styles.attachExamsIcon} /> Anexar Exames
                                  </button>
                                  <button 
                                      className={styles.roomBtn} 
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
                                  >
                                      <Camera size={14} /> Entrar na Sala
                                  </button>
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
            <div className={styles.detailView}>
              <div className={styles.detailHeader}>
                <div className={`${styles.detailIconWrapper} ${styles.iconPurple}`}>
                  <FileText size={24} />
                </div>
                <div className={styles.detailHeaderInfo}>
                  <h3 className={styles.detailTitle}>Meus Documentos</h3>
                  <p className={styles.detailSubtitle}>Receitas e Pedidos de Exames</p>
                </div>
              </div>

              {isLoadingDocuments ? (
                <p className={styles.loadingText}>Carregando documentos...</p>
              ) : documents.length === 0 ? (
                <div className={styles.emptyState}>
                  <p>Nenhum documento assinado encontrado.</p>
                </div>
              ) : (
                <div className={styles.appointmentsList}>
                  {documents.map((doc) => (
                    <div key={doc.id} className={styles.appointmentCard}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span className={styles.appointmentDate}>
                            {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                          </span>
                          <h4 className={styles.appointmentDoctor} style={{ textTransform: 'uppercase', fontSize: '0.9rem', marginTop: '4px' }}>
                            {doc.type === 'prescription' ? 'Receita Médica' : 'Pedido de Exame'}
                          </h4>
                        </div>
                        <a href={doc.document_url} target="_blank" rel="noopener noreferrer" className={styles.pdfBtn}>
                          <Download size={16} /> Ver PDF
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : activeView === 'exams' ? (
            <div className={styles.detailView}>
              <div className={styles.detailHeader}>
                <div className={`${styles.detailIconWrapper} ${styles.iconPink}`}>
                  <Paperclip size={24} />
                </div>
                <div className={styles.detailHeaderInfo}>
                  <h3 className={styles.detailTitle}>Meus Exames</h3>
                  <p className={styles.detailSubtitle}>Envie seus exames para o médico</p>
                </div>
              </div>

              <div className={styles.examUploadArea} onClick={() => document.getElementById('exam-upload')?.click()}>
                <div className={styles.examUploadIcon}>
                  <Upload size={32} />
                </div>
                <div className={styles.examUploadText}>
                  <h4>Clique para enviar</h4>
                  <p>Formatos aceitos: PDF, PNG ou JPEG</p>
                </div>
                <input 
                  id="exam-upload"
                  type="file" 
                  accept="application/pdf,image/png,image/jpeg"
                  style={{ display: 'none' }}
                  onChange={handleUploadExam}
                  disabled={isUploadingExam}
                />
                {isUploadingExam && (
                  <div className={styles.uploadProgress}>
                    <div className={styles.uploadProgressBar} style={{ width: `${uploadProgress}%` }}></div>
                  </div>
                )}
              </div>

              <div style={{ marginTop: '1.5rem' }}>
                <h4 style={{ fontSize: '0.9rem', color: '#475569', fontWeight: 700, marginBottom: '0.5rem' }}>Exames Enviados:</h4>
                
                {isLoadingExams ? (
                  <p className={styles.loadingText}>Carregando seus exames...</p>
                ) : exams.length === 0 ? (
                  <div className={styles.emptyState}>
                    <p>Você ainda não enviou nenhum exame.</p>
                  </div>
                ) : (
                  <div className={styles.examList}>
                    {exams.map((exam) => (
                      <div key={exam.id} className={styles.examItem}>
                        <div className={`${styles.examItemIcon} ${exam.file_type?.includes('pdf') ? styles.examPdfIcon : styles.examImageIcon}`}>
                          {exam.file_type?.includes('pdf') ? <FileText size={20} /> : <ImageIcon size={20} />}
                        </div>
                        <div className={styles.examItemInfo}>
                          <span className={styles.examItemName}>{exam.file_name}</span>
                          <span className={styles.examItemDate}>{new Date(exam.created_at).toLocaleDateString('pt-BR')}</span>
                        </div>
                        <div className={styles.examItemActions}>
                          <a href={exam.file_url} target="_blank" rel="noopener noreferrer" className={styles.examActionBtn} title="Visualizar">
                            <Download size={16} />
                          </a>
                          <button className={`${styles.examActionBtn} ${styles.examDeleteBtn}`} onClick={() => handleDeleteExam(exam)} title="Excluir">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
