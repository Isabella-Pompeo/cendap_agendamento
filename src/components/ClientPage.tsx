
'use client';

import Image from 'next/image';

import React, { useState, useMemo } from 'react';
import DoctorCard from './DoctorCard';
import ServiceCard from './ServiceCard';
import SchedulingModal from './SchedulingModal';
import WaitlistModal from './WaitlistModal';
import { Doctor } from '../data/mocks';
import { Service } from '../lib/sheets';
import Fuse from 'fuse.js';

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

// Dados dos banners
const banners = [
    {
        id: 1,
        title: "Comunicado Importante",
        subtitle: "Aviso de feriado de Carnaval.",
        buttonText: "", // Não exibido quando tem imagem
        color: "#cb1e28",
        textColor: "white",
        image: "/banner-carnaval.png"
    },
    {
        id: 2,
        title: "Dicas Médicas",
        subtitle: "Consulte seu médico regularmente para minimizar a incidência de doenças no futuro.",
        buttonText: "Saiba Mais",
        color: "#cb1e28", // Fallback color
        textColor: "white",
        image: "/banner-dicas.png"
    },
    {
        id: 3,
        title: "Especialistas",
        subtitle: "Os melhores médicos à sua disposição para um atendimento de excelência.",
        buttonText: "Ver Médicos",
        color: "#cb1e28",
        textColor: "white",
        image: "/banner-exames.png"
    },
    {
        id: 4,
        title: "Meu Site Cendap",
        subtitle: "Chegou o novo sistema de agendamento da clínica Cendap!",
        buttonText: "Acessar",
        color: "#1e293b",
        textColor: "white",
        image: "/banner-site.png"
    }
];

function BannerCarousel() {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    const minSwipeDistance = 50;

    const onTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
        setIsPaused(true);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const onTouchEnd = () => {
        setIsPaused(false);
        if (!touchStart || !touchEnd) return;

        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;

        if (isLeftSwipe) {
            setCurrentSlide((prev) => (prev + 1) % banners.length);
        } else if (isRightSwipe) {
            setCurrentSlide((prev) => (prev - 1 + banners.length) % banners.length);
        }
    };

    // Mouse Events handlers (simulating swipe)
    const onMouseDown = (e: React.MouseEvent) => {
        e.preventDefault(); // Prevent text selection
        setTouchEnd(null);
        setTouchStart(e.clientX);
        setIsPaused(true);
        setIsDragging(true);
    };

    const onMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        setTouchEnd(e.clientX);
    };

    const onMouseUp = () => {
        if (!isDragging) return;
        setIsDragging(false);
        onTouchEnd(); // Reuse logic
    };

    const onMouseLeave = () => {
        setIsPaused(false);
        if (isDragging) {
            setIsDragging(false);
            onTouchEnd();
        }
    };

    React.useEffect(() => {
        if (isPaused) return;

        const timer = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % banners.length);
        }, 6000);
        return () => clearInterval(timer);
    }, [isPaused]);

    return (
        <div style={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: '24px',
            marginBottom: 'var(--spacing-lg)',
            boxShadow: 'var(--shadow-md)',
            background: 'white',
            height: '180px', // Definindo altura fixa para o container
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none'
        }}
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={onMouseLeave}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
        >
            <div style={{
                display: 'flex',
                transition: 'transform 0.5s ease-in-out',
                transform: `translateX(-${currentSlide * 100}%)`,
            }}>
                {banners.map((banner, index) => (
                    <div key={banner.id} style={{
                        minWidth: '100%',
                        position: 'relative',
                        background: banner.color,
                        padding: '16px 20px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        color: banner.textColor,
                        height: '180px',
                        overflow: 'hidden' // Ensure image stays within bounds
                    }}>
                        {/* Render image if present, otherwise render text content */}
                        {(banner as any).image ? (
                            <Image
                                src={(banner as any).image}
                                alt={banner.title}
                                fill
                                style={{
                                    objectFit: 'cover',
                                }}
                                priority={index === 0}
                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            />
                        ) : (
                            <div style={{ maxWidth: '80%', position: 'relative', zIndex: 1 }}>
                                <h3 style={{
                                    fontSize: '1.25rem',
                                    fontWeight: 800,
                                    marginBottom: '4px',
                                    lineHeight: 1.2
                                }}>
                                    {banner.title}
                                </h3>
                                <p style={{
                                    fontSize: '0.85rem',
                                    opacity: 0.9,
                                    marginBottom: '12px',
                                    lineHeight: 1.3,
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden'
                                }}>
                                    {banner.subtitle}
                                </p>
                                <button style={{
                                    padding: '8px 20px',
                                    background: 'white',
                                    color: '#1e293b',
                                    border: 'none',
                                    borderRadius: '9999px',
                                    fontWeight: 700,
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    transition: 'transform 0.2s',
                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                }}>
                                    {banner.buttonText}
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Navigation Dots */}
            <div style={{
                position: 'absolute',
                bottom: '16px',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                gap: '8px'
            }}>
                {banners.map((_, index) => (
                    <button
                        key={index}
                        onClick={() => setCurrentSlide(index)}
                        style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            border: 'none',
                            background: index === currentSlide ? 'white' : 'rgba(255,255,255,0.4)',
                            padding: 0,
                            cursor: 'pointer',
                            transition: 'all 0.3s'
                        }}
                    />
                ))}
            </div>
        </div>
    );
}

