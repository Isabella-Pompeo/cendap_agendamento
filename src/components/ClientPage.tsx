
'use client';

import Image from 'next/image';

import React, { useState, useMemo, useEffect } from 'react';
import DoctorCard from './DoctorCard';
import ServiceCard from './ServiceCard';
import SchedulingModal from './SchedulingModal';
import WaitlistModal from './WaitlistModal';
import FloatingNavbar from './FloatingNavbar';
import ProfileModal from './ProfileModal';
import { useAuth } from '../contexts/AuthContext';
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
        title: "Exames Online",
        subtitle: "Veja seus resultados de exames de forma rápida e segura.",
        buttonText: "", // Não exibido quando tem imagem
        color: "#cb1e28",
        textColor: "white",
        image: "/banner-novo.jpg",
        desktopImage: "/bannernovo-desktop.jpeg"
    },
    {
        id: 2,
        title: "Dicas Médicas",
        subtitle: "Consulte seu médico regularmente para minimizar a incidência de doenças no futuro.",
        buttonText: "Saiba Mais",
        color: "#cb1e28", // Fallback color
        textColor: "white",
        image: "/doutor-protocolo.jpeg",
        desktopImage: "/doutorprotocolo-desktop.jpeg"
    },
    {
        id: 3,
        title: "Especialistas",
        subtitle: "Os melhores médicos à sua disposição para um atendimento de excelência.",
        buttonText: "Ver Médicos",
        color: "#cb1e28",
        textColor: "white",
        image: "/banner-exames.png",
        desktopImage: "/banner-exames.png"
    },
    {
        id: 4,
        title: "Meu Site Cendap",
        subtitle: "Chegou o novo sistema de agendamento da clínica Cendap!",
        buttonText: "Acessar",
        color: "#1e293b",
        textColor: "white",
        image: "/banner-site.png",
        desktopImage: "/banner-site.png"
    }
];

