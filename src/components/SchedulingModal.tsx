'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from './SchedulingModal.module.css';
import { Doctor } from '../data/mocks';
import { Service } from '../lib/sheets';
import { sendGAEvent } from '@next/third-parties/google';
import { useAuth } from '../contexts/AuthContext';
import { MapPin, Video, Clock, Calendar, User, ChevronRight, CheckCircle2, AlertCircle, Sparkles, Activity, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface SchedulingModalProps {
    item: Doctor | Service;
    type: 'doctor' | 'exam';
    doctors?: Doctor[];
    services?: Service[];
    onClose: () => void;
    onConfirm: (slot: string, appointmentType: string) => void;
}

declare global {
    interface Window {
        fbq: any;
        gtag: any;
    }
}

// Função para gerar os próximos 30 dias (aumentado para pegar datas específicas mais distantes)
function getNextDays(count: number = 30): Date[] {
    const dates: Date[] = [];
    const today = new Date();
    let currentDate = new Date(today);

    while (dates.length < count) {
        dates.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
    }
    return dates;
}

// Horários disponíveis: 8:00 até 17:00
const TIME_SLOTS = [
    '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'
];

// Filtra horários passados se o dia selecionado for hoje
function getAvailableTimeSlots(selectedDate: Date | null, doctor: Doctor | null | undefined, serviceName?: string, docApptType?: string | null): string[] {
    const doctorName = doctor?.name;
    const isDrAndre = doctorName && (doctorName.toLowerCase().includes('andré') || doctorName.toLowerCase().includes('andre'));
    const isMapaOrHolter = serviceName && (serviceName.toLowerCase().includes('mapa') || serviceName.toLowerCase().includes('holter'));

    let availableSlots: string[] = [];

    // 1. REGRA ESPECÍFICA: Telemedicina Dr. André (Seg, Qua, Sex às 15h, 16h, 17h)
    if (isDrAndre && docApptType === 'telemedicina') {
        availableSlots = ['15:00', '16:00', '17:00'];
    }
    // 2. REGRA ESPECÍFICA: MAPA ou Holter (Exames com horário marcado)
    else if (isMapaOrHolter) {
        availableSlots = ['06:30', '07:00', '07:30', '08:00'];
    }
    // 3. TODO O RESTANTE: Ordem de Chegada
    else {
        availableSlots = ['Ordem de Chegada'];
    }

    if (!selectedDate) return availableSlots;

    const today = new Date();
    const isToday = selectedDate.getDate() === today.getDate() &&
        selectedDate.getMonth() === today.getMonth() &&
        selectedDate.getFullYear() === today.getFullYear();

    if (!isToday) return availableSlots;

    // Filtro de horários passados
    const currentHour = today.getHours();
    const currentMinute = today.getMinutes();
    
    return availableSlots.filter(slot => {
        if (slot === 'Ordem de Chegada') return true; // Nunca esconde Ordem de Chegada
        
        const [hourStr, minuteStr] = slot.split(':');
        const slotHour = parseInt(hourStr, 10);
        const slotMinute = minuteStr ? parseInt(minuteStr, 10) : 0;

        if (slotHour > currentHour) return true;
        if (slotHour === currentHour && slotMinute >= currentMinute) return true;
        return false;
    });
}

// Formata data para exibição
function formatDate(date: Date): string {
    return date.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit'
    });
}

// Helper para extrair datas específicas de uma string (ex: "12/02/2026", "24/02/2026", "7/2/2026")
function extractSpecificDates(text: string): string[] {
    const dateRegex = /\d{1,2}\/\d{1,2}\/\d{4}/g;
    const matches = text.match(dateRegex);
    if (!matches) return [];

    // Normaliza para sempre ter 2 dígitos (07/02/2026) para facilitar comparação
    return matches.map(date => {
        const [day, month, year] = date.split('/');
        return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
    });
}

// Verifica se o médico tem agenda baseada em calendário (dias da semana ou datas específicas)
function hasWeekdaySchedule(doctor: Doctor): boolean {
    const dateStr = (doctor.date || '').toLowerCase();

    // Se tiver datas específicas (DD/MM/YYYY), usa calendário
    if (/\d{1,2}\/\d{1,2}\/\d{4}/.test(dateStr)) return true;

    // Considera dinâmico se tiver menção a dias da semana ou range
    return dateStr.includes('segunda') || dateStr.includes('sexta') || dateStr.includes('sábado') || dateStr.includes('sabado');
}

// Verifica se o dia específico está disponível para aquele médico ou serviço
function isDateAvailableForDoctor(date: Date, doctor: Doctor | null, service?: Service | null, docApptType?: string | null): boolean {
    const day = date.getDay(); // 0 = Domingo, 6 = Sábado
    const isWeekend = day === 0 || day === 6;

    if (!doctor) {
        return false;
    }

    const doctorName = doctor.name?.toLowerCase() || '';
    const isDrAndre = doctorName.includes('andré') || doctorName.includes('andre');
    const dateStr = (doctor.date || '').toLowerCase();

    // REGRA ESPECÍFICA: Telemedicina Dr. André (Segunda, Quarta, Sexta)
    // Dias: 1 = Segunda, 3 = Quarta, 5 = Sexta
    if (isDrAndre && docApptType === 'telemedicina') {
        const day = date.getDay();
        return day === 1 || day === 3 || day === 5;
    }

    // Se o serviço for MAPA ou Holter, restringe para Segunda a Quinta (1 a 4)
    if (service && (service.description.toLowerCase().includes('mapa') || service.description.toLowerCase().includes('holter'))) {
        if (day === 0 || day === 5 || day === 6) { // Domingo, Sexta, Sábado
            return false;
        }
    }
    const isTecnicos = doctorName.includes('técnicos') || doctorName.includes('tecnicos');

    if (isDrAndre || isTecnicos) {
        // Feriados onde Dr. André e Técnicos NÃO atendem (atualmente sem folgas fixas no código)
        const feriados: string[] = ['03/04/2026', '01/05/2026']; // Clínica fechada
        const dayNum = String(date.getDate()).padStart(2, '0');
        const monthNum = String(date.getMonth() + 1).padStart(2, '0');
        const yearNum = date.getFullYear();
        const currentDateStr = `${dayNum}/${monthNum}/${yearNum}`;

        if (feriados.includes(currentDateStr)) {
            return false; // Feriado - não atende
        }

        if (isDrAndre) {
            // Bloqueio específico para dias a pedido da clínica
            if (currentDateStr === '27/03/2026' || currentDateStr === '17/04/2026') {
                return false;
            }
        }

        // Regra de Trava por Horário para Dr. André e Técnicos (Ordem de Chegada)
        // Se hoje for o dia selecionado e já passou das 11:00 (ou 15:00 na tarde), bloqueia o agendamento pra hoje.
        const today = new Date();
        const isToday = date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear();

        if (isToday) {
            let limitHour = 11; // Padrão: Manhã (11:00)

            if (doctor && doctor.dateSpecificTurnos) {
                let turnoParaODia = '';
                if (doctor.dateSpecificTurnos[currentDateStr]) {
                    turnoParaODia = doctor.dateSpecificTurnos[currentDateStr].toLowerCase();
                } else {
                    const genericKey = Object.keys(doctor.dateSpecificTurnos).find(k => !k.includes('/'));
                    if (genericKey) {
                        turnoParaODia = doctor.dateSpecificTurnos[genericKey].toLowerCase();
                    }
                }
                if (turnoParaODia === 'tarde') {
                    limitHour = 15; // Extensão: Tarde (15:00)
                }
            }

            const currentHour = today.getHours();
            if (currentHour >= limitHour) {
                return false; // Passou do limite, bloqueia o dia de hoje
            }

            if (doctor && doctor.isLotadoToday) {
                return false; // Bloqueado manualmente hoje pela planilha
            }
        }

        // Dr. André e Técnicos atendem segunda a sexta
        return !isWeekend;
    }

    // 1. Prioridade: Datas Específicas (outros médicos)
    const specificDates = extractSpecificDates(doctor.date || '');
    if (specificDates.length > 0) {
        // Formato manual DD/MM/YYYY para garantir consistência
        const dayNum = String(date.getDate()).padStart(2, '0');
        const monthNum = String(date.getMonth() + 1).padStart(2, '0');
        const yearNum = date.getFullYear();
        const currentDataStr = `${dayNum}/${monthNum}/${yearNum}`;
        if (specificDates.includes(currentDataStr)) {
            return true;
        }
    }

    // 2. Lógica de Dias da Semana (Segunda a Sexta / Sábado)
    if (dateStr.includes('segunda') || dateStr.includes('sexta')) {
        if (isWeekend) {
            if (day === 6 && (dateStr.includes('sábado') || dateStr.includes('sabado'))) {
                return true;
            }
            return false;
        }
        return true;
    }

    // Default: Se não tem datas definidas, não está disponível
    return false;
}

