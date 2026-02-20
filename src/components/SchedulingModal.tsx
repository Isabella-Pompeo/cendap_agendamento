'use client';

import React, { useState, useMemo } from 'react';
import styles from './SchedulingModal.module.css';
import { Doctor } from '../data/mocks';
import { Service } from '../lib/sheets';
import { sendGAEvent } from '@next/third-parties/google';

interface SchedulingModalProps {
    item: Doctor | Service;
    type: 'doctor' | 'exam';
    doctors?: Doctor[];
    services?: Service[];
    onClose: () => void;
    onConfirm: (slot: string, appointmentType: string) => void;
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

// Horários disponíveis: 8:00 até 14:00
const TIME_SLOTS = [
    '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00'
];

// Filtra horários passados se o dia selecionado for hoje
function getAvailableTimeSlots(selectedDate: Date | null, doctor: Doctor | null | undefined): string[] {
    let availableSlots = TIME_SLOTS;
    const doctorName = doctor?.name;

    // Verifica se é Dr. André ou Técnicos (horários de 08:00 até 11:00)
    const isDrAndre = doctorName && (doctorName.toLowerCase().includes('andré') || doctorName.toLowerCase().includes('andre'));
    const isTecnicos = doctorName && (doctorName.toLowerCase().includes('técnicos') || doctorName.toLowerCase().includes('tecnicos'));

    if (isDrAndre || isTecnicos) {
        // Dr. André e Técnicos: horários de 08:00 até 11:00
        availableSlots = TIME_SLOTS.filter(slot => {
            const slotHour = parseInt(slot.split(':')[0], 10);
            return slotHour <= 11;
        });
    } else if (doctor?.startTime || doctor?.dateSpecificTimes) {
        // Verifica se tem horário específico para a data selecionada
        if (selectedDate && doctor.dateSpecificTimes) {
            const dayStr = String(selectedDate.getDate()).padStart(2, '0');
            const monthStr = String(selectedDate.getMonth() + 1).padStart(2, '0');
            const yearStr = selectedDate.getFullYear();
            const dateKey = `${dayStr}/${monthStr}/${yearStr}`;

            if (doctor.dateSpecificTimes[dateKey]) {
                return [doctor.dateSpecificTimes[dateKey]];
            }
        }

        // Fallback: Se tiver horário padrão (startTime), usa ele.
        if (doctor?.startTime) {
            availableSlots = [doctor.startTime];
        } else {
            // Se não tiver nem específico nem padrão, e não for Dr. André/Técnicos, fallback para lista completa? 
            // Ou vazio? O código original usava TIME_SLOTS se doctor não tivesse startTime.
            // Vamos manter o comportamento seguro de mostrar TIME_SLOTS se nada definido.
            availableSlots = TIME_SLOTS;
        }
    }

    if (!selectedDate) return availableSlots;

    const today = new Date();
    const isToday = selectedDate.getDate() === today.getDate() &&
        selectedDate.getMonth() === today.getMonth() &&
        selectedDate.getFullYear() === today.getFullYear();

    if (!isToday) return availableSlots;

    const currentHour = today.getHours();
    return availableSlots.filter(slot => {
        const slotHour = parseInt(slot.split(':')[0], 10);
        return slotHour > currentHour; // Só mostra horários futuros
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

// Verifica se o dia específico está disponível para aquele médico
function isDateAvailableForDoctor(date: Date, doctor: Doctor | null): boolean {
    const day = date.getDay(); // 0 = Domingo, 6 = Sábado
    const isWeekend = day === 0 || day === 6;

    if (!doctor) {
        // Se não tem médico responsável definido, não mostra nenhuma data disponível
        return false;
    }

    const dateStr = (doctor.date || '').toLowerCase();
    const doctorName = doctor.name?.toLowerCase() || '';

    // Verifica se é Dr. André ou Técnicos (atendem segunda-sexta)
    const isDrAndre = doctorName.includes('andré') || doctorName.includes('andre');
    const isTecnicos = doctorName.includes('técnicos') || doctorName.includes('tecnicos');

    if (isDrAndre || isTecnicos) {
        // Feriados onde Dr. André e Técnicos NÃO atendem
        const feriados = ['17/02/2026'];
        const dayNum = String(date.getDate()).padStart(2, '0');
        const monthNum = String(date.getMonth() + 1).padStart(2, '0');
        const yearNum = date.getFullYear();
        const currentDateStr = `${dayNum}/${monthNum}/${yearNum}`;

        if (feriados.includes(currentDateStr)) {
            return false; // Feriado - não atende
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
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
    const [appointmentType, setAppointmentType] = useState<'consulta' | 'retorno' | 'exame'>(type === 'exam' ? 'exame' : /* placeholder */ 'consulta');
    // Hack: Usamos um state separado para controlar se o usuário já escolheu para médicos
    const [docApptType, setDocApptType] = useState<'consulta' | 'retorno' | null>(null);

    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedTime, setSelectedTime] = useState<string | null>(null);

    const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);
    const [appointmentId, setAppointmentId] = useState<string | null>(null);

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
    const [patientHeight, setPatientHeight] = useState('');
    const [patientWeight, setPatientWeight] = useState('');
    const [currentStep, setCurrentStep] = useState<'selection' | 'patientData' | 'success'>('selection');

    // Resolve o preço da consulta buscando nos serviços
    const getDoctorPrice = () => {
        if (!doctor) return null;

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

    // Gera dias úteis se o médico tem agenda segunda-sexta OU se for exame (regra igual Dr. André)
    // Se for exame e tiver médico responsável, usa a regra dele. Se não tiver médico (null), usa regra padrão (Semana Aberta)
    const showCalendar = type === 'exam' || (effectiveDoctor ? hasWeekdaySchedule(effectiveDoctor) : false);
    const weekdays = useMemo(() => showCalendar ? getNextDays(60) : [], [showCalendar]);

    // Auto-seleciona especialidade se houver apenas uma (apenas doctors)
    React.useEffect(() => {
        if (doctor && showCalendar && doctor.specialties && doctor.specialties.length === 1) {
            setSelectedSpecialty(doctor.specialties[0]);
        } else if (doctor && showCalendar && !doctor.specialties) {
            setSelectedSpecialty(doctor.specialty);
        }
    }, [showCalendar, doctor]);

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
        setCurrentStep('patientData');
    };

    // Estado de loading durante envio
    const [isSubmitting, setIsSubmitting] = useState(false);

    // URL da API do Google Sheets
    const GOOGLE_SHEETS_API = 'https://script.google.com/macros/s/AKfycbxXLDeq4DoUOWUlmAM4yWdnPDxyWPBbzFbOSoMRNlsavPJNvtiKWUzok8ed2RkzvcSY/exec';

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

                // Prepara dados para enviar ao Google Sheets
                const appointmentData = {
                    nome_paciente: patientName.trim(),
                    telefone: patientPhone.trim(),
                    medico: doctor ? doctor.name : (service ? service.doctorResponsible : 'Sem Médico Responsável'),
                    especialidade: doctor ? (selectedSpecialty || doctor.specialty) : (service ? service.description : 'Exame'),
                    data_consulta: selectedDate ? formatDateForSheet(selectedDate) : 'A combinar',
                    horario: selectedTime || (selectedSlot ? selectedSlot : 'A combinar'),
                    tipo: type === 'doctor' ? (docApptType === 'consulta' ? 'Consulta' : 'Retorno') : 'Exame',
                    altura: patientHeight,
                    peso: patientWeight
                };

                // Envia para o Google Sheets
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

                    setCurrentStep('success');
                } else {
                    throw new Error(data.error || 'Erro desconhecido');
                }

            } catch (error) {
                console.error('Erro ao salvar agendamento:', error);
                alert('Erro ao salvar agendamento. Por favor, tente novamente.');
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    // Verifica se pode avançar para dados do paciente
    const canProceedToPatientData = () => {
        if (showCalendar) {
            // Para exames e médicos com calendário, exige Data e Hora.
            // Médicos exigem especialidade também, mas exames não tem select de especialidade (é o próprio exame).
            if (type === 'exam') {
                return selectedDate && selectedTime;
            }
            return selectedDate && selectedTime && selectedSpecialty;
        }

        if (!docApptType) return false;
        return !!selectedSlot;
    };

    // Verifica se pode confirmar (na etapa de dados)
    const isConfirmDisabled = () => {
        return !patientName.trim() || patientPhone.replace(/\D/g, '').length < 10 || !patientHeight.trim() || !patientWeight.trim();
    };

    const displayImage = doctor ? doctor.image : null;

    return (
        <div className={styles.overlay} onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
        }}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <h2 className={styles.title}>{type === 'doctor' ? 'Agendar Consulta' : 'Agendar Exame'}</h2>
                    <button className={styles.closeButton} onClick={onClose}>&times;</button>
                </div>

                <div className={styles.content}>
                    {currentStep === 'selection' ? (
                        <>
                            <div className={styles.doctorInfo}>
                                {displayImage && (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img src={displayImage} alt={doctor?.name} className={styles.doctorImage} />
                                )}
                                {!displayImage && (
                                    <div className={styles.doctorImage} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', fontSize: '2rem' }}>
                                        🔬
                                    </div>
                                )}
                                <div>
                                    <h3 style={{ fontWeight: 600 }}>{doctor ? doctor.name : service?.description}</h3>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                        {doctor ? doctor.specialty : (service?.price || '')}
                                    </p>
                                </div>
                            </div>

                            {/* Seleção de Tipo de Atendimento - APENAS PARA MÉDICOS */}
                            {type === 'doctor' && (
                                <>
                                    <h4 style={{ marginBottom: 'var(--spacing-md)', fontWeight: 600 }}>Tipo de Atendimento</h4>
                                    <div className={styles.typeSelector}>
                                        <button
                                            className={`${styles.typeButton} ${docApptType === 'consulta' ? styles.typeSelected : ''}`}
                                            onClick={() => setDocApptType('consulta')}
                                        >
                                            <span className={styles.typeIcon}>🩺</span>
                                            <span>Consulta</span>
                                            <span className={styles.typeDesc}>Primeira vez</span>
                                        </button>
                                        <button
                                            className={`${styles.typeButton} ${docApptType === 'retorno' ? styles.typeSelected : ''}`}
                                            onClick={() => setDocApptType('retorno')}
                                        >
                                            <span className={styles.typeIcon}>🔄</span>
                                            <span>Retorno</span>
                                            <span className={styles.typeDesc}>Acompanhamento</span>
                                        </button>
                                    </div>
                                </>
                            )}

                            {/* Se for exame, mostra info extra, mas AGORA mostra calendário também */}
                            {type === 'exam' && (
                                <div style={{ padding: 'var(--spacing-md)', background: '#f8fafc', borderRadius: 'var(--radius-md)', marginTop: 'var(--spacing-lg)', marginBottom: 'var(--spacing-lg)' }}>
                                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                        Selecione uma data e horário abaixo para seu exame.
                                    </p>
                                </div>
                            )}

                            {/* Calendário: Para médicos com agenda segunda-sexta OU Exames */}
                            {showCalendar ? (
                                <>
                                    {/* Seleção de Especialidade (Apenas Doctors) */}
                                    {type === 'doctor' && doctor && doctor.specialties && doctor.specialties.length > 1 && (
                                        <>
                                            <h4 style={{ marginBottom: 'var(--spacing-md)', marginTop: 'var(--spacing-lg)', fontWeight: 600 }}>Especialidade</h4>
                                            <div className={styles.specialtyGrid}>
                                                {doctor.specialties.map((spec) => (
                                                    <button
                                                        key={spec}
                                                        className={`${styles.specialtyButton} ${selectedSpecialty === spec ? styles.specialtySelected : ''}`}
                                                        onClick={() => setSelectedSpecialty(spec)}
                                                    >
                                                        {spec}
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}

                                    <h4 style={{ marginBottom: 'var(--spacing-md)', marginTop: 'var(--spacing-lg)', fontWeight: 600 }}>
                                        📅 Escolha o Dia
                                    </h4>

                                    {/* Instrução clara para o paciente */}
                                    <div style={{
                                        backgroundColor: '#eff6ff',
                                        border: '1px solid #bfdbfe',
                                        borderRadius: '8px',
                                        padding: '10px 14px',
                                        marginBottom: '12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}>
                                        <span style={{ fontSize: '1.1rem' }}>💡</span>
                                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#333', lineHeight: 1.4, fontWeight: 500 }}>
                                            Selecione apenas os dias em <strong style={{ color: '#16a34a' }}>verde</strong>. Os dias em <strong style={{ color: '#dc2626' }}>vermelho</strong> estão indisponíveis e não podem ser selecionados.
                                        </p>
                                    </div>

                                    {/* Legenda visual melhorada */}
                                    <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', fontSize: '0.8rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <div style={{ width: '14px', height: '14px', borderRadius: '4px', background: '#dcfce7', border: '2px solid #16a34a' }}></div>
                                            <span style={{ color: '#166534', fontWeight: 600 }}>✓ Disponível</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <div style={{ width: '14px', height: '14px', borderRadius: '4px', background: '#fee2e2', border: '2px solid #ef4444' }}></div>
                                            <span style={{ color: '#dc2626', fontWeight: 600 }}>✕ Indisponível</span>
                                        </div>
                                    </div>

                                    <div className={styles.calendarGrid}>
                                        {weekdays.map((date, index) => {
                                            const isAvailable = isDateAvailableForDoctor(date, effectiveDoctor);
                                            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                                            const isSelected = selectedDate?.getTime() === date.getTime();

                                            return (
                                                <button
                                                    key={index}
                                                    className={`${styles.calendarDay} ${isSelected ? styles.calendarSelected : ''}`}
                                                    onClick={() => {
                                                        if (isAvailable) setSelectedDate(date);
                                                    }}
                                                    disabled={!isAvailable}
                                                    style={{
                                                        backgroundColor: isSelected ? 'var(--primary)' : (isAvailable ? '#f0fdf4' : '#fee2e2'),
                                                        borderColor: isSelected ? 'var(--primary)' : (isAvailable ? '#86efac' : '#fca5a5'),
                                                        borderWidth: '2px',
                                                        cursor: isAvailable ? 'pointer' : 'not-allowed',
                                                        opacity: isAvailable ? 1 : 0.6,
                                                        color: isSelected ? 'white' : (isAvailable ? 'var(--text-main)' : '#b91c1c'),
                                                        position: 'relative' as const
                                                    }}
                                                    title={!isAvailable ? (isWeekend ? 'Fechado no final de semana' : 'Médico não atende neste dia') : 'Clique para selecionar este dia'}
                                                >
                                                    {!isAvailable && (
                                                        <span style={{
                                                            position: 'absolute',
                                                            top: '2px',
                                                            right: '4px',
                                                            fontSize: '0.6rem',
                                                            lineHeight: 1
                                                        }}>🚫</span>
                                                    )}
                                                    <span className={styles.dayName}>
                                                        {date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}
                                                    </span>
                                                    <span className={styles.dayNumber} style={!isAvailable ? { textDecoration: 'line-through' } : {}}>
                                                        {date.getDate()}
                                                    </span>
                                                    <span className={styles.dayMonth}>
                                                        {date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>

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

                                    {/* Seletor de Data e Hora (Apenas se tiver médico ou for exame com agenda) */}
                                    {selectedDate && (
                                        <>
                                            <h4 style={{ marginBottom: 'var(--spacing-md)', marginTop: 'var(--spacing-lg)', fontWeight: 600 }}>
                                                🕐 Escolha o Horário
                                            </h4>
                                            <div className={styles.timeGrid}>
                                                {getAvailableTimeSlots(selectedDate, effectiveDoctor).length > 0 ? (
                                                    getAvailableTimeSlots(selectedDate, effectiveDoctor).map((time) => (
                                                        <button
                                                            key={time}
                                                            className={`${styles.timeSlot} ${selectedTime === time ? styles.timeSelected : ''}`}
                                                            onClick={() => setSelectedTime(time)}
                                                        >
                                                            {time}
                                                        </button>
                                                    ))
                                                ) : (
                                                    <p style={{ color: 'var(--text-secondary)', gridColumn: '1 / -1' }}>
                                                        Nenhum horário disponível para hoje. Selecione outro dia.
                                                    </p>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </>
                            ) : type === 'doctor' && (
                                <>
                                    <h4 style={{ marginBottom: 'var(--spacing-md)', marginTop: 'var(--spacing-lg)', fontWeight: 600 }}>Horários Disponíveis</h4>
                                    {doctor && doctor.slots.length > 0 ? (
                                        <div className={styles.grid}>
                                            {doctor.slots.map((slot) => (
                                                <button
                                                    key={slot}
                                                    className={`${styles.slot} ${selectedSlot === slot ? styles.selected : ''}`}
                                                    onClick={() => setSelectedSlot(slot)}
                                                >
                                                    {slot}
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <p style={{ color: 'var(--text-secondary)' }}>Nenhum horário disponível para hoje.</p>
                                    )}
                                </>
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
                            </div>

                            <div className={styles.appointmentSummary}>
                                <p><strong>{type === 'doctor' ? 'Médico' : 'Exame'}:</strong> {doctor ? doctor.name : service?.description}</p>
                                {type === 'doctor' && <p><strong>Especialidade:</strong> {selectedSpecialty || doctor?.specialty}</p>}
                                <p><strong>Tipo:</strong> {type === 'doctor' ? (docApptType === 'consulta' ? 'Consulta' : 'Retorno') : 'Exame'}</p>
                                {type === 'doctor' && <p><strong>Data/Horário:</strong> {selectedDate ? `${formatDate(selectedDate)} às ${selectedTime}` : (selectedSlot || 'A combinar')}</p>}
                                <p><strong>Valor:</strong> {type === 'doctor'
                                    ? (docApptType === 'retorno' ? 'A consultar (pode ser isento)' : getDoctorPrice())
                                    : (service?.price || 'A consultar')}
                                </p>
                            </div>

                            {/* Aviso de Pagamento na Recepção */}
                            <div style={{
                                backgroundColor: '#f0fdf4',
                                border: '2px solid #16a34a',
                                borderRadius: '10px',
                                padding: '14px 18px',
                                marginTop: '16px',
                                marginBottom: '8px',
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '12px'
                            }}>
                                <span style={{ fontSize: '1.4rem' }}>💰</span>
                                <p style={{
                                    margin: 0,
                                    fontSize: '0.95rem',
                                    color: '#166534',
                                    lineHeight: 1.6,
                                    fontWeight: 500
                                }}>
                                    O <strong>pagamento</strong> é realizado na <strong>recepção da clínica</strong> no dia {type === 'doctor' ? 'da consulta' : 'do exame'}.
                                </p>
                            </div>

                            {/* Aviso de Ordem de Chegada - Vermelho da clínica */}
                            <div style={{
                                backgroundColor: '#fef2f2',
                                border: '2px solid #cb1e28',
                                borderRadius: '10px',
                                padding: '14px 18px',
                                marginTop: '16px',
                                marginBottom: '8px',
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '12px'
                            }}>
                                <span style={{ fontSize: '1.4rem' }}>⚠️</span>
                                <p style={{
                                    margin: 0,
                                    fontSize: '1rem',
                                    color: '#991b1b',
                                    lineHeight: 1.6,
                                    fontWeight: 500
                                }}>
                                    <strong>Atenção:</strong> O atendimento no dia da consulta é realizado por <strong>ordem de chegada</strong>, independente do horário marcado.
                                </p>
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

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div className={styles.formGroup}>
                                    <label htmlFor="patientHeight" className={styles.formLabel}>
                                        Altura (m) *
                                    </label>
                                    <input
                                        type="text"
                                        id="patientHeight"
                                        className={styles.formInput}
                                        placeholder="Ex: 1,75"
                                        value={patientHeight}
                                        onBlur={() => {
                                            const raw = patientHeight.replace(/\D/g, '');
                                            if (raw.length === 2) {
                                                setPatientHeight(`0,${raw}`);
                                            }
                                        }}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, '');
                                            let formatted = val;
                                            if (val.length > 2) {
                                                formatted = val.replace(/(\d)(\d{2})$/, '$1,$2');
                                            }
                                            setPatientHeight(formatted);
                                        }}
                                        maxLength={5}
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label htmlFor="patientWeight" className={styles.formLabel}>
                                        Peso (kg) *
                                    </label>
                                    <input
                                        type="number"
                                        id="patientWeight"
                                        className={styles.formInput}
                                        placeholder="Ex: 70"
                                        value={patientWeight}
                                        onChange={(e) => setPatientWeight(e.target.value)}
                                    />
                                </div>
                            </div>
                        </>
                    ) : currentStep === 'success' ? (
                        /* Tela de Sucesso */
                        <div className={styles.successScreen}>
                            <div className={styles.successIcon}>✓</div>
                            <h3 className={styles.successTitle}>Solicitação Enviada!</h3>
                            <p className={styles.successMessage}>
                                Sua solicitação foi enviada para nossa equipe.
                                Em breve entraremos em contato para confirmar.
                            </p>
                            <div style={{
                                backgroundColor: '#fef3c7',
                                border: '1px solid #f59e0b',
                                borderRadius: '8px',
                                padding: '12px 16px',
                                marginTop: '16px',
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '10px'
                            }}>
                                <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                                <p style={{
                                    margin: 0,
                                    fontSize: '0.875rem',
                                    color: '#92400e',
                                    lineHeight: 1.5
                                }}>
                                    <strong>Importante:</strong> O atendimento no dia da consulta é realizado por <strong>ordem de chegada</strong>, independente do horário agendado.
                                </p>
                            </div>
                            <div className={styles.successDetails}>
                                {appointmentId && (
                                    <div style={{
                                        background: '#f0f9ff',
                                        border: '1px solid #bae6fd',
                                        padding: '12px',
                                        borderRadius: '8px',
                                        marginBottom: '16px',
                                        textAlign: 'center'
                                    }}>
                                        <p style={{ margin: '0 0 4px 0', fontSize: '0.9rem', color: '#0369a1' }}>Seu código de agendamento:</p>
                                        <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold', color: '#0284c7', letterSpacing: '1px' }}>
                                            {appointmentId}
                                        </p>
                                        <p style={{ margin: '8px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                                            Guarde este código para consultar o status do seu agendamento.
                                        </p>
                                    </div>
                                )}
                                <p><strong>{type === 'doctor' ? 'Médico' : 'Exame'}:</strong> {doctor ? doctor.name : service?.description}</p>
                                <p><strong>Paciente:</strong> {patientName}</p>
                                <p><strong>Telefone:</strong> {patientPhone}</p>
                            </div>
                            <button
                                className={styles.successButton}
                                onClick={handleCloseSuccess}
                            >
                                Fechar
                            </button>
                        </div>
                    ) : null}
                </div>

                {currentStep !== 'success' && (
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
                                onClick={handleProceedToPatientData}
                            >
                                Continuar →
                            </button>
                        ) : (
                            <button
                                className={styles.confirmButton}
                                disabled={isConfirmDisabled() || isSubmitting}
                                onClick={handleConfirm}
                            >
                                {isSubmitting ? 'Enviando...' : `Confirmar ${type === 'doctor' ? 'Agendamento' : 'Solicitação'}`}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
