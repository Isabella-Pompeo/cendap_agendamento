
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
                        background: 'white',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid #e2e8f0',
                        padding: '12px 16px',
                        boxShadow: 'var(--shadow-sm)',
                        gap: '12px',
                    }}>
                        <SearchIcon />
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
                <div style={{ maxWidth: '500px', margin: '0 auto', background: 'white', padding: '24px', borderRadius: '16px', boxShadow: 'var(--shadow-md)' }}>
                    <h3 style={{ textAlign: 'center', marginBottom: '8px', color: '#cb1e28' }}>Consultar Status</h3>
                    <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                        Digite o código fornecido no momento do agendamento.
                    </p>

                    <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                        <input
                            type="text"
                            placeholder="Ex: 4c5ad713"
                            value={searchId}
                            onChange={(e) => setSearchId(e.target.value)}
                            style={{
                                flex: 1,
                                padding: '12px',
                                borderRadius: '8px',
                                border: '1px solid #e2e8f0',
                                fontSize: '1rem'
                            }}
                        />
                        <button
                            onClick={handleSearchAppointment}
                            disabled={isSearching || !searchId}
                            style={{
                                background: '#cb1e28',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '0 24px',
                                fontWeight: 600,
                                cursor: isSearching ? 'not-allowed' : 'pointer',
                                opacity: isSearching ? 0.7 : 1
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
                                    background: searchResult.status === 'Confirmado' ? '#dcfce7' : '#fef9c3',
                                    color: searchResult.status === 'Confirmado' ? '#166534' : '#854d0e',
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