export default function SchedulingModal({ item, type, doctors = [], services = [], onClose, onConfirm }: SchedulingModalProps) {
    const { user, profile } = useAuth();

    // Bloqueia o scroll do body quando o modal abre
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, []);
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
    const [appointmentType, setAppointmentType] = useState<'consulta' | 'retorno' | 'exame'>(type === 'exam' ? 'exame' : 'consulta');
    // Hack: Usamos um state separado para controlar se o usuário já escolheu para médicos
    const [modality, setModality] = useState<'presencial' | 'telemedicina' | null>(null);
    const [docApptType, setDocApptType] = useState<'consulta' | 'retorno' | 'telemedicina' | null>(null);

    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedTime, setSelectedTime] = useState<string | null>(null);

    const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);
    const [appointmentId, setAppointmentId] = useState<string | null>(null);

    const [isProtocolDescExpanded, setIsProtocolDescExpanded] = useState(false);

    // Marca-passo (pacemaker) - Holter 24h
    const [hasPacemaker, setHasPacemaker] = useState<boolean | null>(null);

    // Casting seguro
    const doctor = type === 'doctor' ? (item as Doctor) : null;
    const service = type === 'exam' ? (item as Service) : null;

    // Encontra o médico responsável pelo exame
    const responsibleDoctor = useMemo(() => {
        if (type === 'doctor') return doctor;
        if (type === 'exam' && service) {
            const responsible = service.doctorResponsible.toLowerCase().trim();

            // Se for técnicos, cria um "médico virtual" com regra segunda-sexta
            if (responsible.includes('técnicos') || responsible.includes('tecnicos')) {
                return {
                    id: 'tecnicos',
                    name: 'Técnicos',
                    specialty: 'Exames',
                    available: true,
                    slots: [],
                    date: 'segunda a sexta'
                } as Doctor;
            }

            // Tenta encontrar pelo nome exato ou parcial
            if (doctors.length > 0) {
                return doctors.find(d =>
                    d.name.toLowerCase() === responsible ||
                    d.name.toLowerCase().includes(responsible)
                ) || null;
            }
        }
        return null;
    }, [type, doctor, service, doctors]);

    // Define qual médico dita a regra de agenda (o próprio para consultas, o responsável para exames)
    const effectiveDoctor = type === 'doctor' ? doctor : responsibleDoctor;

    // Dados do paciente
    const [patientName, setPatientName] = useState('');
    const [patientPhone, setPatientPhone] = useState('');
    const [currentStep, setCurrentStep] = useState<'selection' | 'patientData' | 'payment-method' | 'success'>('selection');
    
    // Payment states
    const [paymentInfo, setPaymentInfo] = useState<{pixCopiaECola?: string, qrCodeImage?: string, txId?: string, checkoutUrl?: string, paymentId?: string, mock?: boolean} | null>(null);

    // Coupon states
    const [couponCode, setCouponCode] = useState('');
    const [isCouponApplied, setIsCouponApplied] = useState(false);
    const [couponError, setCouponError] = useState('');
    const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
    const [paymentStatus, setPaymentStatus] = useState<'pending' | 'approved' | 'failed'>('pending');
    const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);

    // CPF States
    const [patientCpf, setPatientCpf] = useState('');
    const [isFetchingData, setIsFetchingData] = useState(false);

    // Sync with auth profile
    useEffect(() => {
        if (profile) {
            if (profile.full_name) setPatientName(profile.full_name);
            if (profile.phone) setPatientPhone(formatPhone(profile.phone));
            if (profile.cpf) setPatientCpf(formatCpf(profile.cpf));
        }
    }, [profile]);

    // Polling de Pagamento (Telemedicina)
    useEffect(() => {
        let interval: NodeJS.Timeout;
        
        if (currentStep === 'success' && docApptType === 'telemedicina' && paymentInfo?.paymentId && paymentStatus === 'pending') {
            console.log("[SchedulingModal] Iniciando polling de pagamento:", paymentInfo.paymentId);
            
            interval = setInterval(async () => {
                const { data, error } = await supabase
                    .from('payments')
                    .select('status')
                    .eq('id', paymentInfo.paymentId)
                    .single();
                
                if (!error && data) {
                    if (data.status === 'approved') {
                        setPaymentStatus('approved');
                        clearInterval(interval);
                        // Força refresh do perfil se o usuário estiver logado
                        if (user) {
                           supabase.from('profiles').select('*').eq('id', user.id); // Pequeno ping
                        }
                    } else if (data.status === 'failed') {
                        setPaymentStatus('failed');
                        clearInterval(interval);
                    }
                }
            }, 3000); // Checa a cada 3 segundos
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [currentStep, docApptType, paymentInfo, paymentStatus, user]);

    // URL da API do Google Sheets
    const GOOGLE_SHEETS_API = 'https://script.google.com/macros/s/AKfycbxXLDeq4DoUOWUlmAM4yWdnPDxyWPBbzFbOSoMRNlsavPJNvtiKWUzok8ed2RkzvcSY/exec';

    const formatCpf = (value: string) => {
        const numbers = value.replace(/\D/g, '');
        if (numbers.length <= 3) return numbers;
        if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
        if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
        return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`;
    };

    const handleCpfChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value;
        const formatted = formatCpf(rawValue);
        setPatientCpf(formatted);
        // Removemos a busca na planilha via CPF pois o script no Google Sheets 
        // estava criando linhas em branco achando que era um novo agendamento.
    };

    // Resolve o preço da consulta buscando nos serviços
    const getDoctorPrice = () => {
        if (!doctor) return null;

        // Valor normal para Dr. André
        if (doctor.name.toLowerCase().includes('andré') || doctor.name.toLowerCase().includes('andre')) {
            return 'R$ 280,00';
        }

        if (services && services.length > 0) {
            const specToSearch = selectedSpecialty || doctor.specialty;

            // Procura o serviço correspondente comparando doctor.name e selecionadaEspecialidade
            let matchingService = services.find(s => {
                const desc = s.description.toLowerCase();
                const drName = s.doctorResponsible.toLowerCase();
                const docName = doctor.name.toLowerCase();

                return desc.includes('consulta') &&
                    (drName === docName || drName.includes(docName) || docName.includes(drName)) &&
                    (desc.includes(specToSearch.toLowerCase().split(' ')[0]) || s.specialtyRelated.toLowerCase().includes(specToSearch.toLowerCase().split(' ')[0]));
            });

            // Se não encontrou pela especialidade exata, tenta só pelo nome do médico
            if (!matchingService) {
                matchingService = services.find(s => {
                    const desc = s.description.toLowerCase();
                    const drName = s.doctorResponsible.toLowerCase();
                    const docName = doctor.name.toLowerCase();
                    return desc.includes('consulta') && (drName === docName || drName.includes(docName) || docName.includes(drName));
                });
            }

            if (matchingService && matchingService.price && !matchingService.price.toLowerCase().includes('consultar')) {
                return matchingService.price;
            }
        }

        return doctor.price ? `R$ ${Number(doctor.price).toFixed(2).replace('.', ',')}` : 'A consultar';
    };

    const handleApplyCoupon = async () => {
        setCouponError('');
        
        if (patientCpf.replace(/\D/g, '').length !== 11) {
            setCouponError('Por favor, preencha seu CPF no início do formulário para validarmos a disponibilidade do cupom.');
            return;
        }

        if (couponCode.trim().toUpperCase() === 'DRANDRE10') {
            const isDrAndre = effectiveDoctor?.name?.toLowerCase().includes('andré') || effectiveDoctor?.name?.toLowerCase().includes('andre');
            if (isDrAndre) {
                // Aplica o cupom localmente sem enviar para o Google Sheets
                // para evitar a criação de linhas em branco.
                setIsCouponApplied(true);
                setCouponError('');
            } else {
                setIsCouponApplied(false);
                setCouponError('Este cupom é válido apenas para o Dr. André.');
            }
        } else {
            setIsCouponApplied(false);
            setCouponError('Cupom inválido.');
        }
    };

    const processPriceWithDiscount = (originalPriceStr: string | null | undefined): { original: string, current: string, hasDiscount: boolean } => {
        if (!originalPriceStr || typeof originalPriceStr !== 'string') return { original: 'A consultar', current: 'A consultar', hasDiscount: false };

        const hasCurrentFormat = originalPriceStr.toLowerCase().includes('r$');
        if (!hasCurrentFormat) return { original: originalPriceStr, current: originalPriceStr, hasDiscount: false };

        const match = originalPriceStr.match(/[\d.,]+/);
        if (!match) return { original: originalPriceStr, current: originalPriceStr, hasDiscount: false };

        const valueStr = match[0].replace(/\./g, '').replace(',', '.');
        const value = parseFloat(valueStr);

        if (isNaN(value)) return { original: originalPriceStr, current: originalPriceStr, hasDiscount: false };

        let discount = 0;
        if (isCouponApplied && (effectiveDoctor?.name?.toLowerCase().includes('andré') || effectiveDoctor?.name?.toLowerCase().includes('andre'))) {
            discount = value * 0.10; // 10%
        }

        if (discount > 0) {
            const newValue = value - discount;
            const formattedNew = `R$ ${newValue.toFixed(2).replace('.', ',')}`;
            return { original: originalPriceStr, current: formattedNew, hasDiscount: true };
        }

        return { original: originalPriceStr, current: originalPriceStr, hasDiscount: false };
    };

    const isProtocol = type === 'exam' && !!(item as any).image;

    // Gera dias úteis se o médico tem agenda segunda-sexta OU se for exame (regra igual Dr. André)
    // Se for exame e tiver médico responsável, usa a regra dele. Se não tiver médico (null), usa regra padrão (Semana Aberta)
    // Para Protocolos, oculta o calendário.
    const showCalendar = (type === 'exam' && !isProtocol) || (effectiveDoctor ? hasWeekdaySchedule(effectiveDoctor) : false);
    const weekdays = useMemo(() => showCalendar ? getNextDays(60) : [], [showCalendar]);

    // Auto-seleciona especialidade se houver apenas uma (apenas doctors)
    React.useEffect(() => {
        if (doctor && showCalendar && doctor.specialties && doctor.specialties.length === 1) {
            setSelectedSpecialty(doctor.specialties[0]);
        } else if (doctor && showCalendar && !doctor.specialties) {
            setSelectedSpecialty(doctor.specialty);
        }
    }, [showCalendar, doctor]);

    // Auto-seleciona o horário se houver apenas uma opção disponível (ex: 'Ordem de Chegada')
    React.useEffect(() => {
        if (selectedDate) {
            const slots = getAvailableTimeSlots(selectedDate, effectiveDoctor, type === 'exam' ? service?.description : undefined, docApptType);
            if (slots.length === 1) {
                setSelectedTime(slots[0]);
            } else {
                setSelectedTime('');
            }
        }
    }, [selectedDate, effectiveDoctor, type, service, docApptType]);

    // Formata telefone: (99) 99999-9999
    const formatPhone = (value: string) => {
        const numbers = value.replace(/\D/g, '');
        if (numbers.length <= 2) return numbers;
        if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
        if (numbers.length <= 11) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
        return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
    };

    // Fecha o modal após tela de sucesso
    const handleCloseSuccess = () => {
        onClose();
    };

    // Avança para a etapa de dados do paciente
    const handleProceedToPatientData = () => {
        // Envia evento de Lead ao avançar para preenchimento de dados
        if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
            window.fbq('track', 'InitiateCheckout', {
                content_name: doctor ? doctor.name : (service ? service.description : 'Exame'),
                content_category: type
            });
        }
        setCurrentStep('patientData');
    };

    // Estado de loading durante envio
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'CREDIT_CARD'>('PIX');

    // Confirma o agendamento final
    const handleConfirm = async () => {
        if (patientName.trim() && patientPhone.trim()) {
            setIsSubmitting(true);

            try {
                // Helper para garantir formato DD/MM/YYYY
                const formatDateForSheet = (date: Date) => {
                    const day = String(date.getDate()).padStart(2, '0');
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const year = date.getFullYear();
                    return `${day}/${month}/${year}`;
                };

                let finalHorario = selectedTime || selectedSlot || 'A combinar';

                // REGRA PARA MÉDICOS (PRESENCIAL): Sempre Ordem de Chegada
                if (type === 'doctor' && docApptType !== 'telemedicina' && effectiveDoctor && selectedDate) {
                    const dateKey = formatDateForSheet(selectedDate);
                    let turnoParaODia = '';
                    
                    if (effectiveDoctor.dateSpecificTurnos?.[dateKey]) {
                        turnoParaODia = effectiveDoctor.dateSpecificTurnos[dateKey];
                    } else {
                        const genericKey = Object.keys(effectiveDoctor.dateSpecificTurnos || {}).find(k => !k.includes('/'));
                        if (genericKey) {
                            turnoParaODia = effectiveDoctor.dateSpecificTurnos[genericKey];
                        }
                    }

                    if (turnoParaODia) {
                        const capitalizedTurno = turnoParaODia.charAt(0).toUpperCase() + turnoParaODia.slice(1).toLowerCase();
                        finalHorario = `Ordem de Chegada (${capitalizedTurno})`;
                    } else {
                        finalHorario = 'Ordem de Chegada';
                    }
                }

                // Prepara dados para enviar ao Google Sheets
                let cleanedCpf = patientCpf.replace(/\D/g, "");
                if (cleanedCpf.length > 0) cleanedCpf = cleanedCpf.padStart(11, '0');
                const formattedCpfForSheet = cleanedCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");

                const appointmentData = {
                    nome_paciente: patientName.trim().toUpperCase() || 'NÃO INFORMADO',
                    telefone: patientPhone.trim() || 'NÃO INFORMADO',
                    medico: doctor ? doctor.name : (service ? service.doctorResponsible : 'Sem Médico Responsável'),
                    doctor_id: effectiveDoctor?.id || null,
                    especialidade: doctor ? (selectedSpecialty || doctor.specialty) : (service ? service.description : 'Exame'),
                    data_consulta: selectedDate ? formatDateForSheet(selectedDate) : 'A combinar',
                    horario: (docApptType === 'telemedicina') ? (selectedTime || 'Online') : finalHorario,
                    tipo: type === 'doctor' ? (docApptType === 'consulta' ? 'Consulta' : docApptType === 'telemedicina' ? 'Telemedicina' : 'Retorno') : 'Exame',
                    cupom: isCouponApplied && couponCode ? couponCode.trim().toUpperCase() : '',
                    cpf: formattedCpfForSheet,
                    pagamento: '' // Será preenchido se for telemedicina
                };


                // Se for telemedicina, gera o link de checkout e abre direto
                if (appointmentData.tipo === 'Telemedicina') {
                    // Preço da consulta em centavos
                    let amountValue = 15000; // R$ 150,00 default
                    const rawPrice = getDoctorPrice();
                    if (rawPrice) {
                       const priceInfo = processPriceWithDiscount(rawPrice);
                       const valStr = priceInfo.current.replace(/[^\d,]/g, '').replace(',', '.');
                       const parsed = parseFloat(valStr);
                       if (!isNaN(parsed)) amountValue = Math.round(parsed * 100);
                    }


                    const checkoutRes = await fetch('/api/checkout-asaas', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            patientId: user?.id || 'anonimo',
                            amount: amountValue,
                            doctorName: appointmentData.medico,
                            patientName: appointmentData.nome_paciente,
                            patientPhone: appointmentData.telefone,
                            patientCpf: patientCpf,
                            appointmentData: appointmentData,
                            billingType: paymentMethod
                        })
                    });

                    const checkoutData = await checkoutRes.json();
                    if (checkoutData.error) throw new Error(checkoutData.error);
                    
                    if (checkoutData.paymentId) {
                        setPaymentInfo({ 
                            pixCopiaECola: checkoutData.pixCopiaECola || '',
                            qrCodeImage: checkoutData.pixQrCode || '',
                            paymentId: checkoutData.paymentId,
                            checkoutUrl: checkoutData.checkoutUrl
                        });
                    }

                    setAppointmentId('PENDENTE');
                    setCurrentStep('success');
                    setIsSubmitting(false);

                    // Redireciona imediatamente para o checkout do ASAAS
                    if (checkoutData.checkoutUrl) {
                        window.location.assign(checkoutData.checkoutUrl);
                    }
                    return;
                }

                // Envia para o Google Sheets (Fluxo Normal Presencial)
                // IMPORTANTE: Content-Type text/plain evita Preflight (OPTIONS) que o Google Script não suporta
                const response = await fetch(GOOGLE_SHEETS_API, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'text/plain;charset=utf-8',
                    },
                    body: JSON.stringify(appointmentData)
                });

                const data = await response.json();

                if (data.result === 'success') {
                    setAppointmentId(data.id);

                    // Envia evento de conversão para o Google Analytics 4 (client-side only)
                    sendGAEvent('event', 'agendamento_realizado', {
                        medico: appointmentData.medico,
                        especialidade: appointmentData.especialidade,
                        tipo: appointmentData.tipo,
                        data_consulta: appointmentData.data_consulta,
                    });

                    // Envia evento de conversão para o Google Ads
                    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
                        window.gtag('event', 'agendamento_realizado', {
                            'event_category': 'agendamento',
                            'event_label': appointmentData.medico
                        });
                    }

                    // Envia evento de conversão para o Meta Pixel
                    if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
                        window.fbq('track', 'Schedule', {
                            content_name: appointmentData.medico,
                            content_category: appointmentData.especialidade,
                            value: 0.00,
                            currency: 'BRL'
                        });
                    }

                    setCurrentStep('success');
                } else {
                    throw new Error(data.error || 'Erro desconhecido');
                }

            } catch (error: any) {
                console.error('Erro ao salvar agendamento:', error);
                alert(`Erro ao salvar agendamento: ${error.message || 'Por favor, tente novamente.'}`);
            } finally {
                if (currentStep !== 'payment-method') {
                    setIsSubmitting(false);
                }
            }
        }
    };

    // Verifica se pode avançar para dados do paciente
    const canProceedToPatientData = () => {
        if (isProtocol) return true; // Protocolos podem avançar direto, pois não exigem data/hora

        // Bloqueia se for Holter e o paciente possui marca-passo ou ainda não respondeu
        const isHolter = type === 'exam' && service?.description?.toLowerCase().includes('holter');
        if (isHolter && (hasPacemaker === true || hasPacemaker === null)) return false;

        const isDoctorTypeSelected = type === 'doctor' ? !!docApptType : true;

        if (showCalendar) {
            // Para exames e médicos com calendário, exige Data e Hora.
            // Para Dr. André, o horário não é mais necessário, apenas o dia (Ordem de chegada).
            const isDrAndre = effectiveDoctor?.name?.toLowerCase().includes('andré') || effectiveDoctor?.name?.toLowerCase().includes('andre');

            if (type === 'exam') {
                if (isDrAndre) {
                    return !!(selectedDate && selectedTime);
                }
                return !!(selectedDate && selectedTime);
            }
            if (isDrAndre) {
                return !!(selectedDate && selectedTime && selectedSpecialty && isDoctorTypeSelected);
            }
            return !!(selectedDate && selectedTime && selectedSpecialty && isDoctorTypeSelected);
        }

        if (type === 'doctor' && !docApptType) return false;
        return !!selectedSlot;
    };

    // Verifica se pode confirmar (na etapa de dados)
    const isConfirmDisabled = () => {
        return !String(patientName).trim() || String(patientPhone).replace(/\D/g, '').length < 10 || String(patientCpf).replace(/\D/g, '').length !== 11;
    };

    const displayImage = doctor ? doctor.image : null;

    const protocol = isProtocol ? (item as any) : null;

    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        // Travar scroll do body quando o modal estiver aberto
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = '';
        };
    }, []);

    if (!mounted) return null;

    return createPortal(
        <div className={styles.overlay} onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
        }}>
            <div className={styles.modal} style={isProtocol && currentStep === 'selection' ? { backgroundColor: '#1C1C1E' } : {}}>
                {isProtocol && currentStep === 'selection' ? (
                    <div style={{
                        position: 'relative',
                        width: '100%',
                        height: '300px',
                        flexShrink: 0,
                        backgroundColor: '#1C1C1E',
                        borderTopLeftRadius: 'var(--radius-lg)',
                        borderTopRightRadius: 'var(--radius-lg)'
                    }}>
                        <img
                            src={protocol.image}
                            alt={service?.description}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center bottom', opacity: 0.8 }}
                        />
                        <div style={{
                            position: 'absolute',
                            top: 0, left: 0, right: 0, bottom: 0,
                            background: 'linear-gradient(to bottom, rgba(28,28,30,0.8) 0%, rgba(28,28,30,0) 40%, rgba(28,28,30,0.4) 100%)',
                            pointerEvents: 'none',
                            borderTopLeftRadius: 'var(--radius-lg)',
                            borderTopRightRadius: 'var(--radius-lg)'
                        }}></div>

                        <button onClick={onClose} style={{
                            position: 'absolute', top: '24px', left: '24px',
                            width: '40px', height: '40px', borderRadius: '50%',
                            backgroundColor: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)',
                            border: 'none', color: 'white',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '1.2rem', cursor: 'pointer', zIndex: 10, padding: 0,
                            lineHeight: 0, paddingBottom: '2px'
                        }}>←</button>


                    </div>


                ) : (
                    <div className={styles.header}>
                        <h2 className={styles.title}>
                            {type === 'doctor' ? 'Agendar Consulta' : isProtocol ? 'Agendar Protocolo' : 'Agendar Exame'}
                        </h2>
                        <button className={styles.closeButton} onClick={onClose}>&times;</button>
                    </div>
                )}

                <div className={styles.content} style={isProtocol && currentStep === 'selection' ? {
                    backgroundColor: 'white',
                    borderTopLeftRadius: '24px',
                    borderTopRightRadius: '24px',
                    marginTop: '-24px',
                    position: 'relative',
                    zIndex: 20,
                    padding: '32px 24px 24px 24px'
                } : {}}>
                    {currentStep === 'selection' ? (
                        <>
                            {isProtocol ? (
                                <div style={{ marginBottom: '24px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                        <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', margin: 0, lineHeight: 1.2, maxWidth: '75%' }}>
                                            {service?.description}
                                        </h2>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                                            <span style={{ color: '#f59e0b', fontSize: '1.3rem' }}>★</span>
                                            <span>({protocol.rating ? protocol.rating.toFixed(1) : '4.9'})</span>
                                        </div>
                                    </div>

                                    <p style={{ fontSize: '0.95rem', color: '#64748b', lineHeight: 1.6, margin: '0 0 24px 0', whiteSpace: 'pre-wrap' }}>
                                        {isProtocolDescExpanded ? (
                                            <>
                                                {protocol.fullDescription || 'Um método moderno para ajudar você a emagrecer com mais segurança e eficiência. O protocolo combina estratégias e terapias que auxiliam no controle do apetite, melhora do metabolismo e redução de gordura corporal, com acompanhamento profissional durante todo o processo.'} <strong style={{ color: '#0f172a', cursor: 'pointer' }} onClick={() => setIsProtocolDescExpanded(false)}>...menos</strong>
                                            </>
                                        ) : (
                                            <>
                                                {protocol.shortDescription || 'Um método moderno para ajudar você a emagrecer com mais segurança e eficiência. O protocolo combina estratégias e terapias que auxiliam no controle do apetite...'} <strong style={{ color: '#0f172a', cursor: 'pointer' }} onClick={() => setIsProtocolDescExpanded(true)}>...mais</strong>
                                            </>
                                        )}
                                    </p>

                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: '0 0 16px 0' }}>Características</h3>
                                    <div style={{ display: 'flex', gap: '12px', marginBottom: '32px' }}>
                                        <div style={{ flex: 1, backgroundColor: '#f8fafc', borderRadius: '20px', padding: '16px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', border: '1px solid #f1f5f9' }}>
                                            <div style={{ fontSize: '1.5rem', color: '#0f172a' }}>⏳</div>
                                            <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, textTransform: 'capitalize' }}>Duração</span>
                                            <span style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: 800 }}>45 min</span>
                                        </div>
                                        <div style={{ flex: 1, backgroundColor: '#f8fafc', borderRadius: '20px', padding: '16px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', border: '1px solid #f1f5f9' }}>
                                            <div style={{ fontSize: '1.5rem', color: '#0f172a' }}>🛡️</div>
                                            <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, textTransform: 'capitalize' }}>Tratamento</span>
                                            <span style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: 800 }}>{protocol.treatmentDuration || 'Semanal'}</span>
                                        </div>
                                        <div style={{ flex: 1, backgroundColor: '#f8fafc', borderRadius: '20px', padding: '16px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', border: '1px solid #f1f5f9' }}>
                                            <div style={{ fontSize: '1.5rem', color: '#0f172a', filter: 'grayscale(100%) brightness(0.5)' }}>💉</div>
                                            <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, textTransform: 'capitalize' }}>Via</span>
                                            <span style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: 800 }}>Intravenosa</span>
                                        </div>
                                    </div>


                                </div>
                            ) : (
                                <div className={styles.doctorInfo}>
                                    {displayImage ? (
                                        <img src={displayImage} alt={doctor?.name} className={styles.doctorImage} />
                                    ) : (
                                        <div className={styles.doctorImage} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' }}>
                                            {type === 'exam' ? <Activity size={32} color="#94a3b8" /> : <User size={32} color="#94a3b8" />}
                                        </div>
                                    )}
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
                                            {doctor ? doctor.name : service?.description}
                                        </h3>
                                        <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b', fontWeight: 500 }}>
                                            {doctor ? doctor.specialty : (service?.price || '')}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Seleção de Tipo de Atendimento - APENAS PARA MÉDICOS */}
                            {type === 'doctor' && (
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <h4 style={{ marginBottom: '1rem', fontWeight: 600 }}>Como deseja ser atendido?</h4>
                                    
                                    {/* NÍVEL 1: MODALIDADE */}
                                    <div className={styles.modalitySelector}>
                                        <button
                                            className={`${styles.modalityButton} ${modality === 'presencial' ? styles.modalitySelected : ''}`}
                                            onClick={() => {
                                                setModality('presencial');
                                                setDocApptType(null); // Reseta a sub-escolha ao mudar
                                                setSelectedDate(null); // Reset date on modality change
                                                setSelectedTime(null);
                                                setSelectedSlot(null);
                                            }}
                                        >
                                            <div className={styles.modalityIcon}>🏥</div>
                                            <div className={styles.modalityInfo}>
                                                <span className={styles.modalityTitle}>Presencial</span>
                                                <span className={styles.modalityDesc}>Na clínica</span>
                                            </div>
                                        </button>

                                        {(doctor?.name?.toLowerCase().includes('andré') || doctor?.name?.toLowerCase().includes('andre')) && (
                                            <button
                                                className={`${styles.modalityButton} ${modality === 'telemedicina' ? styles.modalitySelected : ''}`}
                                                onClick={() => {
                                                    if (!user) {
                                                        if (confirm('Para agendar telemedicina, é necessário estar logado. Deseja fazer login agora?')) {
                                                            window.location.assign('/login');
                                                        }
                                                        return;
                                                    }
                                                    setModality('telemedicina');
                                                    setDocApptType('telemedicina');
                                                    setSelectedDate(null); // Reset date on modality change
                                                    setSelectedTime(null);
                                                    setSelectedSlot(null);
                                                    
                                                    // Evento Analytics: Selecionou Telemedicina
                                                    sendGAEvent('event', 'telemedicine_selection', {
                                                        medico: doctor?.name
                                                    });
                                                }}
                                            >
                                                <div className={styles.modalityIcon}>💻</div>
                                                <div className={styles.modalityInfo}>
                                                    <span className={styles.modalityTitle}>Telemedicina</span>
                                                    <span className={styles.modalityDesc}>Online / Vídeo</span>
                                                </div>
                                                {!user && <span className={styles.lockBadge}>🔒 Login</span>}
                                            </button>
                                        )}
                                    </div>

                                    {/* NÍVEL 2: TIPO (APENAS SE PRESENCIAL) */}
                                    {modality === 'presencial' && (
                                        <div style={{ marginTop: '1.25rem', animation: 'fadeIn 0.3s ease-out' }}>
                                            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#64748b', marginBottom: '0.75rem' }}>Escolha o tipo de consulta presencial:</p>
                                            <div className={styles.typeSelector}>
                                                <button
                                                    className={`${styles.typeButton} ${docApptType === 'consulta' ? styles.typeSelected : ''}`}
                                                    onClick={() => setDocApptType('consulta')}
                                                >
                                                    <span className={styles.typeIcon}>🩺</span>
                                                    <span>Consulta</span>
                                                </button>
                                                <button
                                                    className={`${styles.typeButton} ${docApptType === 'retorno' ? styles.typeSelected : ''}`}
                                                    onClick={() => setDocApptType('retorno')}
                                                >
                                                    <span className={styles.typeIcon}>🔄</span>
                                                    <span>Retorno</span>
                                                </button>
                                            </div>

                                            {docApptType === 'retorno' && (
                                                <div style={{
                                                    backgroundColor: '#fffbeb',
                                                    borderLeft: '4px solid #f59e0b',
                                                    borderRadius: '0 8px 8px 0',
                                                    padding: '12px 14px',
                                                    marginTop: '16px',
                                                    display: 'flex',
                                                    alignItems: 'flex-start',
                                                    gap: '10px'
                                                }}>
                                                    <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>⚠️</span>
                                                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#92400e', lineHeight: 1.4, fontWeight: 500 }}>
                                                        {doctor?.name?.toLowerCase().includes('andré') || doctor?.name?.toLowerCase().includes('andre')
                                                            ? 'O retorno deve ser marcado em até 20 dias após a data da primeira consulta.'
                                                            : 'O retorno deve ser marcado em até 30 dias após a data da primeira consulta.'}
                                                    </p>
                                                </div>
                                            )}

                                        </div>
                                    )}

                                    {/* NÍVEL 3: ESPECIALIDADE (Aparece tanto em Presencial quanto Telemedicina se o médico tiver mais de uma) */}
                                    {doctor && doctor.specialties && doctor.specialties.length > 1 && docApptType && (
                                        <div style={{ marginTop: '1.25rem', animation: 'fadeIn 0.3s ease-out' }}>
                                            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#64748b', marginBottom: '0.75rem' }}>Escolha a especialidade:</p>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                                {doctor.specialties.map((spec) => (
                                                    <button
                                                        key={spec}
                                                        type="button"
                                                        onClick={() => setSelectedSpecialty(spec)}
                                                        style={{
                                                            padding: '8px 16px',
                                                            borderRadius: '20px',
                                                            border: '1px solid',
                                                            borderColor: selectedSpecialty === spec ? '#cb1e28' : '#e2e8f0',
                                                            backgroundColor: selectedSpecialty === spec ? '#fff1f2' : 'white',
                                                            color: selectedSpecialty === spec ? '#cb1e28' : '#64748b',
                                                            fontSize: '0.875rem',
                                                            fontWeight: 600,
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s'
                                                        }}
                                                    >
                                                        {spec}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Se for exame normal, mostra info extra */}
                            {!isProtocol && type === 'exam' && (
                                <div style={{
                                    padding: 'var(--spacing-md)',
                                    background: '#f8fafc',
                                    borderRadius: 'var(--radius-md)',
                                    marginTop: 'var(--spacing-lg)',
                                    marginBottom: 'var(--spacing-lg)'
                                }}>
                                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                        Selecione uma data e horário abaixo para seu exame.
                                    </p>
                                </div>
                            )}

                            {/* Pergunta sobre Marca-Passo - APENAS para Holter 24h */}
                            {type === 'exam' && service?.description?.toLowerCase().includes('holter') && (
                                <div style={{
                                    padding: '16px 20px',
                                    background: '#f8fafc',
                                    borderRadius: '12px',
                                    border: '1px solid #e2e8f0',
                                    marginTop: '8px',
                                    marginBottom: '16px'
                                }}>
                                    <p style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '1.1rem' }}>❤️‍🩹</span> Você possui marca-passo?
                                    </p>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button
                                            type="button"
                                            onClick={() => setHasPacemaker(false)}
                                            style={{
                                                flex: 1,
                                                padding: '8px 10px',
                                                borderRadius: '8px',
                                                border: hasPacemaker === false ? '2px solid #16a34a' : '2px solid #e2e8f0',
                                                background: hasPacemaker === false ? '#f0fdf4' : 'white',
                                                color: hasPacemaker === false ? '#166534' : '#475569',
                                                fontWeight: 600,
                                                fontSize: '0.85rem',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '5px'
                                            }}
                                        >
                                            {hasPacemaker === false && <span>✓</span>} Não possuo
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setHasPacemaker(true)}
                                            style={{
                                                flex: 1,
                                                padding: '8px 10px',
                                                borderRadius: '8px',
                                                border: hasPacemaker === true ? '2px solid #dc2626' : '2px solid #e2e8f0',
                                                background: hasPacemaker === true ? '#fef2f2' : 'white',
                                                color: hasPacemaker === true ? '#991b1b' : '#475569',
                                                fontWeight: 600,
                                                fontSize: '0.85rem',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '5px'
                                            }}
                                        >
                                            {hasPacemaker === true && <span>✓</span>} Sim, possuo
                                        </button>
                                    </div>

                                    {hasPacemaker === true && (
                                        <div style={{
                                            marginTop: '14px',
                                            backgroundColor: '#fef2f2',
                                            borderLeft: '4px solid #dc2626',
                                            borderRadius: '0 8px 8px 0',
                                            padding: '14px 16px',
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            gap: '10px'
                                        }}>
                                            <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>🚫</span>
                                            <div>
                                                <p style={{ margin: 0, fontSize: '0.9rem', color: '#991b1b', lineHeight: 1.5, fontWeight: 600 }}>
                                                    Exame não indicado para portadores de marca-passo
                                                </p>
                                                <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem', color: '#7f1d1d', lineHeight: 1.5, fontWeight: 400 }}>
                                                    O exame de Holter 24h não pode ser realizado em pacientes com marca-passo. Por favor, consulte seu médico para alternativas.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Calendário: Para médicos com agenda segunda-sexta OU Exames */}
                        {/* 3. Calendário de Dias Disponíveis */}
                        {showCalendar && (type === 'exam' || !!docApptType) && (
                            <div className={styles.calendarContainer}>
                                <h4 className={styles.sectionTitle}><Calendar size={16} color="#cb1e28" /> Escolha o Dia</h4>
                                <div className={styles.calendarGrid}>
                                    {weekdays.map((date, idx) => {
                                        const isAvailable = isDateAvailableForDoctor(date, effectiveDoctor, service, docApptType);
                                        if (!isAvailable) return null;

                                        const isSelected = selectedDate?.toDateString() === date.toDateString();

                                        return (
                                            <div
                                                key={idx}
                                                className={`${styles.calendarDay} ${isSelected ? styles.calendarSelected : ''}`}
                                                onClick={() => setSelectedDate(date)}
                                            >
                                                <span className={styles.dayName}>
                                                    {date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}
                                                </span>
                                                <span className={styles.dayNumber}>{date.getDate()}</span>
                                                <span className={styles.dayMonth}>
                                                    {date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* 4. Horários Disponíveis */}
                        {selectedDate && (
                            <div style={{ marginBottom: '32px' }}>
                                <h4 className={styles.sectionTitle}><Clock size={16} color="#cb1e28" /> Horários Disponíveis</h4>
                                <div className={styles.timeGrid}>
                                    {getAvailableTimeSlots(selectedDate, effectiveDoctor, type === 'exam' ? service?.description : undefined, docApptType).map((slot, idx) => (
                                        slot === 'Ordem de Chegada' ? (
                                            <button
                                                key={idx}
                                                className={`${styles.arrivalOrderCard} ${selectedTime === slot ? styles.selected : ''}`}
                                                onClick={() => setSelectedTime(slot)}
                                            >
                                                <div className={styles.arrivalIcon}>
                                                    <Clock size={22} />
                                                </div>
                                                <div className={styles.arrivalInfo}>
                                                    <div className={styles.arrivalTitle}>Ordem de Chegada</div>
                                                    <div className={styles.arrivalDesc}>Atendimento por turno (Manhã)</div>
                                                </div>
                                                {selectedTime === slot && <CheckCircle2 size={20} color="#cb1e28" />}
                                            </button>
                                        ) : (
                                            <button
                                                key={idx}
                                                className={`${styles.timeSlot} ${selectedTime === slot ? styles.timeSelected : ''}`}
                                                onClick={() => setSelectedTime(slot)}
                                            >
                                                {slot}
                                            </button>
                                        )
                                    ))}
                                </div>
                            </div>
                        )}


                                    {/* Alerta de Informação Adicional do Exame/Serviço ou Médico */}
                                    {((type === 'exam' && service?.additionalInfo) || (type === 'doctor' && doctor?.additionalInfo)) && (
                                        <div style={{
                                            backgroundColor: '#fff1f2', // red-50
                                            borderLeft: '4px solid #cb1e28', // Brand Red
                                            padding: '16px',
                                            marginTop: '24px',
                                            marginBottom: '24px',
                                            borderRadius: '8px',
                                            display: 'flex',
                                            alignItems: 'start',
                                            gap: '12px',
                                            boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)'
                                        }}>
                                            <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>ℹ️</span>
                                            <div>
                                                <strong style={{ display: 'block', color: '#99161e', marginBottom: '4px', fontSize: '0.9rem' }}>
                                                    Observação Importante
                                                </strong>
                                                <p style={{ margin: 0, color: '#99161e', fontSize: '0.9rem', lineHeight: 1.5 }}>
                                                    {type === 'exam' ? service?.additionalInfo : doctor?.additionalInfo}
                                                </p>
                                            </div>
                                        </div>
                                    )}


                                    {/* Turno Dinâmico do Dr. André */}
                                    {(effectiveDoctor?.name?.toLowerCase().includes('andré') || effectiveDoctor?.name?.toLowerCase().includes('andre')) && selectedDate && docApptType !== 'telemedicina' && (
                                        <div style={{
                                            padding: '8px 0 16px 0',
                                            display: 'flex',
                                            justifyContent: 'center',
                                            animation: 'fadeIn 0.3s ease-in-out'
                                        }}>
                                            {(() => {
                                                const dayStr = String(selectedDate.getDate()).padStart(2, '0');
                                                const monthStr = String(selectedDate.getMonth() + 1).padStart(2, '0');
                                                const yearStr = selectedDate.getFullYear();
                                                const dateKey = `${dayStr}/${monthStr}/${yearStr}`;

                                                let turnoParaODia = '';
                                                if (effectiveDoctor.dateSpecificTurnos && effectiveDoctor.dateSpecificTurnos[dateKey]) {
                                                    turnoParaODia = effectiveDoctor.dateSpecificTurnos[dateKey];
                                                } else if (effectiveDoctor.dateSpecificTurnos) {
                                                    const genericKey = Object.keys(effectiveDoctor.dateSpecificTurnos).find(k => !k.includes('/'));
                                                    if (genericKey) {
                                                        turnoParaODia = effectiveDoctor.dateSpecificTurnos[genericKey];
                                                    }
                                                }

                                                const turnoDisplay = turnoParaODia ? turnoParaODia.toUpperCase() : 'MANHÃ';

                                                return (
                                                    <div style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        padding: '6px 14px',
                                                        background: '#fff1f2', // Vermelho bem clarinho (50)
                                                        border: '1px solid #fecdd3', // Borda vermelha super discreta (200)
                                                        borderRadius: '999px',
                                                        fontSize: '0.85rem',
                                                        color: '#881337', // Texto em um vermelho bem escuro
                                                        fontWeight: 500
                                                    }}>
                                                        <span style={{ fontSize: '0.9rem', color: '#cb1e28' }}>🕒</span>
                                                        Turno de atendimento: <strong style={{ color: '#cb1e28' }}>{turnoDisplay}</strong>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    )}

                            
                            {!user && (
                                <p style={{ fontSize: '0.85rem', color: '#64748b', textAlign: 'center', marginTop: '24px', marginBottom: '0' }}>
                                    Já tem uma conta? <button onClick={() => window.location.assign('/login')} style={{ background: 'none', border: 'none', color: '#cb1e28', fontWeight: 700, padding: 0, cursor: 'pointer', textDecoration: 'underline' }}>Entre aqui</button> para preencher seus dados automaticamente.
                                </p>
                            )}
                        </>
                    ) : currentStep === 'patientData' ? (
                        /* Etapa de Dados do Paciente */
                        <>
                            <div className={styles.patientFormHeader}>
                                <button
                                    className={styles.backButton}
                                    onClick={() => setCurrentStep('selection')}
                                >
                                    ← Voltar
                                </button>
                                <h4 style={{ fontWeight: 600, marginBottom: 'var(--spacing-sm)' }}>📋 Dados do Paciente</h4>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                    Preencha seus dados para confirmar o agendamento
                                </p>
                                {!user && (
                                    <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '8px' }}>
                                        Já tem uma conta? <button onClick={() => window.location.assign('/login')} style={{ background: 'none', border: 'none', color: '#cb1e28', fontWeight: 700, padding: 0, cursor: 'pointer', textDecoration: 'underline' }}>Entre aqui</button>
                                    </p>
                                )}
                            </div>

                            {user && !profile ? (
                                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                                    <div className={styles.loadingSpinner}></div>
                                    <p>Carregando seus dados...</p>
                                </div>
                            ) : (
                                <>
                                    <div className={styles.appointmentSummary}>
                                        <p><strong>{type === 'doctor' ? 'Médico' : 'Exame'}:</strong> {doctor ? doctor.name : service?.description}</p>
                                        {type === 'doctor' && <p><strong>Especialidade:</strong> {selectedSpecialty || doctor?.specialty}</p>}
                                        <p><strong>Tipo:</strong> {type === 'doctor' ? (docApptType === 'telemedicina' ? 'Telemedicina' : (docApptType === 'consulta' ? 'Consulta' : 'Retorno')) : 'Exame'}</p>
                                        <p><strong>Data/Horário:</strong> {docApptType === 'telemedicina' ? 'Atendimento Online' : (selectedDate ? (effectiveDoctor?.name?.toLowerCase().includes('andré') || effectiveDoctor?.name?.toLowerCase().includes('andre') ? `${formatDate(selectedDate)} (Ordem de chegada)` : `${formatDate(selectedDate)} - ${selectedTime}`) : (selectedSlot || 'A combinar'))}</p>
                                        {(() => {
                                            const rawPrice = type === 'doctor'
                                                ? (docApptType === 'retorno' ? 'A consultar (pode ser isento)' : getDoctorPrice())
                                                : (service?.price || 'A consultar');

                                            const priceInfo = processPriceWithDiscount(rawPrice);

                                            return (
                                                <p>
                                                    <strong>Valor:</strong>{' '}
                                                    {priceInfo.hasDiscount ? (
                                                        <>
                                                            <span style={{ textDecoration: 'line-through', color: '#94a3b8', marginRight: '8px' }}>{priceInfo.original}</span>
                                                            <strong style={{ color: '#16a34a' }}>{priceInfo.current} (-10%)</strong>
                                                        </>
                                                    ) : (
                                                        priceInfo.original
                                                    )}
                                                </p>
                                            );
                                        })()}
                                    </div>

                                    {/* Campo de Cupom - Apenas se NÃO for Telemedicina */}
                                    {docApptType !== 'telemedicina' && (
                                        <div style={{ marginTop: '16px', marginBottom: '8px', padding: '16px', background: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e1', boxSizing: 'border-box', width: '100%' }}>
                                            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Possui cupom de desconto?</label>
                                            <div style={{ display: 'flex', gap: '8px', boxSizing: 'border-box', width: '100%' }}>
                                                <input
                                                    type="text"
                                                    value={couponCode}
                                                    onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponError(''); }}
                                                    placeholder="Ex: CUPOM10"
                                                    style={{ flex: 1, minWidth: 0, padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem', textTransform: 'uppercase', boxSizing: 'border-box' }}
                                                    disabled={isCouponApplied}
                                                />
                                                {isCouponApplied ? (
                                                    <button
                                                        onClick={() => { setIsCouponApplied(false); setCouponCode(''); setCouponError(''); }}
                                                        style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', padding: '0 16px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0 }}
                                                    >
                                                        Remover
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={handleApplyCoupon}
                                                        style={{ background: '#0f172a', color: 'white', border: 'none', borderRadius: '8px', padding: '0 16px', fontWeight: 600, cursor: isValidatingCoupon ? 'not-allowed' : 'pointer', transition: 'all 0.2s', flexShrink: 0, opacity: isValidatingCoupon ? 0.7 : 1 }}
                                                    >
                                                        {isValidatingCoupon ? '...' : 'Aplicar'}
                                                    </button>
                                                )}
                                            </div>
                                            {couponError && <p style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '6px', marginBottom: 0 }}>{couponError}</p>}
                                            {isCouponApplied && <p style={{ color: '#16a34a', fontSize: '0.8rem', marginTop: '6px', marginBottom: 0 }}>Cupom aplicado com sucesso!</p>}
                                        </div>
                                    )}

                            <div className={styles.formGroup} style={{ position: 'relative' }}>
                                <label htmlFor="patientCpf" className={styles.formLabel}>
                                    CPF *
                                </label>
                                <input
                                    type="text"
                                    id="patientCpf"
                                    className={styles.formInput}
                                    placeholder="Digite seu CPF para puxar dados rápidos"
                                    value={patientCpf}
                                    onChange={handleCpfChange}
                                    maxLength={14}
                                    style={{ borderColor: isFetchingData ? '#3b82f6' : '' }}
                                />
                                {isFetchingData && (
                                    <span style={{ position: 'absolute', right: '12px', top: '40px', fontSize: '0.8rem', color: '#3b82f6', fontWeight: 600 }}>
                                        Buscando...
                                    </span>
                                )}
                            </div>

                            <div className={styles.formGroup}>
                                <label htmlFor="patientName" className={styles.formLabel}>
                                    Nome Completo *
                                </label>
                                <input
                                    type="text"
                                    id="patientName"
                                    className={styles.formInput}
                                    placeholder="Digite seu nome completo"
                                    value={patientName}
                                    onChange={(e) => setPatientName(e.target.value)}
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label htmlFor="patientPhone" className={styles.formLabel}>
                                    Telefone/WhatsApp *
                                </label>
                                <input
                                    type="tel"
                                    id="patientPhone"
                                    className={styles.formInput}
                                    placeholder="(99) 99999-9999"
                                    value={patientPhone}
                                    onChange={(e) => setPatientPhone(formatPhone(e.target.value))}
                                    maxLength={15}
                                />
                            </div>

                            {/* Removido o campo Altura e Peso conforme solicitado */}

                            {/* Aviso de Pagamento Presencial (Apenas se NÃO for Telemedicina) */}
                            {docApptType !== 'telemedicina' && (
                                <div style={{
                                    backgroundColor: '#f8fafc',
                                    borderLeft: '3px solid #10b981',
                                    borderRadius: '6px',
                                    padding: '12px 16px',
                                    marginTop: '16px',
                                    marginBottom: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    boxShadow: '0 1px 2px 0 rgba(0,0,0,0.02)'
                                }}>
                                    <span style={{ fontSize: '1.1rem', filter: 'grayscale(0.2)' }}>💳</span>
                                    <p style={{
                                        margin: 0,
                                        fontSize: '0.85rem',
                                        color: '#334155',
                                        lineHeight: 1.5,
                                        fontWeight: 400
                                    }}>
                                        Pagamento realizado na <strong style={{ color: '#0f172a' }}>recepção da clínica</strong> no dia {type === 'doctor' ? 'da consulta' : 'do exame'}.
                                    </p>
                                </div>
                            )}

                            {/* Aviso de Pagamento Online (Telemedicina) */}
                            {docApptType === 'telemedicina' && (
                                <div style={{
                                    backgroundColor: '#fff5f5',
                                    borderLeft: '3px solid #cb1e28',
                                    borderRadius: '6px',
                                    padding: '12px 16px',
                                    marginTop: '16px',
                                    marginBottom: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    boxShadow: '0 1px 2px 0 rgba(0,0,0,0.02)'
                                }}>
                                    <span style={{ fontSize: '1.1rem' }}>💻</span>
                                    <p style={{
                                        margin: 0,
                                        fontSize: '0.85rem',
                                        color: '#991b1b',
                                        lineHeight: 1.5,
                                        fontWeight: 400
                                    }}>
                                        O pagamento da telemedicina é feito agora via <strong style={{ color: '#cb1e28' }}>PIX ou Cartão de Crédito (até 12x)</strong> na próxima etapa.
                                    </p>
                                </div>
                            )}

                            {/* Aviso de Ordem de Chegada */}
                            {docApptType !== 'telemedicina' && (
                                <div style={{
                                    backgroundColor: '#fff6f6',
                                    borderLeft: '3px solid #ef4444',
                                    borderRadius: '6px',
                                    padding: '12px 16px',
                                    marginBottom: '16px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    boxShadow: '0 1px 2px 0 rgba(0,0,0,0.02)'
                                }}>
                                    <span style={{ fontSize: '1.1rem' }}>⏱️</span>
                                    <p style={{
                                        margin: 0,
                                        fontSize: '0.85rem',
                                        color: '#7f1d1d',
                                        lineHeight: 1.5,
                                        fontWeight: 400
                                    }}>
                                        <strong style={{ color: '#991b1b', fontWeight: 600 }}>Atenção:</strong> O atendimento é por ordem de chegada, independente do horário.
                                    </p>
                                </div>
                            )}
                        </>
                    )}
                </>
                    ) : (
                        /* Tela de Sucesso */
                        <div className={styles.successScreen}>
                            {(docApptType as string) !== 'telemedicina' && (
                                <>
                                    <div className={styles.successIcon}>✓</div>
                                    <h3 className={styles.successTitle}>Solicitação Enviada!</h3>
                                    <p className={styles.successMessage}>
                                        Sua solicitação foi enviada para nossa equipe. Em breve entraremos em contato para confirmar.
                                    </p>
                                </>
                            )}
                            <div className={styles.successDetails}>
                                <div style={{
                                    background: paymentStatus === 'approved' ? 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)' : 'linear-gradient(135deg, #fff5f5 0%, #ffffff 100%)',
                                    border: paymentStatus === 'approved' ? '1px solid #bbf7d0' : '1px solid #fee2e2',
                                    padding: '24px 20px',
                                    borderRadius: '20px',
                                    marginBottom: '24px',
                                    textAlign: 'center',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '12px',
                                    boxShadow: '0 8px 20px rgba(0, 0, 0, 0.04)'
                                }}>
                                    <div style={{
                                        width: '52px',
                                        height: '52px',
                                        borderRadius: '50%',
                                        backgroundColor: paymentStatus === 'approved' ? '#dcfce7' : '#fff1f2',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '1.5rem',
                                        border: paymentStatus === 'approved' ? '1px solid #86efac' : '1px solid #fecaca'
                                    }}>
                                        {(docApptType as string) === 'telemedicina' ? (
                                            paymentStatus === 'approved' ? '✅' : '⏳'
                                        ) : '👤'}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        {(docApptType as string) === 'telemedicina' ? (
                                            <>
                                                <p style={{ margin: 0, fontSize: '1.05rem', color: paymentStatus === 'approved' ? '#16a34a' : '#0f172a', fontWeight: 800, lineHeight: 1.3 }}>
                                                    {paymentStatus === 'approved' ? 'Pagamento Confirmado!' : 'Aguardando Pagamento...'}
                                                </p>
                                                <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b', lineHeight: 1.5 }}>
                                                    {paymentStatus === 'approved' 
                                                        ? 'Seu agendamento já está visível no seu perfil e o médico já foi notificado.' 
                                                        : 'Após concluir o pagamento, esta tela será atualizada automaticamente.'}
                                                </p>
                                            </>
                                        ) : (
                                            <>
                                                <p style={{ margin: 0, fontSize: '1.05rem', color: '#0f172a', fontWeight: 800, lineHeight: 1.3 }}>
                                                    Gerencie tudo pelo seu Perfil
                                                </p>
                                                <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b', lineHeight: 1.5 }}>
                                                    Acesse a aba <strong style={{ color: '#cb1e28', fontWeight: 700 }}>&quot;Meu Perfil&quot;</strong> para visualizar seus agendamentos.
                                                </p>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <p><strong>{type === 'doctor' ? 'Médico' : 'Exame'}:</strong> {doctor ? doctor.name : service?.description}</p>
                                <p><strong>Paciente:</strong> {patientName}</p>
                                <p><strong>Telefone:</strong> {patientPhone}</p>
                            </div>

                            {(docApptType as string) !== 'telemedicina' && (
                                <div style={{
                                    backgroundColor: '#fff8f8',
                                    borderLeft: '4px solid #cb1e28',
                                    borderRadius: '8px',
                                    padding: '16px',
                                    marginTop: '8px',
                                    marginBottom: '24px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '14px'
                                }}>
                                    <span style={{ fontSize: '1.4rem' }}>⏱️</span>
                                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569', lineHeight: 1.5, textAlign: 'left' }}>
                                        <strong style={{ color: '#cb1e28', fontWeight: 800 }}>Atenção:</strong> Atendimento realizado por <strong>ordem de chegada</strong>.
                                    </p>
                                </div>
                            )}

                            {!profile && (
                                <div style={{ 
                                    marginTop: '24px', 
                                    marginBottom: '20px', 
                                    padding: '20px', 
                                    backgroundColor: '#f8fafc', 
                                    borderRadius: '16px', 
                                    border: '1px solid #e2e8f0',
                                    textAlign: 'center'
                                }}>
                                    <p style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: '#334155', fontWeight: 600 }}>
                                        Quer gerenciar seus agendamentos?
                                    </p>
                                    <button 
                                        onClick={() => window.location.assign('/login')}
                                        style={{ width: '100%', padding: '12px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '1000px', fontWeight: 700, cursor: 'pointer' }}
                                    >
                                        Entrar ou Criar Conta
                                    </button>
                                </div>
                            )}

                            {docApptType === 'telemedicina' && paymentInfo?.paymentId && paymentStatus === 'pending' && (
                                <div style={{ 
                                    backgroundColor: '#ffffff', 
                                    padding: '24px', 
                                    borderRadius: '16px', 
                                    border: '1px solid #e2e8f0',
                                    marginBottom: '24px',
                                    textAlign: 'center',
                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                                }}>
                                    <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', color: '#0f172a', fontWeight: 700 }}>Quase lá!</h3>
                                    <p style={{ margin: '0 0 20px 0', fontSize: '0.9rem', color: '#64748b', lineHeight: 1.5 }}>
                                        Realize o pagamento via <strong>Pix ou Cartão</strong> para confirmar sua consulta:
                                    </p>
                                    <button
                                        onClick={() => window.open(paymentInfo.checkoutUrl, '_blank')}
                                        style={{ 
                                            padding: '12px 32px', 
                                            backgroundColor: '#cb1e28', 
                                            color: 'white', 
                                            border: 'none', 
                                            borderRadius: '1000px', 
                                            fontWeight: 700, 
                                            fontSize: '0.9rem', 
                                            cursor: 'pointer',
                                            display: 'inline-block'
                                        }}
                                    >
                                        PAGAR AGORA
                                    </button>
                                </div>
                            )}

                            <button
                                className={styles.successButton}
                                onClick={handleCloseSuccess}
                            >
                                Fechar
                            </button>
                        </div>
                    )}
                </div>

                {currentStep !== 'success' && (
                    isProtocol && currentStep === 'selection' ? (
                        <div style={{
                            padding: '16px 24px',
                            borderTop: '1px solid #f1f5f9',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            backgroundColor: 'white',
                            borderBottomLeftRadius: 'var(--radius-lg)',
                            borderBottomRightRadius: 'var(--radius-lg)',
                            position: 'sticky',
                            bottom: 0,
                            zIndex: 30
                        }}>
                            <a
                                href={`https://wa.me/91984176630?text=${encodeURIComponent(`Olá, gostaria de saber mais sobre o ${protocol?.description || 'protocolo'}.`)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => {
                                    sendGAEvent('event', 'protocol_whatsapp_click', {
                                        protocolo: protocol?.description
                                    });
                                }}
                                style={{
                                    backgroundColor: '#25D366',
                                    color: 'white',
                                    padding: '10px 24px',
                                    borderRadius: '32px',
                                    fontWeight: 700,
                                    fontSize: '0.95rem',
                                    border: 'none',
                                    boxShadow: '0 4px 12px rgba(37, 211, 102, 0.3)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    textDecoration: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
                                </svg>
                                Agendar
                            </a>
                        </div>
                    ) : (
                        <div className={styles.footer}>
                            <button
                                style={{
                                    background: 'transparent',
                                    border: '1px solid #e2e8f0',
                                    padding: '0.75rem 1.5rem',
                                    borderRadius: 'var(--radius-md)',
                                    cursor: 'pointer',
                                    fontWeight: 500
                                }}
                                onClick={onClose}
                            >
                                Cancelar
                            </button>
                            {currentStep === 'selection' ? (
                                <button
                                    className={styles.confirmButton}
                                    disabled={!canProceedToPatientData()}
                                    onClick={() => {
                                        if (docApptType === 'telemedicina') {
                                            sendGAEvent('event', 'telemedicine_begin_checkout', {
                                                medico: doctor?.name
                                            });
                                        } else if (isProtocol) {
                                            sendGAEvent('event', 'protocol_begin_checkout', {
                                                protocolo: protocol?.description
                                            });
                                        }
                                        handleProceedToPatientData();
                                    }}
                                >
                                    Continuar →
                                </button>
                            ) : (
                                <button
                                    className={styles.confirmButton}
                                    disabled={isConfirmDisabled() || isSubmitting}
                                    onClick={() => {
                                        if (docApptType === 'telemedicina') {
                                            sendGAEvent('event', 'telemedicine_purchase_init', {
                                                medico: doctor?.name,
                                                valor: getDoctorPrice()
                                            });
                                        }
                                        handleConfirm();
                                    }}
                                >
                                    {isSubmitting ? 'Processando...' : 
                                     (docApptType as string) === 'telemedicina' ? 'Finalizar e Pagar →' : 
                                     `Confirmar ${type === 'doctor' ? 'Agendamento' : 'Solicitação'}`}
                                </button>
                            )}
                        </div>
                    )
                )}
            </div>
        </div>,
        document.body
    );
}
