import React from 'react';
import styles from './DoctorCard.module.css'; // Reusing styles for consistency
import { Service } from '../lib/sheets';

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

export default function ServiceCard({ service, onSchedule }: ServiceCardProps) {
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

                <button
                    className={styles.scheduleButton}
                    onClick={() => onSchedule(service)}
                >
                    Agendar Exame
                </button>
            </div>
        </div>
    );
}
