import React from 'react';
import styles from './DoctorCard.module.css'; // Reusing styles for consistency
import { Service } from '../lib/sheets';

interface ServiceCardProps {
    service: Service;
    onSchedule: (service: Service) => void;
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
                <span style={{ fontSize: '3rem' }}>🔬</span>
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
