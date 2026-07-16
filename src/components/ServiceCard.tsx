import React from 'react';
import styles from './DoctorCard.module.css'; // Reusing styles for consistency
import { Service } from '../data/mocks';

interface ServiceCardProps {
    service: Service;
    onSchedule: (service: Service) => void;
}

// Mapeia especialidade/descrição para ícone específico
function getServiceIcon(service: Service): string {
    const text = `${service.description} ${service.specialtyRelated} ${service.doctorResponsible}`.toLowerCase();

    if (text.includes('ortopedia') || text.includes('ortopédico')) return '🦴';
    if (text.includes('pediatria') || text.includes('criança') || text.includes('infantil')) return '👶';
    if (text.includes('obstetric') || text.includes('pré-natal') || text.includes('gravidez')) return '🤰';
    if (text.includes('ginecolog')) return '🩺';
    if (text.includes('cardiolog') || text.includes('coração') || text.includes('eletro')) return '❤️';
    if (text.includes('neurolog') || text.includes('cérebro') || text.includes('neuro')) return '🧠';
    if (text.includes('oftalmolog') || text.includes('olho') || text.includes('visão')) return '👁️';
    if (text.includes('otorrino') || text.includes('ouvido') || text.includes('nariz')) return '👂';
    if (text.includes('dermatolog') || text.includes('pele')) return '🧴';
    if (text.includes('urolog')) return '🩻';
    if (text.includes('endocrino') || text.includes('hormônio')) return '💉';
    if (text.includes('nutrição') || text.includes('nutri') || text.includes('dieta')) return '🥗';
    if (text.includes('ultrassom') || text.includes('ecografia') || text.includes('eco')) return '📡';
    if (text.includes('raio') || text.includes('radiografia') || text.includes('rx')) return '☢️';
    if (text.includes('ressonância') || text.includes('tomografia')) return '🏥';
    if (text.includes('sangue') || text.includes('hemograma') || text.includes('laborat')) return '🩸';
    if (text.includes('esporte') || text.includes('atleta') || text.includes('físico')) return '🏃';
    if (text.includes('nefro') || text.includes('rim')) return '🫘';

    return '🔬'; // Fallback padrão
}

// Icon for medical service/exam
function ServiceIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
    );
}

function PriceIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="1" x2="12" y2="23"></line>
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
        </svg>
    );
}

// Ícone de calendário
function CalendarIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
    );
}

export default function ServiceCard({ service, onSchedule }: ServiceCardProps) {
    const isConsultation = service.description.toLowerCase().includes('consulta') || service.description.toLowerCase().includes('retorno');
    
    return (
        <div className={styles.card}>
            <div className={styles.imageContainer} style={{ background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '3rem' }}>{getServiceIcon(service)}</span>
            </div>

            <div className={styles.content}>
                <div className={styles.header}>
                    <div className={styles.nameRow}>
                        <h3 className={styles.name}>{service.description}</h3>
                    </div>
                </div>

                <div className={styles.specialty}>{service.doctorResponsible ? `Resp: ${service.doctorResponsible}` : 'Exame de Imagem'}</div>

                <div className={styles.availableTime} style={{ color: 'var(--primary)', fontWeight: 600 }}>
                    <PriceIcon />
                    <span>{service.price}</span>
                </div>

                {isConsultation ? (
                    <button
                        className={styles.scheduleButton}
                        onClick={() => onSchedule(service)}
                    >
                        <CalendarIcon />
                        Agendar Telemedicina
                    </button>
                ) : (
                    <div style={{ marginTop: 'auto', padding: '10px 0', textAlign: 'center', fontSize: '0.85rem', color: '#64748b', fontWeight: 500, background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        Agendamento presencial na clínica
                    </div>
                )}
            </div>
        </div>
    );
}
