'use client';

import React from 'react';
import { ProtocolService } from '../app/page';
import { Star } from 'lucide-react';
import SchedulingModal from './SchedulingModal';
import { Doctor, Service } from '../data/mocks';

interface ProtocolCardProps {
    protocol: ProtocolService;
    doctors: Doctor[];
    services: Service[];
}

export default function ProtocolCard({ protocol, doctors, services }: ProtocolCardProps) {
    const [isModalOpen, setIsModalOpen] = React.useState(false);

    const openModal = () => {
        setIsModalOpen(true);
        window.dispatchEvent(new CustomEvent('modal-state-change', { detail: { open: true } }));
    };

    const closeModal = () => {
        setIsModalOpen(false);
        window.dispatchEvent(new CustomEvent('modal-state-change', { detail: { open: false } }));
    };
    
    return (
        <>
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'white',
            borderRadius: '16px',
            overflow: 'hidden',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
            cursor: 'pointer',
            height: '100%',
            transition: 'transform 0.2s ease',
        }}
            onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.02)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
            }}
            onClick={() => {
                openModal();
            }}
        >
            {/* Imagem do Protocolo (Metade superior) */}
            <div style={{
                position: 'relative',
                width: '100%',
                paddingTop: '55%', // Reduzido de 65% para 55% para deixar a imagem menos alta
                backgroundColor: '#f1f5f9',
            }}>
                <img
                    src={protocol.image}
                    alt={protocol.description}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                    }}
                />

                {/* Badge Flutuante (Avaliação/Destaque) */}
                <div style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: '#1e293b',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                    <Star size={12} fill="#eab308" color="#eab308" />
                    {protocol.rating.toFixed(1)}
                </div>
            </div>

            {/* Informações (Metade inferior) */}
            <div style={{
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
            }}>
                <h3 style={{
                    fontSize: '1.1rem',
                    fontWeight: 700,
                    color: '#0f172a',
                    margin: '0 0 4px 0',
                    lineHeight: 1.3,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                }}>
                    {protocol.description}
                </h3>

                <p style={{
                    fontSize: '0.85rem',
                    color: '#64748b',
                    margin: '0 0 12px 0',
                }}>
                    {protocol.doctorResponsible} • {protocol.specialtyRelated}
                </p>

                <div style={{
                    marginTop: 'auto',
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '6px'
                }}>
                    <button style={{
                        marginLeft: 'auto',
                        padding: '8px 20px',
                        backgroundColor: '#cb1e28', 
                        color: '#F8FAFC', 
                        border: 'none',
                        borderRadius: '24px',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease-in-out',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 2px 4px rgba(203, 30, 40, 0.2)'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 4px 8px rgba(203, 30, 40, 0.35)';
                        e.currentTarget.style.backgroundColor = '#a61820';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(203, 30, 40, 0.2)';
                        e.currentTarget.style.backgroundColor = '#cb1e28';
                    }}
                    >
                        Saber mais <span style={{ fontSize: '1rem', lineHeight: 1 }}>→</span>
                    </button>
                </div>
            </div>
        </div>
        
        {isModalOpen && (
            <SchedulingModal
                item={protocol}
                type="exam"
                doctors={doctors}
                services={services}
                onClose={() => closeModal()}
                onConfirm={(slot, type) => {
                    closeModal();
                    alert(`Solicitação de agendamento enviada!\nHorário: ${slot}`);
                }}
            />
        )}
        </>
    );
}
