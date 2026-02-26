
import React from 'react';
import Image from 'next/image';
import styles from './DoctorCard.module.css';
import { Doctor } from '../data/mocks';

interface DoctorCardProps {
    doctor: Doctor;
    onSchedule: (doctor: Doctor) => void;
    onWaitlist?: (doctor: Doctor) => void;
}

// Componente de estrelas para rating
function StarIcon({ filled }: { filled: boolean }) {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
    );
}

// Ícone de relógio
function ClockIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
        </svg>
    );
}

// Ícone de localização
function LocationIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
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

export default function DoctorCard({ doctor, onSchedule, onWaitlist }: DoctorCardProps) {
    // Rating simulado (pode vir do backend futuramente)
    const rating = 5.0;

    return (
        <div className={styles.card}>
            <div className={styles.imageContainer}>
                <Image
                    src={doctor.image}
                    alt={doctor.name}
                    width={80}
                    height={80}
                    className={styles.image}
                    onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.onerror = null;
                        target.src = `https://api.dicebear.com/7.x/lorelei-neutral/svg?seed=${encodeURIComponent(doctor.name)}&backgroundColor=e8f5e9`;
                    }}
                />
            </div>

            <div className={styles.content}>
                <div className={styles.header}>
                    <div className={styles.nameRow}>
                        <h3 className={styles.name}>{doctor.name}</h3>
                        <div className={styles.rating}>
                            <span className={styles.stars}>
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <StarIcon key={star} filled={star <= Math.floor(rating)} />
                                ))}
                            </span>
                            <span>{rating.toFixed(1)}</span>
                        </div>
                    </div>
                </div>

                <div className={styles.specialty}>{doctor.specialty}</div>

                {doctor.available && (
                    <div className={styles.availableTime}>
                        <ClockIcon />
                        <span>Disponível: {doctor.date || 'Hoje'}</span>
                    </div>
                )}

                {!doctor.available && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                        <div className={styles.availableTime} style={{ color: '#cb1e28', marginBottom: 0 }}>
                            <ClockIcon />
                            <span>Agenda em breve, aguarde novas datas</span>
                        </div>
                        {onWaitlist && (
                            <button
                                className={styles.waitlistButton}
                                onClick={() => onWaitlist(doctor)}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                                </svg>
                                Me avise
                            </button>
                        )}
                    </div>
                )}

                {/* Botão de Agendar embaixo */}
                {doctor.available && (
                    <button
                        className={styles.scheduleButton}
                        onClick={() => onSchedule(doctor)}
                    >
                        <CalendarIcon />
                        Agendar
                    </button>
                )}
            </div>
        </div>
    );
}