function BannerCarousel({ onBannerClick }: { onBannerClick?: (id: number) => void }) {
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
        <div className="carousel-container" style={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: '24px',
            marginBottom: 'var(--spacing-lg)',
            boxShadow: 'var(--shadow-md)',
            background: 'white',
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
                height: '100%',
                transition: 'transform 0.5s ease-in-out',
                transform: `translateX(-${currentSlide * 100}%)`,
            }}>
                {banners.map((banner, index) => (
                    <div key={banner.id} onClick={() => onBannerClick?.(banner.id)} style={{
                        minWidth: '100%',
                        position: 'relative',
                        background: banner.color,
                        padding: '16px 20px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        color: banner.textColor,
                        height: '100%',
                        cursor: onBannerClick ? 'pointer' : 'inherit',
                        overflow: 'hidden' // Ensure image stays within bounds
                    }}>
                        {/* Render image if present, otherwise render text content */}
                        {banner.image ? (
                            <picture>
                                {banner.desktopImage && (
                                    <source
                                        media="(min-width: 768px)"
                                        srcSet={banner.desktopImage}
                                    />
                                )}
                                <img
                                    src={banner.image}
                                    alt={banner.title}
                                    loading={index === 0 ? 'eager' : 'lazy'}
                                    decoding={index === 0 ? 'sync' : 'async'}
                                    fetchPriority={index === 0 ? 'high' : 'low'}
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover',
                                    }}
                                />
                            </picture>
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
    const { user } = useAuth();
    const [viewMode, setViewMode] = useState<'doctors' | 'services'>('doctors');
    const [selectedItem, setSelectedItem] = useState<Doctor | Service | null>(null);
    const [pendingItem, setPendingItem] = useState<Doctor | Service | null>(null);
    const [isWaitlistModalOpen, setIsWaitlistModalOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [selectedWaitlistDoctor, setSelectedWaitlistDoctor] = useState<Doctor | null>(null);
    const [pendingWaitlistDoctor, setPendingWaitlistDoctor] = useState<Doctor | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState('Todos');
    const [isExternalModalOpen, setIsExternalModalOpen] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const params = new URLSearchParams(window.location.search);
        const paymentId = params.get('telemedicinePaymentReturn');
        if (!paymentId) return;

        window.localStorage.removeItem('cendapTelemedicinePaymentReturn');
        params.delete('telemedicinePaymentReturn');
        const nextQuery = params.toString();
        window.history.replaceState({}, '', `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`);
    }, []);

    // Ouvir eventos globais de modais externos (como os Protocolos da Home)
    useEffect(() => {
        const handleModalChange = (e: any) => {
            const detail = e.detail;
            if (detail && typeof detail.open === 'boolean') {
                setIsExternalModalOpen(detail.open);
            }
        };
        window.addEventListener('modal-state-change', handleModalChange);
        return () => window.removeEventListener('modal-state-change', handleModalChange);
    }, []);

    // Menu hambúrguer + Calculadora IMC
    const [menuOpen, setMenuOpen] = useState(false);
    const [showIMC, setShowIMC] = useState(false);
    const [showResultados, setShowResultados] = useState(false);
    const [imcAltura, setImcAltura] = useState('');
    const [imcPeso, setImcPeso] = useState('');
    const [imcResult, setImcResult] = useState<{ value: number; classification: string; color: string } | null>(null);

    // Estado da Faça o Seu Orçamento (Budget)
    const [showBudget, setShowBudget] = useState(false);
    const [budgetSearchQuery, setBudgetSearchQuery] = useState('');
    const [budgetItems, setBudgetItems] = useState<{ id: string, name: string, type: 'Consulta' | 'Exame', price: number, originalStr: string }[]>([]);

    const totalBudget = useMemo(() => {
        return budgetItems.reduce((acc, curr) => acc + curr.price, 0);
    }, [budgetItems]);

    const handleAddBudgetItem = (item: any, type: 'Consulta' | 'Exame') => {
        let priceNum = 0;
        let originalStr = 'A consultar';
        
        if (type === 'Consulta') {
            const doc = item as Doctor;
            originalStr = typeof doc.price === 'string' ? doc.price : `R$ ${doc.price},00`;
            if (typeof doc.price === 'number') {
                priceNum = doc.price;
            } else {
                const numericMatch = String(doc.price).match(/[\d.,]+/);
                if (numericMatch) {
                    const cleanNum = numericMatch[0].replace(/\./g, '').replace(',', '.');
                    priceNum = parseFloat(cleanNum);
                }
            }
        } else {
            const svc = item as Service;
            originalStr = svc.price;
            const numericMatch = String(svc.price).match(/[\d.,]+/);
            if (numericMatch) {
                const cleanNum = numericMatch[0].replace(/\./g, '').replace(',', '.');
                priceNum = parseFloat(cleanNum);
            }
        }

        const name = type === 'Consulta' ? (item as Doctor).name : (item as Service).description;
        const finalType = name.toLowerCase().includes('consulta') ? 'Consulta' : type;

        setBudgetItems(prev => [...prev, { id: Math.random().toString(), name, type: finalType as 'Consulta'|'Exame', price: priceNum, originalStr }]);
    };

    const handleRemoveBudgetItem = (idToRemove: string) => {
        setBudgetItems(prev => prev.filter(item => item.id !== idToRemove));
    };

    const filteredBudgetOptions = useMemo(() => {
        if (!budgetSearchQuery.trim()) return [];
        const q = budgetSearchQuery.toLowerCase();
        const docs = doctors.filter(d => d.name.toLowerCase().includes(q) || d.specialty.toLowerCase().includes(q)).slice(0, 5).map(d => ({ ...d, isDoc: true }));
        const svcs = services.filter(s => s.description.toLowerCase().includes(q)).slice(0, 5).map(s => ({ ...s, isDoc: false }));
        return [...docs, ...svcs];
    }, [budgetSearchQuery, doctors, services]);

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




    const GOOGLE_SHEETS_API = 'https://script.google.com/macros/s/AKfycbxXLDeq4DoUOWUlmAM4yWdnPDxyWPBbzFbOSoMRNlsavPJNvtiKWUzok8ed2RkzvcSY/exec';



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
        const uniqueSpecialties = [...new Set(doctors.map(d => {
            if (d.specialty.includes('Clinico Geral') || d.specialty.includes('Clínico Geral')) {
                return 'Clínico Geral';
            }
            if (d.specialty.includes('Neurologia')) {
                return 'Neurologia';
            }
            if (d.specialty.includes('Nefrologia')) {
                return 'Nefrologia';
            }
            return d.specialty;
        }))];
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
            results = results.filter(doctor => {
                if (activeFilter === 'Clínico Geral') {
                    return doctor.specialty.includes('Clinico Geral') || doctor.specialty.includes('Clínico Geral');
                }
                if (activeFilter === 'Neurologia') {
                    return doctor.specialty.includes('Neurologia');
                }
                if (activeFilter === 'Nefrologia') {
                    return doctor.specialty.includes('Nefrologia');
                }
                return doctor.specialty === activeFilter;
            });
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

    useEffect(() => {
        if (user) {
            if (pendingItem) {
                // Wrap in setTimeout to avoid synchronous state update in effect error
                setTimeout(() => {
                    setSelectedItem(pendingItem);
                    setPendingItem(null);
                }, 0);
            }
            if (pendingWaitlistDoctor) {
                setTimeout(() => {
                    setSelectedWaitlistDoctor(pendingWaitlistDoctor);
                    setIsWaitlistModalOpen(true);
                    setPendingWaitlistDoctor(null);
                }, 0);
            }
        }
    }, [user, pendingItem, pendingWaitlistDoctor]);

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
                        onClick={() => { 
                            if (user) {
                                setIsProfileModalOpen(true);
                            } else {
                                window.location.assign('/login'); 
                            }
                            setMenuOpen(false); 
                        }}
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
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                        <div>
                            <div>Meu Perfil</div>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 400, marginTop: '2px' }}>Acesse sua conta e histórico</div>
                        </div>
                    </button>
                    <button
                        onClick={() => { setShowResultados(true); setMenuOpen(false); }}
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
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="#334155" xmlns="http://www.w3.org/2000/svg" id="Layer_1" data-name="Layer 1"><path d="m10,23c0,.553-.447,1-1,1h-4c-2.757,0-5-2.243-5-5V5C0,2.243,2.243,0,5,0h8c2.757,0,5,2.243,5,5v2c0,.553-.447,1-1,1s-1-.447-1-1v-2c0-1.654-1.346-3-3-3H5c-1.654,0-3,1.346-3,3v14c0,1.654,1.346,3,3,3h4c.553,0,1,.447,1,1ZM14,6c0-.553-.447-1-1-1H5c-.553,0-1,.447-1,1s.447,1,1,1h8c.553,0,1-.447,1-1Zm-4,5c0-.553-.447-1-1-1h-4c-.553,0-1,.447-1,1s.447,1,1,1h4c.553,0,1-.447,1-1Zm-5,4c-.553,0-1,.447-1,1s.447,1,1,1h2c.553,0,1-.447,1-1s-.447-1-1-1h-2Zm19,2c0,3.859-3.141,7-7,7s-7-3.141-7-7,3.141-7,7-7,7,3.141,7,7Zm-2,0c0-2.757-2.243-5-5-5s-5,2.243-5,5,2.243,5,5,5,5-2.243,5-5Zm-3.192-1.241l-2.223,2.134c-.144.141-.379.144-.522.002l-1.131-1.108c-.396-.388-1.028-.382-1.414.014-.387.395-.381,1.027.014,1.414l1.132,1.109c.46.449,1.062.674,1.663.674s1.201-.225,1.653-.671l2.213-2.124c.398-.383.411-1.016.029-1.414-.383-.4-1.017-.411-1.414-.029Z" /></svg>
                        <div>
                            <div>Resultado de Exames Laboratoriais</div>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 400, marginTop: '2px' }}>Acesse seus resultados online</div>
                        </div>
                    </button>
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
                        onClick={() => { setShowBudget(true); setMenuOpen(false); }}
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
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="18" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/><line x1="7" y1="8" x2="17" y2="8"/><line x1="7" y1="13" x2="9" y2="13"/><line x1="11" y1="13" x2="13" y2="13"/><line x1="15" y1="13" x2="17" y2="13"/><line x1="7" y1="17" x2="9" y2="17"/></svg>
                        <div>
                            <div>Faça o Seu Orçamento</div>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 400, marginTop: '2px' }}>Simule o valor de exames e consultas</div>
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
                    <button
                        onClick={() => { window.open('https://maps.app.goo.gl/A1fzPrah9ooCZMLj7', '_blank'); setMenuOpen(false); }}
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
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="#334155" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C7.802 0 4 3.403 4 7.602 4 11.8 7.469 16.812 12 24c4.531-7.188 8-12.2 8-16.398C20 3.403 16.199 0 12 0zm0 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6z" /></svg>
                        <div>
                            <div>Nossa Localização</div>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 400, marginTop: '2px' }}>Veja como chegar à clínica</div>
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
                                        padding: '4px 12px',
                                        background: 'white',
                                        color: imcResult.color,
                                        borderRadius: '99px',
                                        fontSize: '0.85rem',
                                        fontWeight: 700,
                                        marginTop: '8px'
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

            {/* Modal de Resultados de Exames */}
            {showResultados && (
                <div
                    onClick={(e) => { if (e.target === e.currentTarget) { setShowResultados(false); } }}
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
                        maxWidth: '500px',
                        maxHeight: '90vh',
                        overflow: 'hidden',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        {/* Header do Modal Resultados */}
                        <div style={{
                            background: '#cb1e28',
                            padding: '20px 24px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg" id="Layer_1" data-name="Layer 1"><path d="m10,23c0,.553-.447,1-1,1h-4c-2.757,0-5-2.243-5-5V5C0,2.243,2.243,0,5,0h8c2.757,0,5,2.243,5,5v2c0,.553-.447,1-1,1s-1-.447-1-1v-2c0-1.654-1.346-3-3-3H5c-1.654,0-3,1.346-3,3v14c0,1.654,1.346,3,3,3h4c.553,0,1,.447,1,1ZM14,6c0-.553-.447-1-1-1H5c-.553,0-1,.447-1,1s.447,1,1,1h8c.553,0,1-.447,1-1Zm-4,5c0-.553-.447-1-1-1h-4c-.553,0-1,.447-1,1s.447,1,1,1h4c.553,0,1-.447,1-1Zm-5,4c-.553,0-1,.447-1,1s.447,1,1,1h2c.553,0,1-.447,1-1s-.447-1-1-1h-2Zm19,2c0,3.859-3.141,7-7,7s-7-3.141-7-7,3.141-7,7-7,7,3.141,7,7Zm-2,0c0-2.757-2.243-5-5-5s-5,2.243-5,5,2.243,5,5,5,5-2.243,5-5Zm-3.192-1.241l-2.223,2.134c-.144.141-.379.144-.522.002l-1.131-1.108c-.396-.388-1.028-.382-1.414.014-.387.395-.381,1.027.014,1.414l1.132,1.109c.46.449,1.062.674,1.663.674s1.201-.225,1.653-.671l2.213-2.124c.398-.383.411-1.016.029-1.414-.383-.4-1.017-.411-1.414-.029Z" /></svg>
                                <h3 style={{ color: 'white', margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Resultado de Exames</h3>
                            </div>
                            <button
                                onClick={() => setShowResultados(false)}
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

                        {/* Corpo do Modal - Iframe Wrapper */}
                        <div style={{
                            padding: '24px',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            background: '#f8fafc',
                            overflowX: 'auto'
                        }}>
                            <iframe
                                src="https://worklabweb.com.br/frame.php?Cliente=2235&i=1"
                                name="I1"
                                width="450"
                                height="135"
                                marginWidth={0}
                                marginHeight={0}
                                frameBorder="0" // Note: React uses camelCase and string '0' instead of 'no'
                                scrolling="no"
                                style={{
                                    maxWidth: '100%',
                                    background: 'transparent',
                                    borderRadius: '8px'
                                }}
                            />
                        </div>
                    </div>
                </div>
            )
            }

            {/* Modal da Faça o Seu Orçamento */}
            {showBudget && (
                <div
                    onClick={(e) => { if (e.target === e.currentTarget) { setShowBudget(false); } }}
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
                        maxWidth: '450px',
                        maxHeight: '90vh',
                        display: 'flex',
                        flexDirection: 'column',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        overflow: 'hidden'
                    }}>
                        {/* Header do Modal Budget */}
                        <div style={{
                            background: '#cb1e28',
                            padding: '20px 24px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="18" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/><line x1="7" y1="8" x2="17" y2="8"/><line x1="7" y1="13" x2="9" y2="13"/><line x1="11" y1="13" x2="13" y2="13"/><line x1="15" y1="13" x2="17" y2="13"/><line x1="7" y1="17" x2="9" y2="17"/></svg>
                                <h3 style={{ color: 'white', margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Faça o Seu Orçamento</h3>
                            </div>
                            <button
                                onClick={() => setShowBudget(false)}
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
                            >✕</button>
                        </div>

                        {/* Corpo do Modal Budget */}
                        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
                            <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '20px', lineHeight: 1.5 }}>
                                Adicione os exames e consultas para simular o valor total. Os valores são apenas uma estimativa.
                            </p>

                            <div style={{ position: 'relative', marginBottom: '20px' }}>
                                <input
                                    type="text"
                                    placeholder="Buscar exame ou consulta..."
                                    value={budgetSearchQuery}
                                    onChange={(e) => setBudgetSearchQuery(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '12px 14px 12px 40px',
                                        borderRadius: '10px',
                                        border: '2px solid #e2e8f0',
                                        fontSize: '0.95rem',
                                        outline: 'none',
                                        boxSizing: 'border-box'
                                    }}
                                />
                                <div style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }}>
                                    <SearchIcon />
                                </div>
                                
                                {filteredBudgetOptions.length > 0 && (
                                    <div style={{
                                        position: 'absolute', top: '100%', left: 0, right: 0,
                                        background: 'white', border: '1px solid #e2e8f0',
                                        borderRadius: '8px', zIndex: 10, marginTop: '4px',
                                        maxHeight: '200px', overflowY: 'auto', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                                    }}>
                                        {filteredBudgetOptions.map((option: any) => (
                                            <div
                                                key={option.id}
                                                onClick={() => {
                                                    handleAddBudgetItem(option, option.isDoc ? 'Consulta' : 'Exame');
                                                    setBudgetSearchQuery('');
                                                }}
                                                style={{
                                                    padding: '12px 14px',
                                                    borderBottom: '1px solid #f1f5f9',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center'
                                                }}
                                            >
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#334155' }}>
                                                        {option.isDoc ? option.name : option.description}
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                                        {option.isDoc ? option.specialty : (option.description?.toLowerCase().includes('consulta') ? 'Consulta' : 'Exame')}
                                                    </div>
                                                </div>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#cb1e28' }}>
                                                    {option.isDoc ? (typeof option.price === 'number' ? `R$ ${option.price},00` : option.price) : option.price}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Lista de Selecionados */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '150px' }}>
                                {budgetItems.length === 0 ? (
                                    <div style={{ textAlign: 'center', color: '#94a3b8', padding: '20px 0', fontSize: '0.9rem' }}>
                                        Nenhum item adicionado à simulação.
                                    </div>
                                ) : (
                                    budgetItems.map(item => (
                                        <div key={item.id} style={{
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9'
                                        }}>
                                            <div style={{ flex: 1, marginRight: '12px' }}>
                                                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>{item.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{item.type}</div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>
                                                    {item.price > 0 ? `R$ ${item.price.toFixed(2).replace('.', ',')}` : item.originalStr}
                                                </div>
                                                <button
                                                    onClick={() => handleRemoveBudgetItem(item.id)}
                                                    style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '1.2rem', cursor: 'pointer', padding: '0 4px' }}
                                                >×</button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Totalizador */}
                            <div style={{
                                marginTop: '20px', paddingTop: '16px', borderTop: '2px dashed #e2e8f0',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                            }}>
                                <span style={{ fontSize: '1rem', fontWeight: 600, color: '#64748b' }}>Total Estimado:</span>
                                <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#cb1e28' }}>
                                    R$ {totalBudget.toFixed(2).replace('.', ',')}
                                </span>
                            </div>
                            {budgetItems.some(i => i.price === 0) && (
                                <p style={{ fontSize: '0.75rem', color: '#f59e0b', textAlign: 'right', marginTop: '4px' }}>
                                    *Há itens com valor &quot;a consultar&quot;.
                                </p>
                            )}
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
                                    placeholder="Buscar médico, especialidade ou exame..."
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
                                        Resultados para &quot;{searchQuery}&quot;
                                    </div>

                                    {/* Lista de Resultados */}
                                    <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                        {filteredDoctors.length === 0 && filteredServices.length === 0 ? (
                                            <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>
                                                Nenhum resultado encontrado.
                                            </div>
                                        ) : (
                                            <>
                                                {filteredDoctors.length > 0 && (
                                                    <div>
                                                        <div style={{ padding: '8px 16px', fontSize: '0.8rem', fontWeight: 'bold', color: '#94a3b8', background: '#f8fafc' }}>
                                                            Profissionais
                                                        </div>
                                                        {filteredDoctors.slice(0, 5).map((doctor) => (
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
                                                        ))}
                                                    </div>
                                                )}

                                                {filteredServices.length > 0 && (
                                                    <div>
                                                        <div style={{ padding: '8px 16px', fontSize: '0.8rem', fontWeight: 'bold', color: '#94a3b8', background: '#f8fafc' }}>
                                                            Exames e Procedimentos
                                                        </div>
                                                        {filteredServices.slice(0, 5).map((service) => (
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
                                                        ))}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                    </div>
                </div>
            </div>

            {/* Banner Carousel */}
            <BannerCarousel onBannerClick={(id) => {
                if (id === 1) {
                    setShowResultados(true);
                }
            }} />

            {/* Categorias / Médicos / Serviços */}
            <div style={{ marginTop: '24px' }}>
                {viewMode === 'doctors' ? (
                    <div className="specialty-scroll-container" style={{
                        display: 'flex',
                        gap: '14px',
                        marginBottom: 'var(--spacing-lg)',
                        overflowX: 'auto',
                        paddingTop: '8px',
                        paddingBottom: '12px',
                        paddingLeft: '4px',
                        paddingRight: '4px',
                        WebkitOverflowScrolling: 'touch',
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none'
                    }}>
                        <style dangerouslySetInnerHTML={{__html: `
                            .specialty-scroll-container::-webkit-scrollbar {
                                display: none;
                            }
                        `}} />
                        {doctorSpecialties.filter(s => s !== 'Todos').map((specialty) => (
                            <button
                                key={specialty}
                                onClick={() => setActiveFilter(activeFilter === specialty ? 'Todos' : specialty)}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '8px',
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: 0,
                                    minWidth: '72px',
                                    transition: 'transform 0.2s',
                                    transform: activeFilter === specialty ? 'scale(1.05)' : 'scale(1)',
                                    outline: 'none',
                                    WebkitTapHighlightColor: 'transparent'
                                }}
                            >
                                <div style={{
                                    width: '72px',
                                    height: '72px',
                                    borderRadius: '50%',
                                    padding: '3px',
                                    background: activeFilter === specialty ? 'linear-gradient(135deg, #cb1e28, #f43f5e)' : 'transparent',
                                    border: activeFilter === specialty ? '2px solid transparent' : '2px solid #e2e8f0',
                                    boxSizing: 'border-box'
                                }}>
                                    <div style={{
                                        width: '100%',
                                        height: '100%',
                                        borderRadius: '50%',
                                        background: '#f8fafc',
                                        overflow: 'hidden',
                                        position: 'relative',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        border: activeFilter === specialty ? '2px solid white' : 'none',
                                        boxSizing: 'border-box',
                                        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)'
                                    }}>
                                        <img
                                            src={`/icones-especialidades/${specialty.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}.png`}
                                            alt={specialty}
                                            style={{
                                                width: '100%',
                                                height: '100%',
                                                objectFit: 'contain',
                                                transform: 'scale(0.85)'
                                            }}
                                            onError={(e) => {
                                                if (e.currentTarget.style.display !== 'none') {
                                                    e.currentTarget.style.display = 'none';
                                                    e.currentTarget.insertAdjacentHTML('afterend', `<span style="font-size: 1.8rem;">${specialtyIcons[specialty] || '🩺'}</span>`);
                                                }
                                            }}
                                        />
                                    </div>
                                </div>
                                <span style={{
                                    fontSize: '0.75rem',
                                    fontWeight: activeFilter === specialty ? 700 : 500,
                                    color: activeFilter === specialty ? '#1e293b' : '#64748b',
                                    textAlign: 'center',
                                    lineHeight: '1.2',
                                    maxWidth: '120px',
                                    display: 'block',
                                    wordBreak: 'break-word'
                                }}>
                                    {specialty}
                                </span>
                            </button>
                        ))}
                    </div>
                ) : null}

                {/* Lista de Médicos / Serviços */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                    gap: '16px',
                    paddingBottom: '50px'
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
                            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Nenhum médico encontrado.</div>
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
                            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Nenhum exame encontrado.</div>
                        )
                    )}
                </div>
            </div>


            {
                selectedItem && (
                    <SchedulingModal
                        item={selectedItem}
                        type={'specialty' in selectedItem ? 'doctor' : 'exam'}
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
            {
                isProfileModalOpen && (
                    <ProfileModal onClose={() => setIsProfileModalOpen(false)} />
                )
            }
            {
                !selectedItem && !isWaitlistModalOpen && !isProfileModalOpen && !showResultados && !showBudget && !menuOpen && !showIMC && !isExternalModalOpen && (
                    <FloatingNavbar
                        activeTab={viewMode}
                        onAction={(action) => {
                            if (action === 'doctors' || action === 'services') {
                                setViewMode(action);
                            } else if (action === 'results') {
                                setShowResultados(true);
                            } else if (action === 'profile') {
                                if (user) {
                                    setIsProfileModalOpen(true);
                                } else {
                                    window.location.assign('/login');
                                }
                            }
                        }}
                    />
                )
            }
        </>
    );
}

