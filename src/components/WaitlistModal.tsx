'use client';

import React, { useState } from 'react';
import styles from './SchedulingModal.module.css';
import { Doctor } from '../data/mocks';
import { sendGAEvent } from '@next/third-parties/google';

interface WaitlistModalProps {
    doctor: Doctor | null;
    onClose: () => void;
}

declare global {
    interface Window {
        fbq: any;
    }
}

export default function WaitlistModal({ doctor, onClose }: WaitlistModalProps) {
    const [patientName, setPatientName] = useState('');
    const [patientPhone, setPatientPhone] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    // Formata telefone: (99) 99999-9999
    const formatPhone = (value: string) => {
        const numbers = value.replace(/\D/g, '');
        if (numbers.length <= 2) return numbers;
        if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
        if (numbers.length <= 11) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
        return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
    };

    const GOOGLE_SHEETS_API = 'https://script.google.com/macros/s/AKfycbxXLDeq4DoUOWUlmAM4yWdnPDxyWPBbzFbOSoMRNlsavPJNvtiKWUzok8ed2RkzvcSY/exec';

    const handleConfirm = async () => {
        if (!patientName.trim() || patientPhone.replace(/\D/g, '').length < 10 || !doctor) return;

        setIsSubmitting(true);

        try {
            const waitlistData = {
                nome_paciente: patientName.trim(),
                telefone: patientPhone.trim(),
                medico: doctor.name,
                especialidade: doctor.specialty,
                tipo: 'Lista de Espera',
                data_consulta: 'Aguardando Vaga',
                horario: 'Aguardando Vaga',
                altura: '',
                peso: ''
            };

            const response = await fetch(GOOGLE_SHEETS_API, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8',
                },
                body: JSON.stringify(waitlistData)
            });

            const data = await response.json();

            if (data.result === 'success') {
                sendGAEvent('event', 'lista_espera_realizada', {
                    medico: waitlistData.medico,
                    especialidade: waitlistData.especialidade,
                });

                // Envia evento para o Meta Pixel
                if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
                    window.fbq('track', 'Lead', {
                        content_name: waitlistData.medico,
                        content_category: 'Waitlist'
                    });
                }
                setIsSuccess(true);
            } else {
                throw new Error(data.error || 'Erro desconhecido');
            }
        } catch (error) {
            console.error('Erro ao entrar na lista de espera:', error);
            alert('Erro ao processar sua solicitação. Por favor, tente novamente.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const isConfirmDisabled = () => {
        return !patientName.trim() || patientPhone.replace(/\D/g, '').length < 10;
    };

    if (!doctor) return null;

    return (
        <div className={styles.overlay} onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
        }}>
            <div className={styles.modal} style={{ maxWidth: '450px' }}>
                <div className={styles.header}>
                    <h2 className={styles.title}>Lista de Espera</h2>
                    <button className={styles.closeButton} onClick={onClose}>&times;</button>
                </div>

                <div className={styles.content}>
                    {!isSuccess ? (
                        <>
                            <div style={{ marginBottom: '20px', backgroundColor: '#f8fafc', padding: '15px', borderRadius: '8px' }}>
                                <p style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#475569' }}>
                                    Você está entrando na lista de espera para:
                                </p>
                                <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', color: '#0f172a', fontSize: '1.1rem' }}>
                                    👨‍⚕️ {doctor.name}
                                </p>
                                <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>
                                    {doctor.specialty}
                                </p>
                            </div>

                            <p style={{ fontSize: '0.9rem', color: '#475569', marginBottom: '20px', lineHeight: 1.5 }}>
                                Preencha seus dados abaixo. Nossa equipe entrará em contato via WhatsApp assim que surgirem novas vagas na agenda do doutor.
                            </p>

                            <div className={styles.formGroup}>
                                <label htmlFor="waitlistName" className={styles.formLabel}>Nome Completo *</label>
                                <input
                                    type="text"
                                    id="waitlistName"
                                    className={styles.formInput}
                                    placeholder="Digite seu nome completo"
                                    value={patientName}
                                    onChange={(e) => setPatientName(e.target.value)}
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label htmlFor="waitlistPhone" className={styles.formLabel}>Telefone/WhatsApp *</label>
                                <input
                                    type="tel"
                                    id="waitlistPhone"
                                    className={styles.formInput}
                                    placeholder="(99) 99999-9999"
                                    value={patientPhone}
                                    onChange={(e) => setPatientPhone(formatPhone(e.target.value))}
                                    maxLength={15}
                                />
                            </div>
                        </>
                    ) : (
                        <div className={styles.successScreen} style={{ padding: '30px 10px' }}>
                            <div className={styles.successIcon}>✓</div>
                            <h3 className={styles.successTitle}>Você está na lista!</h3>
                            <p className={styles.successMessage}>
                                Entraremos em contato pelo WhatsApp cadastrado ({patientPhone}) assim que abrirmos a agenda.
                            </p>
                            <button className={styles.successButton} onClick={onClose}>
                                Fechar
                            </button>
                        </div>
                    )}
                </div>

                {!isSuccess && (
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
                        <button
                            className={styles.confirmButton}
                            disabled={isConfirmDisabled() || isSubmitting}
                            onClick={handleConfirm}
                        >
                            {isSubmitting ? 'Enviando...' : 'Me Alerta'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
