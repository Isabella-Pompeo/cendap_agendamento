
import React from 'react';
import Header from '../components/Header';
import DoctorCard from '../components/DoctorCard';
import ClientPage from '../components/ClientPage'; // Separando Client Component
import { getDoctors, getServices } from '../lib/sheets';
import { Doctor } from '../data/mocks';

// Revalidar a cada 60 segundos para garantir "tempo real" sem estourar quotas
export const revalidate = 60;

export default async function Home() {
    const doctors = await getDoctors();
    const services = await getServices();

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>


            <main style={{
                flex: 1,
                padding: 'var(--spacing-lg)',
                maxWidth: '600px',
                margin: '0 auto',
                width: '100%'
            }}>


                <ClientPage doctors={doctors} services={services} />
            </main >

            <footer style={{
                background: 'linear-gradient(135deg, #4a0a0e 0%, #7f1d1d 100%)',
                padding: '32px 24px 80px',
                color: 'white',
                textAlign: 'center',
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
                    color: '#94a3b8',
                    margin: '0 0 20px',
                    lineHeight: 1.5,
                    maxWidth: '300px',
                    marginLeft: 'auto',
                    marginRight: 'auto'
                }}>
                    Sistema de agendamento online para clínicas e consultórios
                </p>

                {/* Redes Sociais */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '16px',
                    marginBottom: '24px'
                }}>
                    {/* Instagram */}
                    <a href="https://www.instagram.com/cendap_cp/" target="_blank" rel="noopener noreferrer" style={{
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
                    <a href="#" style={{
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
                    <a href="https://wa.me/5591999999999" target="_blank" rel="noopener noreferrer" style={{
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

                {/* Endereço */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    marginBottom: '16px'
                }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>
                        Travessa José Barros da Silva, 806 - Centro, Capitão Poço - PA
                    </p>
                </div>

                {/* Separador */}
                <div style={{
                    width: '60px',
                    height: '2px',
                    background: 'rgba(255,255,255,0.15)',
                    margin: '0 auto 16px'
                }}></div>

                {/* Copyright */}
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
                    © {new Date().getFullYear()} CENDAP. Todos os direitos reservados.
                </p>
            </footer>
        </div >
    );
}
