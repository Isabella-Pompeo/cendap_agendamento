
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
            <Header />

            <main style={{
                flex: 1,
                padding: 'var(--spacing-lg)',
                maxWidth: '600px',
                margin: '0 auto',
                width: '100%'
            }}>
                <div style={{ marginBottom: 'var(--spacing-lg)', textAlign: 'center' }}>
                    <h2 style={{
                        fontSize: '2rem',
                        fontWeight: 600,
                        color: '#1d1d1f',
                        letterSpacing: '-0.025em',
                        marginBottom: '8px'
                    }}>
                        Agendamento Online
                    </h2>
                    <p style={{
                        fontSize: '1.0625rem',
                        color: '#86868b',
                        fontWeight: 400,
                        maxWidth: '400px',
                        margin: '0 auto',
                        lineHeight: 1.4
                    }}>
                        Agende sua consulta ou seus exames de forma rápida e prática.
                    </p>
                </div>

                <ClientPage doctors={doctors} services={services} />
            </main >

            <footer style={{
                textAlign: 'center',
                padding: 'var(--spacing-lg)',
                borderTop: '1px solid #e2e8f0',
                color: 'var(--text-secondary)',
                fontSize: '0.875rem'
            }}>
                © {new Date().getFullYear()} Agendamento Virtual. Todos os direitos reservados.
            </footer>
        </div >
    );
}
