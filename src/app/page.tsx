
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
                textAlign: 'center',
                padding: 'var(--spacing-lg)',
                paddingBottom: '80px', // Espaço extra para FABs ou indicadores de dev
                borderTop: '1px solid #e2e8f0',
                color: 'var(--text-secondary)',
                fontSize: '0.875rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: '8px', marginBottom: '12px' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary)', marginTop: '3px', flexShrink: 0 }}>
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                    <p style={{ fontWeight: 500, margin: 0, textAlign: 'left' }}>
                        Travessa José Barros da Silva, 806 - Centro, Capitão Poço - PA
                    </p>
                </div>
                © {new Date().getFullYear()} Agendamento Virtual. Todos os direitos reservados.
            </footer>
        </div >
    );
}
