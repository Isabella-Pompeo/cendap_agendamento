'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import styles from './ProfileModal.module.css';
import { ChevronLeft, ChevronRight, User as UserIcon, CalendarDays, FileText, LogOut, Phone, Fingerprint, Stethoscope, Hash, TicketPercent, Download, Camera, Upload, Trash2, Paperclip, ImageIcon, BarChart3, Video, MessageCircle, Bell } from 'lucide-react';
import { supabase } from '../lib/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ProfileModalProps {
  onClose: () => void;
}

const ROOM_ACCESS_EARLY_MINUTES = 5;
const MISSED_TELEMEDICINE_TOLERANCE_MINUTES = 30;
const STALE_IN_PROGRESS_TELEMEDICINE_MINUTES = 120;
const CLINIC_WHATSAPP_PHONE = '5591981097045';
const MAX_EXAM_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_EXAM_SOURCE_BYTES = 30 * 1024 * 1024;
const APPOINTMENT_NOTIFICATIONS_KEY = 'cendapAppointmentNotificationsEnabled';

const getAppointmentNotificationsEnabled = () => {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(APPOINTMENT_NOTIFICATIONS_KEY) === 'true';
};

const setAppointmentNotificationsEnabled = (enabled: boolean) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(APPOINTMENT_NOTIFICATIONS_KEY, enabled ? 'true' : 'false');
};

const getBrowserNotificationPermission = (): 'default' | 'granted' | 'denied' | 'unsupported' => {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
};

const parseAppointmentDateTime = (dateValue: string | undefined | null, timeValue?: string | undefined | null) => {
  const rawDate = String(dateValue || '').trim();
  const rawTime = String(timeValue || '').trim();

  if (!rawDate) return null;

  const isoDateTimeMatch = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})T/);
  if (isoDateTimeMatch) {
    const date = new Date(rawDate);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  let year = '';
  let month = '';
  let day = '';

  const isoDateMatch = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDateMatch) {
    year = isoDateMatch[1];
    month = isoDateMatch[2];
    day = isoDateMatch[3];
  } else {
    const brDateMatch = rawDate.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (brDateMatch) {
      day = brDateMatch[1].padStart(2, '0');
      month = brDateMatch[2].padStart(2, '0');
      year = brDateMatch[3];
    }
  }

  if (!year || !month || !day) {
    const months: Record<string, string> = {
      janeiro: '01',
      fevereiro: '02',
      marco: '03',
      abril: '04',
      maio: '05',
      junho: '06',
      julho: '07',
      agosto: '08',
      setembro: '09',
      outubro: '10',
      novembro: '11',
      dezembro: '12',
    };
    const normalizedDate = rawDate
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const longPtDateMatch = normalizedDate.match(/(\d{1,2})\s*de\s*([a-z]+)\s*de\s*(\d{4})/);

    if (longPtDateMatch && months[longPtDateMatch[2]]) {
      day = longPtDateMatch[1].padStart(2, '0');
      month = months[longPtDateMatch[2]];
      year = longPtDateMatch[3];
    }
  }

  if (!year || !month || !day) return null;

  const timeMatch = (rawTime || rawDate).match(/(\d{1,2}):(\d{2})/);
  const hours = timeMatch ? timeMatch[1].padStart(2, '0') : '00';
  const minutes = timeMatch ? timeMatch[2] : '00';
  const date = new Date(`${year}-${month}-${day}T${hours}:${minutes}:00`);

  return Number.isNaN(date.getTime()) ? null : date;
};

