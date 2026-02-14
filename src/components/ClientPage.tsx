
'use client';

import React, { useState, useMemo } from 'react';
import DoctorCard from './DoctorCard';
import ServiceCard from './ServiceCard';
import SchedulingModal from './SchedulingModal';
import { Doctor } from '../data/mocks';
import { Service } from '../lib/sheets';

interface ClientPageProps {
    doctors: Doctor[];
    services: Service[];
}

// Ícone de busca
function SearchIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
        </svg>
    );
}

export default function ClientPage({ doctors, services }: ClientPageProps) {
    const [viewMode, setViewMode] = useState<'doctors' | 'services' | 'search'>('doctors');
    const [selectedItem, setSelectedItem] = useState<Doctor | Service | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState('Todos');

    // Estado para busca de agendamento
    const [searchId, setSearchId] = useState('');
    const [searchResult, setSearchResult] = useState<any>(null);
    const [searchError, setSearchError] = useState('');
    const [isSearching, setIsSearching] = useState(false);

    const GOOGLE_SHEETS_API = 'https://script.google.com/macros/s/AKfycbxXLDeq4DoUOWUlmAM4yWdnPDxyWPBbzFbOSoMRNlsavPJNvtiKWUzok8ed2RkzvcSY/exec';

    const handleSearchAppointment = async () => {
        if (!searchId.trim()) return;
        setIsSearching(true);
        setSearchError('');
        setSearchResult(null);

        try {
            // IMPORTANTE: Content-Type text/plain e stringify para evitar CORS Preflight problemático no Google Apps Script
            const response = await fetch(GOOGLE_SHEETS_API, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'search', id: searchId.trim() })
            });

            const data = await response.json();

            if (data.result === 'success') {
                setSearchResult(data.data);
            } else {
                setSearchError('Agendamento não encontrado. Verifique o ID digitado.');
            }
        } catch (error) {
            console.error(error);
            setSearchError('Erro ao buscar. Tente novamente.');
        } finally {
            setIsSearching(false);
        }
    };

    // Extrair especialidades únicas dos médicos
    const doctorSpecialties = useMemo(() => {
        const uniqueSpecialties = [...new Set(doctors.map(d => d.specialty))];
        return ['Todos', ...uniqueSpecialties];
    }, [doctors]);

    // Filtrar médicos
    const filteredDoctors = useMemo(() => {
        return doctors.filter(doctor => {
            const matchesSearch = doctor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                doctor.specialty.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesFilter = activeFilter === 'Todos' || doctor.specialty === activeFilter;
            return matchesSearch && matchesFilter;
        });
    }, [doctors, searchQuery, activeFilter]);

    // Filtrar serviços
    const filteredServices = useMemo(() => {
        return services.filter(service => {
            return service.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                service.specialtyRelated.toLowerCase().includes(searchQuery.toLowerCase());
        });
    }, [services, searchQuery]);

    const handleSchedule = (item: Doctor | Service) => {
        setSelectedItem(item);
    };

    const handleCloseModal = () => {
        setSelectedItem(null);
    };

    const handleConfirmSchedule = (slot: string, appointmentType: string) => {
        const name = 'name' in (selectedItem!) ? (selectedItem as Doctor).name : (selectedItem as Service).description;
        alert(`Solicitação de ${appointmentType} enviada para ${name}.\nHorário: ${slot}`);
        setSelectedItem(null);
    };

    return (
        <>
            {/* Hero Section */}
            <div style={{
                background: '#cb1e28',
                borderRadius: '0 0 24px 24px',
                padding: '40px var(--spacing-xl) 32px',
                marginBottom: 'var(--spacing-xl)',
                marginLeft: 'calc(-1 * var(--spacing-lg))',
                marginRight: 'calc(-1 * var(--spacing-lg))',
                marginTop: 'calc(-1 * var(--spacing-lg))',
                color: 'white',
                boxShadow: '0 20px 25px -5px rgba(239, 68, 68, 0.15), 0 8px 10px -6px rgba(239, 68, 68, 0.1)',
                position: 'relative',
                overflow: 'hidden'
            }}>
                {/* Healthcare pattern background */}
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    opacity: 0.15,
                    pointerEvents: 'none',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3C!-- Medical Cross --%3E%3Crect x='22' y='15' width='6' height='20' rx='2' fill='white'/%3E%3Crect x='15' y='22' width='20' height='6' rx='2' fill='white'/%3E%3C!-- Heart --%3E%3Cpath d='M95 25c-2-4-7-5-10-3s-4 7-2 10l12 14 12-14c2-3 1-8-2-10s-8-1-10 3z' fill='white'/%3E%3C!-- Pill --%3E%3Crect x='160' y='12' width='10' height='26' rx='5' fill='white' transform='rotate(30 165 25)'/%3E%3Cline x1='160' y1='25' x2='170' y2='25' stroke='%23cb1e28' stroke-width='1' transform='rotate(30 165 25)'/%3E%3C!-- Stethoscope circle --%3E%3Ccircle cx='30' cy='90' r='8' fill='none' stroke='white' stroke-width='2'/%3E%3Cpath d='M30 82 C30 70 45 70 45 78' fill='none' stroke='white' stroke-width='2'/%3E%3Ccircle cx='45' cy='80' r='2' fill='white'/%3E%3C!-- Heartbeat --%3E%3Cpolyline points='90,90 100,90 105,75 110,105 115,85 120,90 130,90' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C!-- Syringe --%3E%3Crect x='165' y='80' width='6' height='22' rx='1' fill='white'/%3E%3Crect x='163' y='78' width='10' height='4' rx='1' fill='white'/%3E%3Cline x1='168' y1='102' x2='168' y2='108' stroke='white' stroke-width='2'/%3E%3C!-- DNA --%3E%3Cpath d='M20 155 Q30 145 20 135' fill='none' stroke='white' stroke-width='2'/%3E%3Cpath d='M30 155 Q20 145 30 135' fill='none' stroke='white' stroke-width='2'/%3E%3Cline x1='22' y1='140' x2='28' y2='140' stroke='white' stroke-width='1.5'/%3E%3Cline x1='21' y1='145' x2='29' y2='145' stroke='white' stroke-width='1.5'/%3E%3Cline x1='22' y1='150' x2='28' y2='150' stroke='white' stroke-width='1.5'/%3E%3C!-- Thermometer --%3E%3Crect x='100' y='140' width='6' height='20' rx='3' fill='white'/%3E%3Ccircle cx='103' cy='165' r='5' fill='white'/%3E%3C!-- Bandaid --%3E%3Crect x='155' y='140' width='28' height='12' rx='6' fill='white' transform='rotate(-30 169 146)'/%3E%3Ccircle cx='169' cy='146' r='2' fill='%23cb1e28'/%3E%3C/svg%3E")`,
                    backgroundSize: '120px 120px',
                    backgroundRepeat: 'repeat'
                }} />

                <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
                    <h2 style={{
                        fontSize: '2rem',
                        fontWeight: 700,
                        marginBottom: '8px',
                        letterSpacing: '-0.025em'
                    }}>
                        Agendamento Online
                    </h2>
                    <p style={{
                        fontSize: '1.0625rem',
                        opacity: 0.9,
                        maxWidth: '400px',
                        margin: '0 auto',
                        lineHeight: 1.4
                    }}>
                        Agende sua consulta ou seus exames de forma rápida e prática.
                    </p>
                </div>
            </div>

            {/* Toggle View Mode */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--spacing-lg)' }}>
                <div style={{
                    background: '#f1f5f9',
                    padding: '4px',
                    borderRadius: 'var(--radius-full)',
                    display: 'flex',
                    gap: '4px'
                }}>
                    <button
                        onClick={() => setViewMode('doctors')}
                        style={{
                            padding: '8px 24px',
                            borderRadius: 'var(--radius-full)',
                            border: 'none',
                            background: viewMode === 'doctors' ? 'white' : 'transparent',
                            color: viewMode === 'doctors' ? 'var(--text-main)' : 'var(--text-secondary)',
                            fontWeight: 600,
                            boxShadow: viewMode === 'doctors' ? 'var(--shadow-sm)' : 'none',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        Médicos
                    </button>
                    <button
                        onClick={() => setViewMode('services')}
                        style={{
                            padding: '8px 24px',
                            borderRadius: 'var(--radius-full)',
                            border: 'none',
                            background: viewMode === 'services' ? 'white' : 'transparent',
                            color: viewMode === 'services' ? 'var(--text-main)' : 'var(--text-secondary)',
                            fontWeight: 600,
                            boxShadow: viewMode === 'services' ? 'var(--shadow-sm)' : 'none',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        Exames e Preços
                    </button>
                    <button
                        onClick={() => setViewMode('search')}
                        style={{
                            padding: '8px 24px',
                            borderRadius: 'var(--radius-full)',
                            border: 'none',
                            background: viewMode === 'search' ? 'white' : 'transparent',
                            color: viewMode === 'search' ? 'var(--text-main)' : 'var(--text-secondary)',
                            fontWeight: 600,
                            boxShadow: viewMode === 'search' ? 'var(--shadow-sm)' : 'none',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                    >
                        <span>🔍</span>
                        Minhas Agendas
                    </button>
                </div>
            </div>

            {/* Barra de Busca (Apenas para médicos e serviços) */}
            {viewMode !== 'search' && (
                <div style={{
                    position: 'relative',
                    marginBottom: 'var(--spacing-lg)',
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        background: '#f1f5f9',
                        borderRadius: '9999px',
                        padding: '12px 20px',
                        gap: '12px',
                    }}>
                        <div style={{ color: '#cb1e28' }}>
                            <SearchIcon />
                        </div>
                        <input
                            type="text"
                            placeholder={viewMode === 'doctors' ? "Buscar médico ou especialidade..." : "Buscar exame ou procedimento..."}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                flex: 1,
                                border: 'none',
                                outline: 'none',
                                fontSize: '1rem',
                                color: 'var(--text-main)',
                                background: 'transparent',
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Filtros de Especialidade (apenas para médicos por enquanto) */}
            {viewMode === 'doctors' && (
                <div style={{
                    display: 'flex',
                    gap: '8px',
                    marginBottom: 'var(--spacing-lg)',
                    overflowX: 'auto',
                    paddingBottom: '8px',
                    WebkitOverflowScrolling: 'touch',
                }}>
                    {doctorSpecialties.map((specialty) => (
                        <button
                            key={specialty}
                            onClick={() => setActiveFilter(specialty)}
                            style={{
                                padding: '8px 16px',
                                borderRadius: 'var(--radius-full)',
                                border: activeFilter === specialty ? 'none' : '1px solid #e2e8f0',
                                background: activeFilter === specialty ? 'var(--primary)' : 'white',
                                color: activeFilter === specialty ? 'white' : 'var(--text-secondary)',
                                fontSize: '0.875rem',
                                fontWeight: 500,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                transition: 'all 0.2s',
                            }}
                        >
                            {specialty}
                        </button>
                    ))}
                </div>
            )}

            {/* Tela de Consulta de Agendamento */}
            {viewMode === 'search' && (
                <div style={{ maxWidth: '500px', width: '100%', margin: '0 auto', background: 'white', padding: '24px', borderRadius: '16px', boxShadow: 'var(--shadow-md)' }}>
                    <h3 style={{ textAlign: 'center', marginBottom: '8px', color: '#cb1e28' }}>Consultar Status</h3>
                    <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                        Digite o código fornecido no momento do agendamento.
                    </p>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
                        <input
                            type="text"
                            placeholder="Ex: 4c5ad713"
                            value={searchId}
                            onChange={(e) => setSearchId(e.target.value)}
                            style={{
                                flex: '1 1 200px',
                                padding: '12px 20px',
                                borderRadius: '9999px',
                                border: 'none',
                                background: '#f1f5f9',
                                fontSize: '1rem',
                                outline: 'none'
                            }}
                        />
                        <button
                            onClick={handleSearchAppointment}
                            disabled={isSearching || !searchId}
                            style={{
                                flex: '0 0 auto',
                                background: '#cb1e28',
                                color: 'white',
                                border: 'none',
                                borderRadius: '9999px',
                                padding: '12px 24px',
                                fontWeight: 600,
                                cursor: isSearching ? 'not-allowed' : 'pointer',
                                opacity: isSearching ? 0.7 : 1,
                                width: 'auto'
                            }}
                        >
                            {isSearching ? '...' : 'Buscar'}
                        </button>
                    </div>

                    {searchError && (
                        <div style={{ padding: '12px', background: '#fee2e2', color: '#ef4444', borderRadius: '8px', textAlign: 'center', marginBottom: '16px' }}>
                            {searchError}
                        </div>
                    )}

                    {searchResult && (
                        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                                <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Status</span>
                                <span style={{
                                    background: searchResult.status?.toLowerCase() === 'confirmado' ? '#dcfce7' : '#fef9c3',
                                    color: searchResult.status?.toLowerCase() === 'confirmado' ? '#166534' : '#854d0e',
                                    padding: '4px 12px', borderRadius: '999px', fontSize: '0.875rem', fontWeight: 600
                                }}>
                                    {searchResult.status}
                                </span>
                            </div>

                            {/* Aviso de Informação Adicional - Igual ao Modal */}
                            {searchResult.info_adicional && (
                                <div style={{
                                    backgroundColor: '#fff1f2', // red-50
                                    borderLeft: '4px solid #cb1e28', // Brand Red
                                    padding: '12px',
                                    marginBottom: '16px',
                                    borderRadius: '4px',
                                    display: 'flex',
                                    alignItems: 'start',
                                    gap: '12px'
                                }}>
                                    <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>ℹ️</span>
                                    <div>
                                        <strong style={{ display: 'block', color: '#99161e', marginBottom: '2px', fontSize: '0.85rem' }}>
                                            Observação Importante
                                        </strong>
                                        <p style={{ margin: 0, color: '#99161e', fontSize: '0.85rem', lineHeight: 1.4 }}>
                                            {searchResult.info_adicional}
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'grid', gap: '12px' }}>
                                <div>
                                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Paciente</span>
                                    <strong style={{ color: 'var(--text-main)' }}>{searchResult.nome}</strong>
                                </div>
                                <div>
                                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Telefone</span>
                                    <strong style={{ color: 'var(--text-main)' }}>{searchResult.telefone || '-'}</strong>
                                </div>
                                <div>
                                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Serviço/Médico</span>
                                    <strong style={{ color: 'var(--text-main)' }}>{searchResult.medico}</strong>
                                </div>
                                <div>
                                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Procedimento/Especialidade</span>
                                    <strong style={{ color: 'var(--text-main)' }}>{searchResult.especialidade}</strong>
                                </div>
                                <div>
                                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Tipo</span>
                                    <strong style={{ color: 'var(--text-main)' }}>{searchResult.tipo || '-'}</strong>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div>
                                        <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Data</span>
                                        <strong style={{ color: 'var(--text-main)' }}>
                                            {(() => {
                                                const val = searchResult.data_consulta;
                                                if (!val) return '-';
                                                if (typeof val === 'string' && val.includes('T')) {
                                                    try {
                                                        return new Date(val).toLocaleDateString('pt-BR');
                                                    } catch { return val; }
                                                }
                                                return val;
                                            })()}
                                        </strong>
                                    </div>
                                    <div>
                                        <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Horário</span>
                                        <strong style={{ color: 'var(--text-main)' }}>
                                            {(() => {
                                                const val = searchResult.horario;
                                                if (!val) return '-';
                                                if (typeof val === 'string' && (val.includes('T') || val.includes('1899'))) {
                                                    try {
                                                        return new Date(val).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                                                    } catch { return val; }
                                                }
                                                return val;
                                            })()}
                                        </strong>
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Altura</span>
                                    <strong style={{ color: 'var(--text-main)' }}>{searchResult.altura ? `${searchResult.altura} m` : '-'}</strong>
                                </div>
                                <div>
                                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Peso</span>
                                    <strong style={{ color: 'var(--text-main)' }}>{searchResult.peso ? `${searchResult.peso} kg` : '-'}</strong>
                                </div>
                            </div>
                        </div>
                    )}
                </div >
            )
            }
            {/* Lista: Médicos ou Serviços */}
            {
                viewMode !== 'search' && (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0',
                        paddingBottom: 'var(--spacing-xl)'
                    }}>
                        {viewMode === 'doctors' ? (
                            filteredDoctors.length > 0 ? (
                                filteredDoctors.map((doctor) => (
                                    <DoctorCard
                                        key={doctor.id}
                                        doctor={doctor}
                                        onSchedule={handleSchedule}
                                    />
                                ))
                            ) : (
                                <div style={{
                                    textAlign: 'center',
                                    padding: 'var(--spacing-xl)',
                                    color: 'var(--text-secondary)',
                                }}>
                                    Nenhum médico encontrado.
                                </div>
                            )
                        ) : (
                            filteredServices.length > 0 ? (
                                filteredServices.map((service) => (
                                    <ServiceCard
                                        key={service.id}
                                        service={service}
                                        onSchedule={handleSchedule}
                                    />
                                ))
                            ) : (
                                <div style={{
                                    textAlign: 'center',
                                    padding: 'var(--spacing-xl)',
                                    color: 'var(--text-secondary)',
                                }}>
                                    Nenhum exame encontrado.
                                </div>
                            )
                        )}
                    </div>
                )
            }

            {
                selectedItem && (
                    <SchedulingModal
                        item={selectedItem}
                        type={viewMode === 'doctors' ? 'doctor' : 'exam'}
                        doctors={doctors}
                        onClose={handleCloseModal}
                        onConfirm={handleConfirmSchedule}
                    />
                )
            }
        </>
    );
}