export default function ClientPage({ doctors, services }: ClientPageProps) {
    const [viewMode, setViewMode] = useState<'doctors' | 'services' | 'search'>('doctors');
    const [selectedItem, setSelectedItem] = useState<Doctor | Service | null>(null);
    const [isWaitlistModalOpen, setIsWaitlistModalOpen] = useState(false);
    const [selectedWaitlistDoctor, setSelectedWaitlistDoctor] = useState<Doctor | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState('Todos');

    // Menu hambúrguer + Calculadora IMC
    const [menuOpen, setMenuOpen] = useState(false);
    const [showIMC, setShowIMC] = useState(false);
    const [imcAltura, setImcAltura] = useState('');
    const [imcPeso, setImcPeso] = useState('');
    const [imcResult, setImcResult] = useState<{ value: number; classification: string; color: string } | null>(null);

    const calcularIMC = () => {
        let alturaNum = parseFloat(imcAltura.replace(',', '.'));
        const pesoNum = parseFloat(imcPeso.replace(',', '.'));
        if (!alturaNum || !pesoNum || alturaNum <= 0) return;

        // Se a altura for maior que 3, assume que foi digitada em centímetros
        if (alturaNum > 3) {
            alturaNum = alturaNum / 100;
        }

        const imc = pesoNum / (alturaNum * alturaNum);
        let classification = '';
        let color = '';

        if (imc < 18.5) {
            classification = 'Abaixo do peso';
            color = '#3b82f6';
        } else if (imc < 25) {
            classification = 'Peso normal';
            color = '#16a34a';
        } else if (imc < 30) {
            classification = 'Sobrepeso';
            color = '#f59e0b';
        } else if (imc < 35) {
            classification = 'Obesidade Grau I';
            color = '#f97316';
        } else if (imc < 40) {
            classification = 'Obesidade Grau II';
            color = '#ef4444';
        } else {
            classification = 'Obesidade Grau III';
            color = '#dc2626';
        }

        setImcResult({ value: parseFloat(imc.toFixed(1)), classification, color });
    };

    const resetIMC = () => {
        setImcAltura('');
        setImcPeso('');
        setImcResult(null);
    };

    // Estado para busca de agendamento
    const [searchId, setSearchId] = useState('');
    const [searchResult, setSearchResult] = useState<any>(null);
    const [searchError, setSearchError] = useState('');
    const [isSearching, setIsSearching] = useState(false);

    // Estado para cancelamento de agendamento
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);
    const [cancelSuccess, setCancelSuccess] = useState(false);

    const GOOGLE_SHEETS_API = 'https://script.google.com/macros/s/AKfycbxXLDeq4DoUOWUlmAM4yWdnPDxyWPBbzFbOSoMRNlsavPJNvtiKWUzok8ed2RkzvcSY/exec';

    const handleSearchAppointment = async () => {
        if (!searchId.trim()) return;
        setIsSearching(true);
        setSearchError('');
        setSearchResult(null);
        setCancelSuccess(false);

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

    const handleCancelAppointment = async () => {
        setIsCancelling(true);
        try {
            const response = await fetch(GOOGLE_SHEETS_API, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'cancel', id: searchId.trim() })
            });

            const data = await response.json();

            if (data.result === 'success') {
                setSearchResult({ ...searchResult, status: 'Cancelado' });
                setCancelSuccess(true);
                setShowCancelConfirm(false);
            } else {
                alert('Erro ao cancelar. Tente novamente.');
            }
        } catch (error) {
            console.error(error);
            alert('Erro ao cancelar. Tente novamente.');
        } finally {
            setIsCancelling(false);
        }
    };

    // Extrair especialidades únicas dos médicos e adicionar ícones
    const specialtyIcons: { [key: string]: string } = {
        'Todos': '🩺',
        'Ortopedia': '🦴',
        'Pediatria': '👶',
        'Ginecologia': '🌸',
        'Obstetrícia': '🤰',
        'Cardiologia': '❤️',
        'Clinico Geral': '👨‍⚕️',
        'Clínico Geral': '👨‍⚕️',
        'Dermatologia': '🧴',
        'Oftalmologia': '👁️',
        'Neurologia': '🧠',
        'Endocrinologia': 'ns', // 'ns' seems like a typo or placeholder, using generic gland/hormone icon if possible or just text. Let's start with a safe default.
        'Psiquiatria': '🧠',
        'Nutrição': '🥗',
        'Fisioterapia': '🤸'
    };

    const doctorSpecialties = useMemo(() => {
        const uniqueSpecialties = [...new Set(doctors.map(d => d.specialty))];
        return ['Todos', ...uniqueSpecialties];
    }, [doctors]);

    // Configuração do Fuse.js para médicos
    const doctorFuse = useMemo(() => {
        return new Fuse(doctors, {
            keys: ['name', 'specialty'],
            threshold: 0.3, // 0.0 = exato, 1.0 = qualque coisa. 0.3 é bom para typos leves
            ignoreLocation: true,
            minMatchCharLength: 2
        });
    }, [doctors]);

    // Configuração do Fuse.js para serviços
    const serviceFuse = useMemo(() => {
        return new Fuse(services, {
            keys: ['description', 'specialtyRelated', 'doctorResponsible'],
            threshold: 0.3,
            ignoreLocation: true,
            minMatchCharLength: 2
        });
    }, [services]);

    // Filtrar médicos (Busca Fuzzy + Filtro de Categoria)
    const filteredDoctors = useMemo(() => {
        let results = doctors;

        // 1. Aplicar busca se houver query
        if (searchQuery.trim()) {
            results = doctorFuse.search(searchQuery).map(result => result.item);
        }

        // 2. Aplicar filtro de especialidade
        if (activeFilter !== 'Todos') {
            results = results.filter(doctor => doctor.specialty === activeFilter);
        }

        return results;
    }, [doctors, searchQuery, activeFilter, doctorFuse]);

    // Filtrar serviços (Busca Fuzzy)
    const filteredServices = useMemo(() => {
        if (!searchQuery.trim()) return services;
        return serviceFuse.search(searchQuery).map(result => result.item);
    }, [services, searchQuery, serviceFuse]);

    const handleSchedule = (item: Doctor | Service) => {
        setSelectedItem(item);
    };

    const handleCloseModal = () => {
        setSelectedItem(null);
    };

    const handleWaitlist = (doctor: Doctor) => {
        setSelectedWaitlistDoctor(doctor);
        setIsWaitlistModalOpen(true);
    };

    const handleCloseWaitlistModal = () => {
        setSelectedWaitlistDoctor(null);
        setIsWaitlistModalOpen(false);
    };

    const handleConfirmSchedule = (slot: string, appointmentType: string) => {
        const name = 'name' in (selectedItem!) ? (selectedItem as Doctor).name : (selectedItem as Service).description;
        alert(`Solicitação de ${appointmentType} enviada para ${name}.\nHorário: ${slot}`);
        setSelectedItem(null);
    };

    return (
        <>
            {/* Overlay do Menu */}
            {menuOpen && (
                <div
                    onClick={() => setMenuOpen(false)}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0,0,0,0.5)',
                        zIndex: 998,
                        transition: 'opacity 0.3s'
                    }}
                />
            )}

            {/* Sidebar Drawer */}
            <div style={{
                position: 'fixed',
                top: 0,
                right: menuOpen ? '0' : '-320px',
                width: '300px',
                maxWidth: '85vw',
                height: '100vh',
                background: 'white',
                boxShadow: menuOpen ? '-4px 0 25px rgba(0,0,0,0.15)' : 'none',
                zIndex: 999,
                transition: 'right 0.3s ease-in-out',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }}>
                {/* Header do Menu */}
                <div style={{
                    background: '#cb1e28',
                    padding: '20px 20px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <h3 style={{ color: 'white', margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Menu</h3>
                    <button
                        onClick={() => setMenuOpen(false)}
                        style={{
                            background: 'rgba(255,255,255,0.2)',
                            border: 'none',
                            color: 'white',
                            fontSize: '1.2rem',
                            cursor: 'pointer',
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* Itens do Menu */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
                    <button
                        onClick={() => { setShowIMC(true); setMenuOpen(false); }}
                        style={{
                            width: '100%',
                            padding: '14px 20px',
                            background: 'transparent',
                            border: 'none',
                            borderBottom: '1px solid #f1f5f9',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '14px',
                            cursor: 'pointer',
                            fontSize: '0.95rem',
                            color: '#334155',
                            fontWeight: 500,
                            textAlign: 'left',
                            transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="#334155" xmlns="http://www.w3.org/2000/svg"><path d="m18 24h-12a5.006 5.006 0 0 1 -5-5v-14a5.006 5.006 0 0 1 5-5h12a5.006 5.006 0 0 1 5 5v14a5.006 5.006 0 0 1 -5 5zm-12-22a3 3 0 0 0 -3 3v14a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3v-14a3 3 0 0 0 -3-3zm10 8h-8a3 3 0 0 1 0-6h8a3 3 0 0 1 0 6zm-8-4a1 1 0 0 0 0 2h8a1 1 0 0 0 0-2zm-2 7a1 1 0 1 0 1 1 1 1 0 0 0 -1-1zm4 0a1 1 0 1 0 1 1 1 1 0 0 0 -1-1zm4 0a1 1 0 1 0 1 1 1 1 0 0 0 -1-1zm-8 4a1 1 0 1 0 1 1 1 1 0 0 0 -1-1zm4 0a1 1 0 1 0 1 1 1 1 0 0 0 -1-1zm8-4a1 1 0 1 0 1 1 1 1 0 0 0 -1-1zm1 5a1 1 0 0 0 -1-1h-4a1 1 0 0 0 0 2h4a1 1 0 0 0 1-1z" /></svg>
                        <div>
                            <div>Calculadora de IMC</div>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 400, marginTop: '2px' }}>Calcule seu Índice de Massa Corporal</div>
                        </div>
                    </button>
                    <button
                        onClick={() => { window.open('https://docs.google.com/forms/d/e/1FAIpQLSdbYTpO15kdisIUuf4BqOrvaTwHGgkZFHEkVMcuFnoM6Hhmjg/viewform', '_blank'); setMenuOpen(false); }}
                        style={{
                            width: '100%',
                            padding: '14px 20px',
                            background: 'transparent',
                            border: 'none',
                            borderBottom: '1px solid #f1f5f9',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '14px',
                            cursor: 'pointer',
                            fontSize: '0.95rem',
                            color: '#334155',
                            fontWeight: 500,
                            textAlign: 'left',
                            transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="#334155" xmlns="http://www.w3.org/2000/svg"><path d="M12 .587l3.668 7.431 8.332 1.151-6.064 5.828 1.48 8.279-7.416-3.967-7.417 3.967 1.481-8.279-6.064-5.828 8.332-1.151z" /></svg>
                        <div>
                            <div>Avalie Nossos Serviços</div>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 400, marginTop: '2px' }}>Deixe sua opinião sobre o atendimento</div>
                        </div>
                    </button>
                    <button
                        onClick={() => { window.open('https://docs.google.com/forms/d/e/1FAIpQLSdzJwNbgErU45sePl-qQzxIyanuztxuMAoe9lL2cSc4Cx7Qqg/viewform', '_blank'); setMenuOpen(false); }}
                        style={{
                            width: '100%',
                            padding: '14px 20px',
                            background: 'transparent',
                            border: 'none',
                            borderBottom: '1px solid #f1f5f9',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '14px',
                            cursor: 'pointer',
                            fontSize: '0.95rem',
                            color: '#334155',
                            fontWeight: 500,
                            textAlign: 'left',
                            transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="#334155" xmlns="http://www.w3.org/2000/svg"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
                        <div>
                            <div>Avalie Nossos Colaboradores</div>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 400, marginTop: '2px' }}>Avalie a equipe que lhe atendeu</div>
                        </div>
                    </button>
                </div>

                {/* Footer do Menu */}
                <div style={{
                    padding: '12px 20px',
                    borderTop: '1px solid #e2e8f0',
                    fontSize: '0.75rem',
                    color: '#94a3b8',
                    textAlign: 'center'
                }}>
                    CENDAP © {new Date().getFullYear()}
                </div>
            </div>

            {/* Modal da Calculadora de IMC */}
            {showIMC && (
                <div
                    onClick={(e) => { if (e.target === e.currentTarget) { setShowIMC(false); resetIMC(); } }}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0,0,0,0.5)',
                        zIndex: 1000,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '20px'
                    }}
                >
                    <div style={{
                        background: 'white',
                        borderRadius: '20px',
                        width: '100%',
                        maxWidth: '400px',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                    }}>
                        {/* Header do Modal IMC */}
                        <div style={{
                            background: 'linear-gradient(135deg, #cb1e28 0%, #991b1b 100%)',
                            borderRadius: '20px 20px 0 0',
                            padding: '20px 24px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg"><path d="m18 24h-12a5.006 5.006 0 0 1 -5-5v-14a5.006 5.006 0 0 1 5-5h12a5.006 5.006 0 0 1 5 5v14a5.006 5.006 0 0 1 -5 5zm-12-22a3 3 0 0 0 -3 3v14a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3v-14a3 3 0 0 0 -3-3zm10 8h-8a3 3 0 0 1 0-6h8a3 3 0 0 1 0 6zm-8-4a1 1 0 0 0 0 2h8a1 1 0 0 0 0-2zm-2 7a1 1 0 1 0 1 1 1 1 0 0 0 -1-1zm4 0a1 1 0 1 0 1 1 1 1 0 0 0 -1-1zm4 0a1 1 0 1 0 1 1 1 1 0 0 0 -1-1zm-8 4a1 1 0 1 0 1 1 1 1 0 0 0 -1-1zm4 0a1 1 0 1 0 1 1 1 1 0 0 0 -1-1zm8-4a1 1 0 1 0 1 1 1 1 0 0 0 -1-1zm1 5a1 1 0 0 0 -1-1h-4a1 1 0 0 0 0 2h4a1 1 0 0 0 1-1z" /></svg>
                                <h3 style={{ color: 'white', margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Calculadora de IMC</h3>
                            </div>
                            <button
                                onClick={() => { setShowIMC(false); resetIMC(); }}
                                style={{
                                    background: 'rgba(255,255,255,0.2)',
                                    border: 'none',
                                    color: 'white',
                                    fontSize: '1.1rem',
                                    cursor: 'pointer',
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Corpo do Modal */}
                        <div style={{ padding: '24px' }}>
                            <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '20px', lineHeight: 1.5 }}>
                                O IMC (Índice de Massa Corporal) é uma medida usada para avaliar se o peso está adequado para a altura.
                            </p>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                                        Altura (m)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ex: 1,75"
                                        value={imcAltura}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/[^0-9,\.]/g, '');
                                            setImcAltura(val);
                                            setImcResult(null);
                                        }}
                                        style={{
                                            width: '100%',
                                            padding: '12px 14px',
                                            borderRadius: '10px',
                                            border: '2px solid #e2e8f0',
                                            fontSize: '1rem',
                                            outline: 'none',
                                            transition: 'border-color 0.2s',
                                            boxSizing: 'border-box'
                                        }}
                                        onFocus={(e) => e.currentTarget.style.borderColor = '#cb1e28'}
                                        onBlur={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                                        Peso (kg)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ex: 70"
                                        value={imcPeso}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/[^0-9,\.]/g, '');
                                            setImcPeso(val);
                                            setImcResult(null);
                                        }}
                                        style={{
                                            width: '100%',
                                            padding: '12px 14px',
                                            borderRadius: '10px',
                                            border: '2px solid #e2e8f0',
                                            fontSize: '1rem',
                                            outline: 'none',
                                            transition: 'border-color 0.2s',
                                            boxSizing: 'border-box'
                                        }}
                                        onFocus={(e) => e.currentTarget.style.borderColor = '#cb1e28'}
                                        onBlur={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
                                    />
                                </div>
                            </div>

                            <button
                                onClick={calcularIMC}
                                disabled={!imcAltura || !imcPeso}
                                style={{
                                    width: '100%',
                                    padding: '14px',
                                    background: !imcAltura || !imcPeso ? '#e2e8f0' : '#cb1e28',
                                    color: !imcAltura || !imcPeso ? '#94a3b8' : 'white',
                                    border: 'none',
                                    borderRadius: '12px',
                                    fontSize: '1rem',
                                    fontWeight: 700,
                                    cursor: !imcAltura || !imcPeso ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                Calcular IMC
                            </button>

                            {/* Resultado do IMC */}
                            {imcResult && (
                                <div style={{
                                    marginTop: '20px',
                                    padding: '20px',
                                    background: `${imcResult.color}10`,
                                    border: `2px solid ${imcResult.color}`,
                                    borderRadius: '16px',
                                    textAlign: 'center'
                                }}>
                                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '4px', fontWeight: 500 }}>Seu IMC é</div>
                                    <div style={{ fontSize: '2.5rem', fontWeight: 800, color: imcResult.color, lineHeight: 1.2 }}>
                                        {imcResult.value}
                                    </div>
                                    <div style={{
                                        display: 'inline-block',
                                        marginTop: '8px',
                                        padding: '6px 16px',
                                        background: imcResult.color,
                                        color: 'white',
                                        borderRadius: '999px',
                                        fontSize: '0.85rem',
                                        fontWeight: 700
                                    }}>
                                        {imcResult.classification}
                                    </div>
                                </div>
                            )}

                            {/* Tabela de referência */}
                            <div style={{ marginTop: '20px' }}>
                                <h4 style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tabela de Referência</h4>
                                <div style={{ display: 'grid', gap: '4px' }}>
                                    {[
                                        { range: 'Abaixo de 18,5', label: 'Abaixo do peso', color: '#3b82f6' },
                                        { range: '18,5 - 24,9', label: 'Peso normal', color: '#16a34a' },
                                        { range: '25,0 - 29,9', label: 'Sobrepeso', color: '#f59e0b' },
                                        { range: '30,0 - 34,9', label: 'Obesidade I', color: '#f97316' },
                                        { range: '35,0 - 39,9', label: 'Obesidade II', color: '#ef4444' },
                                        { range: 'Acima de 40', label: 'Obesidade III', color: '#dc2626' },
                                    ].map((row) => (
                                        <div key={row.label} style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '6px 10px',
                                            borderRadius: '6px',
                                            background: imcResult?.classification.includes(row.label.split(' ').slice(0, 2).join(' ')) ? `${row.color}15` : 'transparent',
                                            border: imcResult?.classification.includes(row.label.split(' ').slice(0, 2).join(' ')) ? `1px solid ${row.color}40` : '1px solid transparent'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: row.color }}></div>
                                                <span style={{ fontSize: '0.8rem', color: '#334155', fontWeight: 500 }}>{row.label}</span>
                                            </div>
                                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{row.range}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Hero Section */}
            <div style={{
                background: '#cb1e28',
                borderRadius: '0 0 24px 24px',
                padding: '16px var(--spacing-xl) 16px',
                marginBottom: 'var(--spacing-xl)',
                marginLeft: 'calc(-1 * var(--spacing-lg))',
                marginRight: 'calc(-1 * var(--spacing-lg))',
                marginTop: 'calc(-1 * var(--spacing-lg))',
                color: 'white',
                boxShadow: '0 20px 25px -5px rgba(239, 68, 68, 0.15), 0 8px 10px -6px rgba(239, 68, 68, 0.1)',
                position: 'relative',
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
                    borderRadius: '0 0 24px 24px', // Adicionado aqui para manter o arredondamento visual
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3C!-- Medical Cross --%3E%3Crect x='22' y='15' width='6' height='20' rx='2' fill='white'/%3E%3Crect x='15' y='22' width='20' height='6' rx='2' fill='white'/%3E%3C!-- Heart --%3E%3Cpath d='M95 25c-2-4-7-5-10-3s-4 7-2 10l12 14 12-14c2-3 1-8-2-10s-8-1-10 3z' fill='white'/%3E%3C!-- Pill --%3E%3Crect x='160' y='12' width='10' height='26' rx='5' fill='white' transform='rotate(30 165 25)'/%3E%3Cline x1='160' y1='25' x2='170' y2='25' stroke='%23cb1e28' stroke-width='1' transform='rotate(30 165 25)'/%3E%3C!-- Stethoscope circle --%3E%3Ccircle cx='30' cy='90' r='8' fill='none' stroke='white' stroke-width='2'/%3E%3Cpath d='M30 82 C30 70 45 70 45 78' fill='none' stroke='white' stroke-width='2'/%3E%3Ccircle cx='45' cy='80' r='2' fill='white'/%3E%3C!-- Heartbeat --%3E%3Cpolyline points='90,90 100,90 105,75 110,105 115,85 120,90 130,90' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C!-- Syringe --%3E%3Crect x='165' y='80' width='6' height='22' rx='1' fill='white'/%3E%3Crect x='163' y='78' width='10' height='4' rx='1' fill='white'/%3E%3Cline x1='168' y1='102' x2='168' y2='108' stroke='white' stroke-width='2'/%3E%3C!-- DNA --%3E%3Cpath d='M20 155 Q30 145 20 135' fill='none' stroke='white' stroke-width='2'/%3E%3Cpath d='M30 155 Q20 145 30 135' fill='none' stroke='white' stroke-width='2'/%3E%3Cline x1='22' y1='140' x2='28' y2='140' stroke='white' stroke-width='1.5'/%3E%3Cline x1='21' y1='145' x2='29' y2='145' stroke='white' stroke-width='1.5'/%3E%3Cline x1='22' y1='150' x2='28' y2='150' stroke='white' stroke-width='1.5'/%3E%3C!-- Thermometer --%3E%3Crect x='100' y='140' width='6' height='20' rx='3' fill='white'/%3E%3Ccircle cx='103' cy='165' r='5' fill='white'/%3E%3C!-- Bandaid --%3E%3Crect x='155' y='140' width='28' height='12' rx='6' fill='white' transform='rotate(-30 169 146)'/%3E%3Ccircle cx='169' cy='146' r='2' fill='%23cb1e28'/%3E%3C/svg%3E")`,
                    backgroundSize: '120px 120px',
                    backgroundRepeat: 'repeat'
                }} />

                <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
                    {/* Botão Hambúrguer */}
                    <button
                        onClick={() => setMenuOpen(true)}
                        style={{
                            position: 'absolute',
                            top: '0px',
                            right: '0px',
                            background: 'rgba(255,255,255,0.2)',
                            border: 'none',
                            color: 'white',
                            cursor: 'pointer',
                            width: '40px',
                            height: '40px',
                            borderRadius: '12px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '5px',
                            transition: 'background 0.2s',
                            zIndex: 10
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.35)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                        aria-label="Abrir menu"
                    >
                        <span style={{ display: 'block', width: '20px', height: '2px', background: 'white', borderRadius: '2px' }}></span>
                        <span style={{ display: 'block', width: '20px', height: '2px', background: 'white', borderRadius: '2px' }}></span>
                        <span style={{ display: 'block', width: '20px', height: '2px', background: 'white', borderRadius: '2px' }}></span>
                    </button>

                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                        <img
                            src="/logo-cendap.png"
                            alt="Logo Cendap"
                            style={{
                                height: '70px',
                                width: '70px',
                                objectFit: 'contain',
                                borderRadius: '50%',
                            }}
                        />
                    </div>
                    <h1 style={{
                        color: 'white',
                        fontSize: '1.1rem',
                        fontWeight: 600,
                        margin: '12px 0 20px',
                        lineHeight: '1.4',
                        letterSpacing: '0.01em',
                        opacity: 0.95
                    }}>
                        CENDAP Clínica Particular em<br />Capitão-Poço | Agendamento Online
                    </h1>


                    {/* Barra de Busca Integrada no Header */}
                    {viewMode !== 'search' && (
                        <div style={{
                            marginTop: '16px', // Reduzido de 24px
                            maxWidth: '330px',
                            width: '90%',
                            marginLeft: 'auto',
                            marginRight: 'auto',
                            position: 'relative', // Para o dropdown absoluto
                            zIndex: 50 // Garantir que fique sobre os outros elementos
                        }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                background: 'white',
                                borderRadius: '9999px',
                                padding: '12px 20px',
                                gap: '12px',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                            }}>
                                <div style={{ color: '#cb1e28' }}>
                                    <SearchIcon />
                                </div>
                                <input
                                    type="text"
                                    placeholder={viewMode === 'doctors' ? "Buscar médico ou especialidade..." : "Buscar exame ou procedimento..."}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    // Manter foco
                                    style={{
                                        flex: 1,
                                        border: 'none',
                                        outline: 'none',
                                        fontSize: '0.9rem',
                                        color: '#334155',
                                        background: 'transparent',
                                    }}
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            color: '#94a3b8',
                                            cursor: 'pointer',
                                            padding: '4px'
                                        }}
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>

                            {/* Dropdown de Resultados (Overlay) */}
                            {searchQuery && (
                                <div style={{
                                    position: 'absolute',
                                    top: 'calc(100% + 8px)',
                                    left: 0,
                                    right: 0,
                                    background: 'white',
                                    borderRadius: '16px',
                                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                                    overflow: 'hidden',
                                    zIndex: 100,
                                    border: '1px solid #f1f5f9'
                                }}>
                                    {/* Cabeçalho do Dropdown */}
                                    <div style={{
                                        padding: '12px 16px',
                                        background: '#f8fafc',
                                        borderBottom: '1px solid #e2e8f0',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        color: '#64748b',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em'
                                    }}>
                                        Resultados para "{searchQuery}"
                                    </div>

                                    {/* Lista de Resultados */}
                                    <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                        {viewMode === 'doctors' ? (
                                            filteredDoctors.length > 0 ? (
                                                filteredDoctors.slice(0, 5).map((doctor) => (
                                                    <div
                                                        key={doctor.id}
                                                        onClick={() => {
                                                            handleSchedule(doctor);
                                                            setSearchQuery(''); // Limpar busca após selecionar
                                                        }}
                                                        style={{
                                                            padding: '12px 16px',
                                                            borderBottom: '1px solid #f1f5f9',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '12px',
                                                            cursor: 'pointer',
                                                            transition: 'background 0.2s',
                                                        }}
                                                        onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                                                        onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                                                    >
                                                        <div style={{
                                                            width: '32px',
                                                            height: '32px',
                                                            borderRadius: '50%',
                                                            overflow: 'hidden',
                                                            background: '#f1f5f9',
                                                            flexShrink: 0
                                                        }}>
                                                            <Image
                                                                src={doctor.image}
                                                                alt={doctor.name}
                                                                width={32}
                                                                height={32}
                                                                style={{ objectFit: 'cover' }}
                                                            />
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: 600, color: '#334155', fontSize: '0.9rem' }}>{doctor.name}</div>
                                                            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{doctor.specialty}</div>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>
                                                    Nenhum médico encontrado.
                                                </div>
                                            )
                                        ) : (
                                            filteredServices.length > 0 ? (
                                                filteredServices.slice(0, 5).map((service) => (
                                                    <div
                                                        key={service.id}
                                                        onClick={() => {
                                                            handleSchedule(service);
                                                            setSearchQuery(''); // Limpar busca após selecionar
                                                        }}
                                                        style={{
                                                            padding: '12px 16px',
                                                            borderBottom: '1px solid #f1f5f9',
                                                            cursor: 'pointer',
                                                            transition: 'background 0.2s',
                                                        }}
                                                        onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                                                        onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                                                    >
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                            <div style={{ fontWeight: 600, color: '#334155', fontSize: '0.9rem' }}>{service.description}</div>
                                                            <div style={{ fontWeight: 700, color: '#cb1e28', fontSize: '0.85rem' }}>{service.price}</div>
                                                        </div>
                                                        {service.doctorResponsible && (
                                                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                                                Dr. {service.doctorResponsible}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))
                                            ) : (
                                                <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>
                                                    Nenhum exame encontrado.
                                                </div>
                                            )
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Banner Carousel */}
            <BannerCarousel />

            {/* Toggle View Mode */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--spacing-lg)' }}>
                <div style={{
                    background: '#e8ecf1',
                    padding: '3px',
                    borderRadius: 'var(--radius-full)',
                    display: 'flex',
                    gap: '3px'
                }}>
                    <button
                        onClick={() => setViewMode('doctors')}
                        style={{
                            padding: '7px 14px',
                            fontSize: '0.85rem',
                            borderRadius: 'var(--radius-full)',
                            border: viewMode === 'doctors' ? 'none' : '1px solid #cbd5e1',
                            background: viewMode === 'doctors' ? '#cb1e28' : 'white',
                            color: viewMode === 'doctors' ? 'white' : '#334155',
                            fontWeight: 700,
                            boxShadow: viewMode === 'doctors' ? '0 2px 8px rgba(203, 30, 40, 0.3)' : 'var(--shadow-sm)',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        Médicos
                    </button>
                    <button
                        onClick={() => setViewMode('services')}
                        style={{
                            padding: '7px 14px',
                            fontSize: '0.85rem',
                            borderRadius: 'var(--radius-full)',
                            border: viewMode === 'services' ? 'none' : '1px solid #cbd5e1',
                            background: viewMode === 'services' ? '#cb1e28' : 'white',
                            color: viewMode === 'services' ? 'white' : '#334155',
                            fontWeight: 700,
                            boxShadow: viewMode === 'services' ? '0 2px 8px rgba(203, 30, 40, 0.3)' : 'var(--shadow-sm)',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        Exames e Preços
                    </button>
                    <button
                        onClick={() => setViewMode('search')}
                        style={{
                            padding: '7px 14px',
                            fontSize: '0.85rem',
                            borderRadius: 'var(--radius-full)',
                            border: viewMode === 'search' ? 'none' : '1px solid #cbd5e1',
                            background: viewMode === 'search' ? '#cb1e28' : 'white',
                            color: viewMode === 'search' ? 'white' : '#334155',
                            fontWeight: 700,
                            boxShadow: viewMode === 'search' ? '0 2px 8px rgba(203, 30, 40, 0.3)' : 'var(--shadow-sm)',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}
                    >
                        <span style={{ fontSize: '0.75rem' }}>🔍</span>
                        Minhas Agendas
                    </button>
                </div>
            </div>



            {/* Filtros de Especialidade (apenas para médicos por enquanto) */}
            {viewMode === 'doctors' && (
                <div style={{
                    display: 'flex',
                    gap: '6px',
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
                                padding: '7px 14px',
                                borderRadius: 'var(--radius-full)',
                                border: activeFilter === specialty ? 'none' : '1px solid #e2e8f0',
                                background: activeFilter === specialty ? 'var(--primary)' : 'white',
                                color: activeFilter === specialty ? 'white' : 'var(--text-secondary)',
                                fontSize: '0.82rem',
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
                                padding: '14px 32px',
                                fontWeight: 600,
                                fontSize: '1rem',
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
                        <>
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

                                {/* Botão Cancelar - só aparece se NÃO estiver cancelado */}
                                {!searchResult.status?.toLowerCase().includes('cancelado') && !cancelSuccess ? (
                                    <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
                                        <button
                                            onClick={() => setShowCancelConfirm(true)}
                                            style={{
                                                width: '100%',
                                                padding: '12px 20px',
                                                background: 'transparent',
                                                color: '#dc2626',
                                                border: '2px solid #dc2626',
                                                borderRadius: '10px',
                                                fontSize: '0.9rem',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '8px'
                                            }}
                                            onMouseEnter={(e) => { e.currentTarget.style.background = '#dc2626'; e.currentTarget.style.color = 'white'; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#dc2626'; }}
                                        >
                                            ✕ Cancelar Agendamento
                                        </button>
                                    </div>
                                ) : cancelSuccess ? (
                                    <div style={{
                                        marginTop: '20px',
                                        padding: '14px',
                                        background: '#fef2f2',
                                        border: '1px solid #fca5a5',
                                        borderRadius: '10px',
                                        textAlign: 'center',
                                        color: '#dc2626',
                                        fontWeight: 600,
                                        fontSize: '0.9rem'
                                    }}>
                                        ✓ Agendamento cancelado com sucesso.
                                    </div>
                                ) : null}
                            </div>

                            {/* Modal de Confirmação de Cancelamento */}
                            {showCancelConfirm && (
                                <div
                                    onClick={(e) => { if (e.target === e.currentTarget) setShowCancelConfirm(false); }}
                                    style={{
                                        position: 'fixed',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        background: 'rgba(0,0,0,0.5)',
                                        zIndex: 1000,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: '20px'
                                    }}
                                >
                                    <div style={{
                                        background: 'white',
                                        borderRadius: '20px',
                                        width: '100%',
                                        maxWidth: '380px',
                                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                                        overflow: 'hidden'
                                    }}>
                                        {/* Header */}
                                        <div style={{
                                            background: '#dc2626',
                                            padding: '20px 24px',
                                            textAlign: 'center'
                                        }}>
                                            <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>⚠️</div>
                                            <h3 style={{ color: 'white', margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                                                Cancelar Agendamento?
                                            </h3>
                                        </div>

                                        {/* Body */}
                                        <div style={{ padding: '24px' }}>
                                            <p style={{
                                                color: '#475569',
                                                fontSize: '0.9rem',
                                                lineHeight: 1.6,
                                                textAlign: 'center',
                                                marginBottom: '24px'
                                            }}>
                                                Tem certeza que deseja cancelar este agendamento?
                                                <br />
                                                <strong style={{ color: '#dc2626' }}>Esta ação não pode ser desfeita.</strong>
                                            </p>

                                            <div style={{ display: 'flex', gap: '12px' }}>
                                                <button
                                                    onClick={() => setShowCancelConfirm(false)}
                                                    disabled={isCancelling}
                                                    style={{
                                                        flex: 1,
                                                        padding: '12px',
                                                        background: '#f1f5f9',
                                                        color: '#475569',
                                                        border: 'none',
                                                        borderRadius: '10px',
                                                        fontSize: '0.9rem',
                                                        fontWeight: 600,
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    Não, manter
                                                </button>
                                                <button
                                                    onClick={handleCancelAppointment}
                                                    disabled={isCancelling}
                                                    style={{
                                                        flex: 1,
                                                        padding: '12px',
                                                        background: '#dc2626',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '10px',
                                                        fontSize: '0.9rem',
                                                        fontWeight: 600,
                                                        cursor: isCancelling ? 'not-allowed' : 'pointer',
                                                        opacity: isCancelling ? 0.7 : 1
                                                    }}
                                                >
                                                    {isCancelling ? 'Cancelando...' : 'Sim, cancelar'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div >
            )
            }
            {/* Lista: Médicos ou Serviços */}
            {
                viewMode !== 'search' && (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                        gap: '16px',
                        paddingBottom: 'var(--spacing-xl)'
                    }}>
                        {viewMode === 'doctors' ? (
                            filteredDoctors.length > 0 ? (
                                filteredDoctors.map((doctor) => (
                                    <DoctorCard
                                        key={doctor.id}
                                        doctor={doctor}
                                        onSchedule={handleSchedule}
                                        onWaitlist={handleWaitlist}
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
                        services={services}
                        onClose={handleCloseModal}
                        onConfirm={handleConfirmSchedule}
                    />
                )
            }

            {
                isWaitlistModalOpen && (
                    <WaitlistModal
                        doctor={selectedWaitlistDoctor}
                        onClose={handleCloseWaitlistModal}
                    />
                )
            }
        </>
    );
}

