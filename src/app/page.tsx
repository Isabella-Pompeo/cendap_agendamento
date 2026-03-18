
import React from 'react';
import Header from '../components/Header';
import DoctorCard from '../components/DoctorCard';
import ProtocolCard from '../components/ProtocolCard';
import ClientPage from '../components/ClientPage'; // Separando Client Component
import { getDoctors, getServices, Service } from '../lib/sheets';
import { Doctor } from '../data/mocks';

export const revalidate = 60;

export interface ProtocolService extends Service {
    image: string;
    rating: number;
    substances?: string[];
}

// Placeholder data for protocols
const mockProtocols: ProtocolService[] = [
    {
        id: 'p1',
        description: 'Protocolo de Emagrecimento',
        specialtyRelated: 'Terapia Intravenosa',
        doctorResponsible: 'Técnico Paulo',
        price: '$$$',
        additionalInfo: 'Atendimento especializado',
        // Propriedades temporárias pro design do carrossel:
        image: '/cardprotocolo-emagrecimento.png', // Soro/IV
        rating: 4.9,
        substances: ['Vitamina C', 'Complexo B', 'Magnésio', 'L-Carnitina', 'Zinco'],
    },
    {
        id: 'p2',
        description: 'Protocolo Detox Hepático IM',
        specialtyRelated: 'Terapia Intravenosa',
        doctorResponsible: 'Técnico Paulo',
        price: '$$$',
        additionalInfo: 'Atendimento especializado',
        image: '/cardprotocolo-detox.png', // Clínica/Vitamina
        rating: 5.0,
        substances: ['Glutationa', 'Ácido Alfa-Lipóico', 'Vitamina C', 'Silimarina', 'Complexo B'],
    },
    {
        id: 'p3',
        description: 'Protocolo Acelerador Metabólico',
        specialtyRelated: 'Terapia Intravenosa',
        doctorResponsible: 'Técnico Paulo',
        price: '$$$',
        additionalInfo: 'Atendimento especializado',
        image: '/cardprotocolo-acelerador.png', // Estética/Spa relaxante
        rating: 4.8,
        substances: ['BCAA', 'Lisina', 'Vitamina B12', 'Coenzima Q10', 'NAD+'],
    },
    {
        id: 'p4',
        description: 'Soroterapia Queda de Cabelo',
        specialtyRelated: 'Terapia Intravenosa',
        doctorResponsible: 'Técnico Paulo',
        price: '$$$',
        additionalInfo: 'Atendimento especializado',
        image: '/cardprotocolo-cabelo.png', // Beleza/Skincare
        rating: 5.0,
        substances: ['Biotina', 'Pantenol (B5)', 'Zinco', 'Ferro', 'Aminoácidos Essenciais'],
    }
];

