
import React from 'react';
import Image from 'next/image';
import styles from './DoctorCard.module.css';
import { Doctor } from '../data/mocks';

interface DoctorCardProps {
    doctor: Doctor;
    onSchedule: (doctor: Doctor) => void;
    onWaitlist?: (doctor: Doctor) => void;
}

// Ícone de Verificado
function VerifiedIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10.5213 2.62368C11.3147 1.75232 12.6853 1.75232 13.4787 2.62368L14.4989 3.74391C14.8998 4.18418 15.4761 4.42288 16.071 4.39508L17.5845 4.32435C18.7614 4.26934 19.7307 5.23857 19.6757 6.41554L19.6049 7.92905C19.5771 8.52388 19.8158 9.10016 20.2561 9.50111L21.3763 10.5213C22.2477 11.3147 22.2477 12.6853 21.3763 13.4787L20.2561 14.4989C19.8158 14.8998 19.5771 15.4761 19.6049 16.071L19.6757 17.5845C19.7307 18.7614 18.7614 19.7307 17.5845 19.6757L16.071 19.6049C15.4761 19.5771 14.8998 19.8158 14.4989 20.2561L13.4787 21.3763C12.6853 22.2477 11.3147 22.2477 10.5213 21.3763L9.50111 20.2561C9.10016 19.8158 8.52388 19.5771 7.92905 19.6049L6.41554 19.6757C5.23857 19.7307 4.26934 18.7614 4.32435 17.5845L4.39508 16.071C4.42288 15.4761 4.18418 14.8998 3.74391 14.4989L2.62368 13.4787C1.75232 12.6853 1.75232 11.3147 2.62368 10.5213L3.74391 9.50111C4.18418 9.10016 4.42288 8.52388 4.39508 7.92905L4.32435 6.41554C4.26934 5.23857 5.23857 4.26934 6.41554 4.32435L7.92905 4.39508C8.52388 4.42288 9.10016 4.18418 9.50111 3.74391L10.5213 2.62368Z" fill="#cb1e28"/>
            <path d="M10.9999 15.0004L7.49988 11.5004L8.91388 10.0864L10.9999 12.1724L15.0859 8.08643L16.4999 9.50043L10.9999 15.0004Z" fill="white"/>
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
                    <div className={styles.nameRow} style={{ flexWrap: 'nowrap' }}>
                        <h3 className={styles.name}>{doctor.name}</h3>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            backgroundColor: '#fee2e2',
                            color: 'black',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            whiteSpace: 'nowrap'
                        }}>
                            <VerifiedIcon />
                            <span>Verificado</span>
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