const getRoomAccessInfo = (appointment: any) => {
  if (appointment?.raw_status === 'in_progress') {
    return { canEnter: true, availableAtText: '' };
  }

  const appointmentDate = parseAppointmentDateTime(appointment?.data_consulta, appointment?.horario);

  if (!appointmentDate) {
    return { canEnter: true, availableAtText: '' };
  }

  const availableAt = new Date(appointmentDate.getTime() - ROOM_ACCESS_EARLY_MINUTES * 60 * 1000);
  const canEnter = Date.now() >= availableAt.getTime();

  return {
    canEnter,
    availableAtText: availableAt.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
};

const isTelemedicineMissedByDoctor = (appointment: any) => {
  if (appointment?.tipo !== 'Telemedicina') return false;

  const rawStatus = String(appointment?.raw_status || '').toLowerCase();
  const displayStatus = String(appointment?.status || '').toLowerCase();
  const closedStatuses = ['completed', 'cancelled', 'realizado', 'cancelado'];

  if (closedStatuses.some((status) => rawStatus === status || displayStatus === status)) {
    return false;
  }

  const appointmentDate = parseAppointmentDateTime(appointment?.data_consulta, appointment?.horario);
  if (!appointmentDate) return false;

  const isInProgress = rawStatus === 'in_progress' || displayStatus === 'em andamento';
  const statusUpdatedAt = appointment?.updated_at ? new Date(appointment.updated_at) : null;
  const inProgressReferenceDate = statusUpdatedAt && !Number.isNaN(statusUpdatedAt.getTime())
    ? statusUpdatedAt
    : appointmentDate;
  const toleranceMinutes = isInProgress
    ? STALE_IN_PROGRESS_TELEMEDICINE_MINUTES
    : MISSED_TELEMEDICINE_TOLERANCE_MINUTES;
  const missedAfter = (isInProgress ? inProgressReferenceDate : appointmentDate).getTime() + toleranceMinutes * 60 * 1000;

  return Date.now() > missedAfter;
};

const getAppointmentDisplayStatus = (appointment: any) => {
  if (isTelemedicineMissedByDoctor(appointment)) return 'Não atendida';
  if (appointment?.raw_status === 'in_progress') return 'Em Andamento';
  return appointment?.status || 'Pendente';
};

const buildTelemedicineSupportUrl = (appointment: any, patientName?: string) => {
  const appointmentDate = parseAppointmentDateTime(appointment?.data_consulta, appointment?.horario);
  const dateText = [
    appointmentDate
      ? appointmentDate.toLocaleDateString('pt-BR')
      : String(appointment?.data_consulta || '').trim(),
    appointment?.horario ? formatTimeForSupport(appointment.horario) : '',
  ].filter(Boolean).join(' as ');

  const message = [
    'Olá, preciso de suporte com uma consulta de telemedicina.',
    patientName ? `Paciente: ${patientName}` : '',
    appointment?.medico ? `Médico: ${appointment.medico}` : '',
    dateText ? `Data/horário: ${dateText}` : '',
    appointment?.id ? `ID: ${appointment.id}` : '',
    'A consulta passou do horário e ainda não fui atendido.',
  ].filter(Boolean).join('\n');

  return `https://api.whatsapp.com/send/?phone=${CLINIC_WHATSAPP_PHONE}&text=${encodeURIComponent(message)}&type=phone_number&app_absent=0`;
};

const formatTimeForSupport = (timeStr: string | undefined) => {
  if (!timeStr) return '';
  if (timeStr.includes('T')) {
    const date = new Date(timeStr);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
  }
  return timeStr;
};

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

  const { session, user, profile, signOut, refreshProfile } = useAuth();
  const isDoctorProfile = user?.email === '67224504220@paciente.cendap.com.br';
  
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
  const [examUploadStatus, setExamUploadStatus] = useState('');
  const [examUploadError, setExamUploadError] = useState('');
  const [telemedicineSummary, setTelemedicineSummary] = useState({ total: 0, today: 0, future: 0, cancelled: 0 });
  const [isLoadingTelemedicineSummary, setIsLoadingTelemedicineSummary] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<'default' | 'granted' | 'denied' | 'unsupported'>(getBrowserNotificationPermission);
  const [appointmentNotificationsEnabled, setAppointmentNotificationsEnabledState] = useState(getAppointmentNotificationsEnabled);
  
  // Edit states
  const [editingAptId, setEditingAptId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ nome_paciente: '', telefone: '', cpf: '' });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState<string | null>(null);
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);
  const [, setRoomAccessTick] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleToggleAppointmentNotifications = async () => {
    if (notificationPermission === 'unsupported') return;

    if (appointmentNotificationsEnabled) {
      setAppointmentNotificationsEnabled(false);
      setAppointmentNotificationsEnabledState(false);
      return;
    }

    let permission = getBrowserNotificationPermission();

    if (permission === 'default') {
      try {
        permission = await Notification.requestPermission();
      } catch {
        permission = getBrowserNotificationPermission();
      }
    }

    setNotificationPermission(permission);

    if (permission === 'granted') {
      setAppointmentNotificationsEnabled(true);
      setAppointmentNotificationsEnabledState(true);
    } else {
      setAppointmentNotificationsEnabled(false);
      setAppointmentNotificationsEnabledState(false);
    }
  };

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setRoomAccessTick(tick => tick + 1);
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!isDoctorProfile || !user) return;

    let isMounted = true;

    const fetchTelemedicineSummary = async () => {
      setIsLoadingTelemedicineSummary(true);

      try {
        const toSaoPauloDateKey = (value: string | Date) => {
          const date = value instanceof Date ? value : new Date(value);
          if (Number.isNaN(date.getTime())) return '';

          return new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Sao_Paulo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).format(date);
        };

        const todayKey = toSaoPauloDateKey(new Date());
        const { data, error } = await supabase
          .from('consultations')
          .select('id, status, appointment_date');

        if (error) throw error;

        const consultations = data || [];
        const activeConsultations = consultations.filter((consultation: any) => consultation.status !== 'cancelled');
        const today = activeConsultations.filter((consultation: any) => toSaoPauloDateKey(consultation.appointment_date) === todayKey).length;
        const future = activeConsultations.filter((consultation: any) => {
          const appointmentKey = toSaoPauloDateKey(consultation.appointment_date);
          return appointmentKey > todayKey && consultation.status !== 'completed';
        }).length;
        const cancelled = consultations.filter((consultation: any) => consultation.status === 'cancelled').length;

        if (isMounted) {
          setTelemedicineSummary({
            total: activeConsultations.length,
            today,
            future,
            cancelled,
          });
        }
      } catch (error) {
        console.error('Erro ao buscar resumo de telemedicina:', error);
      } finally {
        if (isMounted) {
          setIsLoadingTelemedicineSummary(false);
        }
      }
    };

    fetchTelemedicineSummary();

    return () => {
      isMounted = false;
    };
  }, [isDoctorProfile, user]);

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

      const normalizeText = (value: string | undefined | null) =>
        String(value || '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]/g, '');

      const normalizeDoctor = (value: string | undefined | null) =>
        normalizeText(value).replace(/^(dra?|medico)/, '').replace(/^(dra?|medico)/, '');

      const normalizePaymentId = (value: string | undefined | null) =>
        String(value || '').trim().toLowerCase();

      const normalizeStatus = (apt: any) => {
        const rawStatus = apt?.status || apt?.status_pagamento || apt?.pagamento_status || '';
        const key = normalizeText(rawStatus);

        if (key === 'pago' || key === 'paid') return 'Pago';
        if (key === 'approved' || key === 'confirmado') return 'Confirmado';

        return rawStatus;
      };

      const isTelemedicineAppointment = (apt: any) => {
        const key = normalizeText([
          apt?.tipo,
          apt?.especialidade,
          apt?.category,
          apt?.modalidade,
        ].filter(Boolean).join(' '));

        return key.includes('telemedicina') || key.includes('teleconsulta') || key.includes('telemedic');
      };

      const hasDifferentModality = (left: any, right: any) => {
        const leftIsTelemedicine = isTelemedicineAppointment(left);
        const rightIsTelemedicine = isTelemedicineAppointment(right);

        return leftIsTelemedicine !== rightIsTelemedicine;
      };

      const getPaymentIds = (apt: any) => [
        normalizePaymentId(apt?.pagamento),
        normalizePaymentId(apt?.payment_id),
        normalizePaymentId(apt?.asaas_id),
        normalizePaymentId(apt?.asaas_payment_id),
      ].filter(Boolean);

      const parseDateTimeParts = (dateValue: string | undefined | null, timeValue?: string | undefined | null) => {
        const rawDate = String(dateValue || '').trim();
        const rawTime = String(timeValue || '').trim();
        let dateKey = '';
        let timeKey = '';
        const months: Record<string, string> = {
          janeiro: '01',
          fevereiro: '02',
          marco: '03',
          abril: '04',
          maio: '05',
          junho: '06',
          julho: '07',
          agosto: '08',
          setembro: '09',
          outubro: '10',
          novembro: '11',
          dezembro: '12',
        };

        const isoMatch = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
        if (isoMatch) {
          dateKey = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
          if (isoMatch[4] && isoMatch[5]) timeKey = `${isoMatch[4]}:${isoMatch[5]}`;
        } else {
          const brMatch = rawDate.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
          if (brMatch) {
            dateKey = `${brMatch[3]}-${brMatch[2].padStart(2, '0')}-${brMatch[1].padStart(2, '0')}`;
          }
        }

        if (!dateKey) {
          const longPtDate = normalizeText(rawDate).match(/^(\d{1,2})de([a-z]+)de(\d{4})/);
          if (longPtDate && months[longPtDate[2]]) {
            dateKey = `${longPtDate[3]}-${months[longPtDate[2]]}-${longPtDate[1].padStart(2, '0')}`;
          }
        }

        if (!timeKey) {
          const timeMatch = rawTime.match(/(\d{1,2}):(\d{2})/);
          if (timeMatch) timeKey = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
        }

        return { dateKey, timeKey };
      };

      const isSameAppointment = (left: any, right: any) => {
        const leftPayments = getPaymentIds(left);
        const rightPayments = getPaymentIds(right);
        if (leftPayments.some(id => rightPayments.includes(id))) return true;
        if (hasDifferentModality(left, right)) return false;

        const leftDate = parseDateTimeParts(left?.data_consulta, left?.horario);
        const rightDate = parseDateTimeParts(right?.data_consulta, right?.horario);
        const leftDoctor = normalizeDoctor(left?.medico);
        const rightDoctor = normalizeDoctor(right?.medico);

        const sameDate = !!leftDate.dateKey && leftDate.dateKey === rightDate.dateKey;
        const sameTime = leftDate.timeKey && rightDate.timeKey ? leftDate.timeKey === rightDate.timeKey : true;
        const sameDoctor = !!leftDoctor && !!rightDoctor && (
          leftDoctor.includes(rightDoctor) || rightDoctor.includes(leftDoctor)
        );
        const isCrossSource = Boolean(left?.isFromSupabase || right?.isFromSupabase) && Boolean(left?.isFromSheet || right?.isFromSheet);

        return sameDate && sameDoctor && (sameTime || isCrossSource);
      };

      const applySheetStatus = (target: any, sheetApt: any) => {
        const sheetStatus = normalizeStatus(sheetApt);
        if (sheetStatus === 'Pago' || sheetStatus === 'Confirmado') {
          target.status = sheetStatus;
        }
      };

      // 2. Busca no Supabase (Telemedicina)
      const supabasePromise = user ? supabase
        .from('consultations')
        .select('*, payments(status, asaas_payment_id)')
        .eq('patient_id', user.id)
        .order('created_at', { ascending: false }) : Promise.resolve({ data: [] });

      const [sheetData, supabaseResult] = await Promise.all([sheetPromise, supabasePromise]);
      
      let mergedAppointments: any[] = [];

      // 1. Processa dados do Supabase PRIMEIRO (eles são a prioridade pois têm botões de ação)
      const supabaseData = (supabaseResult as any).data || [];
      supabaseData.forEach((cons: any) => {
        const payment = Array.isArray(cons.payments) ? cons.payments[0] : cons.payments;

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
                  (payment?.status === 'approved') ? 'Confirmado' : 'Pendente',
          raw_status: cons.status,
          updated_at: cons.updated_at,
          pagamento: cons.payment_id,
          payment_id: cons.payment_id,
          asaas_payment_id: payment?.asaas_payment_id,
          isFromSupabase: true
        });
      });

      // 2. Processa dados da planilha e ADICIONA apenas se não houver duplicata no banco
      if (sheetData.result === 'success' && sheetData.data) {
        sheetData.data.forEach((sheetApt: any) => {
          const normalizedSheetApt = {
            ...sheetApt,
            status: normalizeStatus(sheetApt) || sheetApt.status,
            isFromSheet: true
          };

          const hasMatchingSupabaseTelemedicine = isTelemedicineAppointment(normalizedSheetApt) &&
            mergedAppointments.some(dbApt => dbApt.isFromSupabase && isSameAppointment(dbApt, normalizedSheetApt));

          if (hasMatchingSupabaseTelemedicine) {
            return;
          }

          const existingApt = mergedAppointments.find(dbApt => {
            return isSameAppointment(dbApt, normalizedSheetApt);
          });

          if (existingApt) {
            // SE ENCONTROU DUPLICATA: Se a planilha diz que está Pago, atualiza o status do banco
            applySheetStatus(existingApt, sheetApt);
          } else {
            // Se não é duplicata, adiciona normalmente
            mergedAppointments.push(normalizedSheetApt);
          }
        });
      }

      // 3. PENTE FINO FINAL: Remove duplicatas da lista já mesclada
      const finalAppointments = mergedAppointments.reduce((acc: any[], apt) => {
        const existingIndex = acc.findIndex(existing => isSameAppointment(existing, apt));

        if (existingIndex === -1) {
          acc.push(apt);
          return acc;
        }

        const existing = acc[existingIndex];
        if (apt.isFromSupabase && !existing.isFromSupabase) {
          applySheetStatus(apt, existing);
          acc[existingIndex] = apt;
        } else if (!apt.isFromSupabase) {
          applySheetStatus(existing, apt);
        }

        return acc;
      }, []);

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

  useEffect(() => {
    if (!user || activeView !== 'appointments') return;

    const intervalId = window.setInterval(() => {
      fetchAppointments();
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [user, activeView]);

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

  const getActiveExamConsultationId = () => {
    return selectedApt?.isFromSupabase && selectedApt?.tipo === 'Telemedicina' ? selectedApt.id : '';
  };

  const getDocumentUrl = (doc: any) => {
    return doc?.validation_token
      ? `/api/doctor-documents/view/${doc.validation_token}`
      : doc?.document_url;
  };

  const fetchExams = async (consultationId = getActiveExamConsultationId()) => {
    if (!user || !session?.access_token) return;
    setIsLoadingExams(true);
    try {
      const query = consultationId ? `?consultationId=${encodeURIComponent(consultationId)}` : '';
      const response = await withTimeout(
        fetch(`/api/patient-exams/upload${query}`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        }),
        30000,
        'Não conseguimos carregar seus exames agora. Tente atualizar a tela.'
      );
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Não foi possível carregar seus exames.');
      }

      setExams(result.exams || []);
    } catch (e: any) {
      console.error('Erro ao carregar exames:', e);
      setExamUploadError(e.message || 'Não foi possível carregar seus exames.');
    } finally {
      setIsLoadingExams(false);
    }
  };

  const getExamFileType = (file: File) => {
    if (file.type) return file.type;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (['png', 'jpg', 'jpeg', 'webp', 'heic', 'heif'].includes(ext || '')) {
      return `image/${ext === 'jpg' ? 'jpeg' : ext}`;
    }
    if (ext === 'pdf') return 'application/pdf';

    return '';
  };

  const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, message: string) => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
    });

    try {
      return await Promise.race([promise, timeout]);
    } finally {
      clearTimeout(timeoutId!);
    }
  };

  const readUploadResponse = async (response: Response) => {
    const text = await response.text();
    try {
      return text ? JSON.parse(text) : null;
    } catch {
      return {
        success: false,
        error: text || `Servidor respondeu ${response.status} ${response.statusText}`.trim(),
      };
    }
  };

  const compressExamImage = async (file: File) => {
    const fileType = getExamFileType(file);
    if (!fileType.startsWith('image/') || file.size <= MAX_EXAM_UPLOAD_BYTES) {
      return file;
    }

    const imageUrl = URL.createObjectURL(file);

    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Nao conseguimos preparar esta imagem. Tente enviar uma imagem menor.'));
        img.src = imageUrl;
      });

      const maxSide = 1800;
      const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Nao foi possivel compactar esta imagem.');
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

      const makeBlob = (quality: number) => new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/jpeg', quality);
      });

      let blob: Blob | null = null;
      for (const quality of [0.82, 0.72, 0.62, 0.52]) {
        blob = await makeBlob(quality);
        if (blob && blob.size <= MAX_EXAM_UPLOAD_BYTES) break;
      }

      if (!blob || blob.size > MAX_EXAM_UPLOAD_BYTES) {
        throw new Error('A imagem ficou muito grande mesmo apos compactar. Tente enviar uma foto menor.');
      }

      const safeName = file.name.replace(/\.[^.]+$/, '') || 'exame';
      return new File([blob], `${safeName}.jpg`, { type: 'image/jpeg' });
    } finally {
      URL.revokeObjectURL(imageUrl);
    }
  };

  const handleUploadExam = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (!user) {
      alert('Você precisa estar logado para enviar exames.');
      return;
    }

    if (!session?.access_token) {
      alert('Sua sessão expirou. Faça login novamente para enviar exames.');
      return;
    }

    if (files.length === 0) return;

    const invalidSizeFile = files.find(file => file.size > MAX_EXAM_SOURCE_BYTES);
    if (invalidSizeFile) {
      alert(`O arquivo "${invalidSizeFile.name}" é muito grande. O limite máximo é de 30MB.`);
      return;
    }

    const invalidPdfSizeFile = files.find(file => {
      const fileType = getExamFileType(file);
      return fileType === 'application/pdf' && file.size > MAX_EXAM_UPLOAD_BYTES;
    });

    if (invalidPdfSizeFile) {
      alert(`O PDF "${invalidPdfSizeFile.name}" e muito grande. Envie um PDF de ate 4MB.`);
      return;
    }

    const invalidFormatFile = files.find(file => {
      const fileType = getExamFileType(file);
      return !fileType.startsWith('image/') && fileType !== 'application/pdf';
    });

    if (invalidFormatFile) {
      alert(`Formato não suportado em "${invalidFormatFile.name}". Por favor, envie arquivos PDF ou imagens (PNG, JPEG, WEBP ou HEIC).`);
      return;
    }

    setIsUploadingExam(true);
    setIsLoadingExams(false);
    setUploadProgress(5);
    setExamUploadError('');
    setExamUploadStatus(files.length > 1 ? `Preparando ${files.length} arquivos...` : 'Preparando arquivo...');

    try {
      const uploadedExams: any[] = [];

      for (const [index, file] of files.entries()) {
        const currentLabel = files.length > 1 ? `${index + 1}/${files.length}: ${file.name}` : file.name;
        const uploadFile = await compressExamImage(file);
        const formData = new FormData();
        formData.append('file', uploadFile, uploadFile.name);
        const consultationId = getActiveExamConsultationId();
        if (consultationId) {
          formData.append('consultationId', consultationId);
          formData.append('appointmentDate', selectedApt?.data_consulta || '');
        }

        setExamUploadStatus(`Enviando ${currentLabel}...`);
        const response = await withTimeout(
          fetch('/api/patient-exams/upload', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.access_token}`
            },
            body: formData
          }),
          60000,
          'O envio demorou demais e foi interrompido. Verifique sua conexão e tente novamente com uma imagem menor.'
        );

        const result = await readUploadResponse(response);

        if (!response.ok || !result?.success) {
          throw new Error(result?.error || 'Não foi possível enviar o exame.');
        }

        if (result.upload) {
          uploadedExams.push(result.upload);
        }

        setUploadProgress(Math.round(((index + 1) / files.length) * 100));
      }

      if (uploadedExams.length > 0) {
        setExams(prev => {
          const existingIds = new Set(prev.map(exam => exam.id));
          const newItems = uploadedExams.filter(exam => !existingIds.has(exam.id));
          return [...newItems, ...prev];
        });
      }

      setUploadProgress(100);
      setExamUploadStatus(files.length > 1 ? 'Arquivos enviados com sucesso.' : 'Arquivo enviado com sucesso.');
      setTimeout(() => {
        setIsUploadingExam(false);
        setUploadProgress(0);
        setExamUploadStatus('');
      }, 500);
    } catch (error: any) {
      console.error('Erro no upload:', error);
      setExamUploadError(error.message || 'Não foi possível enviar o exame.');
      setExamUploadStatus('');
      alert('Erro ao enviar exame: ' + error.message);
      setIsUploadingExam(false);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteExam = async (exam: any) => {
    if (!confirm('Tem certeza que deseja excluir este exame?')) return;

    try {
      if (!session?.access_token) {
        throw new Error('Sua sessão expirou. Faça login novamente para excluir exames.');
      }

      setExams(prev => prev.filter(item => item.id !== exam.id));

      const response = await withTimeout(
        fetch('/api/patient-exams/upload', {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ examId: exam.id })
        }),
        30000,
        'A exclusão demorou demais. Atualize a lista e tente novamente.'
      );

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        setExams(prev => [exam, ...prev]);
        throw new Error(result?.error || 'Não foi possível excluir o exame.');
      }
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
    if (s === 'Não atendida') return 'NaoAtendida';
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

  const selectedAptDisplayStatus = selectedApt ? getAppointmentDisplayStatus(selectedApt) : 'Pendente';
  const selectedAptMissedTelemedicine = selectedApt ? isTelemedicineMissedByDoctor(selectedApt) : false;

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
              } else if (activeView === 'exams' && selectedApt) {
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
            {isDoctorProfile ? 'Médico' : 'Paciente'}
          </span>
        </div>

        {/* Content Wrapper (Bottom Sheet) */}
        <div className={styles.contentWrapper}>
          
          {activeView === 'menu' ? (
            <>
              {isDoctorProfile && (
                <button className={`${styles.menuItem} ${styles.telemedicineEntry}`} onClick={() => window.location.href = '/doctor-panel'}>
                  <div className={styles.telemedicineIconShell}>
                    <Stethoscope size={24} />
                  </div>
                  <div className={styles.telemedicineContent}>
                    <span className={styles.telemedicineKicker}>Área médica</span>
                    <span className={styles.telemedicineTitle}>Telemedicina</span>
                    <span className={styles.telemedicineDescription}>Painel de consultas e salas online</span>
                  </div>
                  <ChevronRight size={22} className={styles.telemedicineChevron} />
                </button>
              )}

              {isDoctorProfile && (
                <button className={styles.menuItem} onClick={() => window.location.href = '/doctor-analytics'}>
                  <div className={`${styles.menuIconWrapper} ${styles.iconPink}`}>
                    <BarChart3 size={24} />
                  </div>
                  <span className={styles.menuText}>Analises do site</span>
                  <ChevronRight size={20} className={styles.chevron} />
                </button>
              )}

              {isDoctorProfile && (
                <button className={`${styles.menuItem} ${styles.summaryMenuItem}`} onClick={() => window.location.href = '/doctor-panel'}>
                  <div className={`${styles.menuIconWrapper} ${styles.iconBlue}`}>
                    <Video size={24} />
                  </div>
                  <div className={styles.summaryMenuContent}>
                    <span className={styles.menuText}>Consultas telemedicina</span>
                    <span className={styles.summaryMenuSubtitle}>
                      {isLoadingTelemedicineSummary
                        ? 'Carregando resumo...'
                        : `Hoje ${telemedicineSummary.today} | Futuras ${telemedicineSummary.future} | Canceladas ${telemedicineSummary.cancelled}`}
                    </span>
                  </div>
                  <ChevronRight size={20} className={styles.chevron} />
                </button>
              )}

              <button className={styles.menuItem} onClick={() => setActiveView('info')}>
                <div className={`${styles.menuIconWrapper} ${styles.iconPink}`}>
                  <UserIcon size={24} />
                </div>
                <span className={styles.menuText}>Dados Pessoais</span>
                <ChevronRight size={20} className={styles.chevron} />
              </button>

              {!isDoctorProfile && (
                <>
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

                  {notificationPermission !== 'unsupported' && (
                    <button className={styles.menuItem} onClick={handleToggleAppointmentNotifications}>
                      <div className={`${styles.menuIconWrapper} ${appointmentNotificationsEnabled ? styles.iconBlue : styles.iconGray}`}>
                        <Bell size={24} />
                      </div>
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        gap: '3px',
                        flex: 1,
                        minWidth: 0
                      }}>
                        <span className={styles.menuText}>Notificações</span>
                        <span style={{
                          color: notificationPermission === 'denied' ? '#99161e' : '#64748b',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          lineHeight: 1.2,
                          textAlign: 'left'
                        }}>
                          {notificationPermission === 'denied'
                            ? 'Bloqueadas no navegador'
                            : appointmentNotificationsEnabled
                              ? 'Ativas para agendamentos'
                              : 'Toque para ativar'}
                        </span>
                      </div>
                      <span style={{
                        width: '44px',
                        height: '26px',
                        borderRadius: '999px',
                        background: appointmentNotificationsEnabled ? '#cb1e28' : '#e2e8f0',
                        padding: '3px',
                        display: 'flex',
                        justifyContent: appointmentNotificationsEnabled ? 'flex-end' : 'flex-start',
                        transition: 'all 0.2s ease',
                        flexShrink: 0
                      }}>
                        <span style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          background: '#ffffff',
                          boxShadow: '0 2px 6px rgba(15, 23, 42, 0.16)'
                        }} />
                      </span>
                    </button>
                  )}
                </>
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
                  appointments.map((apt, idx) => {
                    const roomAccessInfo = getRoomAccessInfo(apt);
                    const displayStatus = getAppointmentDisplayStatus(apt);
                    const isMissedTelemedicine = isTelemedicineMissedByDoctor(apt);
                    const isCompletedAppointment = displayStatus === 'Realizado';

                    return (
                    <div key={idx} className={`${styles.appointmentCard} ${styles['card' + getStatusKey(displayStatus)]}`}>
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
                              <span className={`${styles.statusBadge} ${styles['status' + getStatusKey(displayStatus)]}`}>
                                {displayStatus}
                              </span>
                            </div>
                            <h4 className={styles.appointmentDoctor}>{formatDoctorName(apt.medico)}</h4>
                            <p className={styles.appointmentSpecialty}>{apt.especialidade || apt.tipo}</p>
                          </div>
                          <div className={styles.appointmentFooter}>
                            <span className={styles.appointmentId}>ID: {apt.id}</span>
                            
                            {/* Grupo 1: Administrativo */}
                            <div className={styles.adminActions}>
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
                                    {!isCompletedAppointment && !isMissedTelemedicine && (
                                      <>
                                        <button className={styles.editBtn} onClick={() => handleEditClick(apt)}>Editar</button>
                                        <button className={styles.cancelBtn} onClick={() => handleCancelAppointment(apt.id)}>Cancelar</button>
                                      </>
                                    )}
                                  </>
                              )}
                            </div>

                            {/* Grupo 2: Telemedicina */}
                            {apt.tipo === 'Telemedicina' && apt.status !== 'Cancelado' && !isCompletedAppointment && !apt.isCancelling && (
                              <div className={styles.clinicalActions}>
                                {isMissedTelemedicine ? (
                                  <a
                                    className={styles.supportBtn}
                                    href={buildTelemedicineSupportUrl(apt, profile?.full_name)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <MessageCircle size={14} /> Solicitar suporte
                                  </a>
                                ) : (
                                  <>
                                  <button 
                                    className={styles.attachExamsShortcut}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedApt(apt);
                                      setActiveView('exams');
                                      fetchExams(apt.id);
                                    }}
                                >
                                    <Paperclip size={14} className={styles.attachExamsIcon} /> Anexar Exames
                                </button>
                                <button 
                                    className={`${styles.roomBtn} ${!roomAccessInfo.canEnter ? styles.roomBtnDisabled : ''}`}
                                    disabled={!roomAccessInfo.canEnter}
                                    title={!roomAccessInfo.canEnter ? `Disponível a partir de ${roomAccessInfo.availableAtText}` : undefined}
                                    onClick={async () => {
                                        if (!roomAccessInfo.canEnter) return;

                                        try {
                                            const res = await fetch('/api/telemedicine/room', {
                                                method: 'POST',
                                                headers: {
                                                    'Content-Type': 'application/json',
                                                    Authorization: `Bearer ${session?.access_token || ''}`,
                                                },
                                                body: JSON.stringify({
                                                    appointmentId: apt.id,
                                                    patientId: user?.id,
                                                    doctorName: apt.medico,
                                                    appointmentDate: apt.data_consulta,
                                                    isDoctor: false,
                                                    shouldUpdateStatus: false
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
                                    <Camera size={14} /> {roomAccessInfo.canEnter ? 'Entrar na Sala' : `Libera ${roomAccessInfo.availableAtText}`}
                                </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                    );
                  })
                ) : (
                  <div className={styles.emptyState}>
                    <div className={styles.emptyIcon} style={{ fontSize: '3rem', marginBottom: '16px' }}>🔍</div>
                    <p style={{ fontWeight: 600, color: '#0f172a' }}>Nenhum agendamento encontrado.</p>
                  </div>
                )}
             </div>
          ) : activeView === 'appointment_detail' && selectedApt ? (
            <div className={styles.detailView}>
              <div className={`${styles.detailHeader} ${styles['card' + getStatusKey(selectedAptDisplayStatus)]}`}>
                <div className={styles.detailIconWrapper}>
                  <CalendarDays size={32} />
                </div>
                <div className={styles.detailHeaderInfo}>
                  <h3 className={styles.detailTitle}>{formatDate(selectedApt.data_consulta)}</h3>
                  <p className={styles.detailSubtitle}>{formatTime(selectedApt.horario)}</p>
                </div>
                <span className={`${styles.statusBadge} ${styles['status' + getStatusKey(selectedAptDisplayStatus)]}`}>
                  {selectedAptDisplayStatus}
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

              {selectedApt.tipo === 'Telemedicina' && selectedApt.isFromSupabase && (
                selectedAptMissedTelemedicine ? (
                  <a
                    className={styles.supportBtnFull}
                    href={buildTelemedicineSupportUrl(selectedApt, profile?.full_name)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle size={20} />
                    Solicitar suporte pelo WhatsApp
                  </a>
                ) : (
                  <button
                    className={styles.pdfBtnFull}
                    onClick={() => {
                      setActiveView('exams');
                      fetchExams(selectedApt.id);
                    }}
                  >
                    <Paperclip size={20} />
                    Anexar Exames desta Consulta
                  </button>
                )
              )}

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
                        <a href={getDocumentUrl(doc)} target="_blank" rel="noopener noreferrer" className={styles.pdfBtn}>
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
                  <p className={styles.detailSubtitle}>
                    {getActiveExamConsultationId()
                      ? `Consulta de ${formatDate(selectedApt?.data_consulta)}`
                      : 'Envie seus exames para o médico'}
                  </p>
                </div>
              </div>

              <label className={styles.examUploadArea} htmlFor="exam-upload">
                <div className={styles.examUploadIcon}>
                  <Upload size={32} />
                </div>
                <div className={styles.examUploadText}>
                  <h4>Clique para enviar</h4>
                  <p>Formatos aceitos: PDF, PNG, JPEG, WEBP ou HEIC</p>
                </div>
                {isUploadingExam && (
                  <div className={styles.uploadProgress}>
                    <div className={styles.uploadProgressBar} style={{ width: `${uploadProgress}%` }}></div>
                  </div>
                )}
              </label>
              {(examUploadStatus || examUploadError) && (
                <p style={{
                  margin: '0.5rem 0 0',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: examUploadError ? '#dc2626' : '#475569',
                  textAlign: 'center'
                }}>
                  {examUploadError || examUploadStatus}
                </p>
              )}
              <input 
                id="exam-upload"
                ref={fileInputRef}
                type="file" 
                accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.heif,image/*,application/pdf"
                className={styles.visuallyHidden}
                onChange={handleUploadExam}
                disabled={isUploadingExam}
                multiple
              />

              <div style={{ marginTop: '1.5rem' }}>
                <h4 style={{ fontSize: '0.9rem', color: '#475569', fontWeight: 700, marginBottom: '0.5rem' }}>
                  {getActiveExamConsultationId() ? 'Exames desta consulta:' : 'Exames Enviados:'}
                </h4>
                
                {isLoadingExams ? (
                  <p className={styles.loadingText}>Carregando seus exames...</p>
                ) : exams.length === 0 ? (
                  <div className={styles.emptyState}>
                    <p>{getActiveExamConsultationId() ? 'Você ainda não enviou exames para esta consulta.' : 'Você ainda não enviou nenhum exame.'}</p>
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