export default async function Home() {
    const doctors = await getDoctors();
    const services = await getServices();

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>


            <main style={{
                flex: 1,
                padding: 'var(--spacing-lg)',
                maxWidth: '1200px',
                margin: '0 auto',
                width: '100%'
            }}>


                <ClientPage doctors={doctors} services={services} />
            </main >

            {/* Banner Card acima do Footer */}
            <div style={{
                maxWidth: '1200px',
                margin: '0 auto',
                padding: '0 var(--spacing-lg) var(--spacing-lg)',
                width: '100%',
            }}>
                <div style={{
                    position: 'relative',
                    borderRadius: '24px',
                    overflow: 'hidden',

                    cursor: 'pointer',
                    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                }}>
                    {/* Desktop: imagem horizontal (768px+) */}
                    <picture>
                        <source
                            media="(min-width: 768px)"
                            srcSet="/protocolo-desktop.jpeg"
                        />
                        {/* Mobile: imagem atual */}
                        <img
                            src="/protocolo-mobile.jpeg"
                            alt="Injetáveis"
                            loading="lazy"
                            decoding="async"
                            style={{
                                width: '100%',
                                height: 'auto',
                                display: 'block',
                                minHeight: '120px',
                                objectFit: 'cover',
                            }}
                        />
                    </picture>
                </div>
            </div>

            {/* Nova Seção de Protocolos */}
            <div style={{
                maxWidth: '1200px',
                margin: '0 auto',
                padding: '0 var(--spacing-lg) 40px',
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: '24px'
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '16px' // Espaço para o carrossel
                }}>
                    <h2 style={{
                        fontSize: '1.5rem',
                        fontWeight: 700,
                        color: 'var(--text-main)',
                        margin: 0
                    }}>
                        Nossos Protocolos
                    </h2>
                    <div style={{
                        height: '2px',
                        background: 'var(--primary-light)',
                        flex: 1,
                        borderRadius: '2px'
                    }}></div>
                </div>

                {/* Container com Scroll Horizontal (Estilo Maps/Airbnb) */}
                <div style={{
                    display: 'flex',
                    gap: '16px',
                    overflowX: 'auto',
                    paddingBottom: '24px', // espaço pra sombra
                    scrollSnapType: 'x mandatory',
                    WebkitOverflowScrolling: 'touch',
                    marginRight: 'calc(-1 * var(--spacing-lg))', // Compensar padding do parent para rolar até a borda da tela no mobile
                    paddingRight: 'var(--spacing-lg)',
                    scrollbarWidth: 'none', // Ocultar scrollbar Firefox
                    msOverflowStyle: 'none', // Ocultar scrollbar IE
                }}
                    className="hide-scrollbar" // Adicionar classe global se precisar ocultar Webkit
                >
                    {mockProtocols.map(protocol => (
                        <div key={protocol.id} style={{
                            flex: '0 0 auto',
                            width: '230px', // Reduzido de 280px para ver um pedaço do próximo card mais fácil no mobile
                            scrollSnapAlign: 'start',
                        }}>
                            <ProtocolCard
                                protocol={protocol}
                                doctors={doctors}
                                services={services}
                            />
                        </div>
                    ))}
                </div>
            </div>

            <footer style={{
                background: 'linear-gradient(135deg, #99161e 0%, #cb1e28 100%)',
                padding: '32px 24px 32px',
                color: 'white',
                textAlign: 'left',
            }}>
                {/* Logo */}
                <div style={{ marginBottom: '16px' }}>
                    <img
                        src="/logo-cendap.png"
                        alt="Logo CENDAP"
                        style={{
                            height: '60px',
                            width: '60px',
                            borderRadius: '50%',
                            objectFit: 'contain',
                        }}
                    />
                </div>

                {/* Nome da Clínica */}
                <h3 style={{
                    fontSize: '1.2rem',
                    fontWeight: 700,
                    margin: '0 0 8px',
                    letterSpacing: '0.02em',
                    color: 'white'
                }}>
                    CENDAP
                </h3>

                {/* Descrição */}
                <p style={{
                    fontSize: '0.85rem',
                    color: 'rgba(255,255,255,0.85)',
                    margin: '0 0 20px',
                    lineHeight: 1.5,
                    maxWidth: '300px',
                }}>
                    Agendamento online de consultas e exames da Clínica CENDAP em Capitão Poço - PA
                </p>

                {/* Redes Sociais */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'flex-start',
                    gap: '12px',
                    marginBottom: '24px'
                }}>
                    {/* Instagram */}
                    <a href="https://www.instagram.com/cendapcap/" target="_blank" rel="noopener noreferrer" style={{
                        width: '40px', height: '40px', borderRadius: '50%',
                        background: 'rgba(255,255,255,0.1)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        transition: 'background 0.2s', cursor: 'pointer', textDecoration: 'none'
                    }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                        </svg>
                    </a>
                    {/* Facebook */}
                    <a href="https://www.facebook.com/cendapcap?locale=pt_BR" target="_blank" rel="noopener noreferrer" style={{
                        width: '40px', height: '40px', borderRadius: '50%',
                        background: 'rgba(255,255,255,0.1)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        transition: 'background 0.2s', cursor: 'pointer', textDecoration: 'none'
                    }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                            <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"></path>
                        </svg>
                    </a>
                    {/* WhatsApp */}
                    <a href="https://api.whatsapp.com/send/?phone=5591981097045&text=Ol%C3%A1%2C+gostaria+de+tirar+uma+d%C3%BAvida%21+&type=phone_number&app_absent=0" target="_blank" rel="noopener noreferrer" style={{
                        width: '40px', height: '40px', borderRadius: '50%',
                        background: 'rgba(255,255,255,0.1)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        transition: 'background 0.2s', cursor: 'pointer', textDecoration: 'none'
                    }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                    </a>
                </div>

                {/* Separador */}
                <div style={{
                    width: '60px',
                    height: '2px',
                    background: 'rgba(255,255,255,0.15)',
                    marginBottom: '16px'
                }}></div>

                {/* Endereço */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '12px'
                }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(255,255,255,0.85)' }}>
                        Travessa José Barros da Silva, 806 - Centro, Capitão Poço - PA
                    </p>
                </div>

                {/* Copyright e CNPJ */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#e8a0a5' }}>
                        © {new Date().getFullYear()} CENDAP. Todos os direitos reservados.
                    </p>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#e8a0a5' }}>
                        CNPJ: 10.695.431/0001-73
                    </p>
                </div>
            </footer>
        </div >
    );
}
