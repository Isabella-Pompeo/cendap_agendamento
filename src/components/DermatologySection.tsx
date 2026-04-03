'use client';
import React from 'react';
import { Sparkles, Syringe, Droplets, Sun, Activity, ArrowRight, Moon } from 'lucide-react';

const treatments = [
    { id: '1', title: 'Protetor Solar', icon: null, image: '/protetor-dermato.png', color: 'linear-gradient(135deg, #ffeaea 0%, #ffc5c5 100%)' },
    { id: '2', title: 'Skin Care',      icon: null, image: '/skincare-dermato.png', color: 'linear-gradient(135deg, #ffeaea 0%, #ffc5c5 100%)' },
    { id: '3', title: 'Hidratação',     icon: null, image: '/hidratacao-dermato.png', color: 'linear-gradient(135deg, #ffeaea 0%, #ffc5c5 100%)' },
];

const tips = [
    { id: '1', title: 'Uso do Protetor Solar', desc: 'Aplique todos os dias, mesmo em ambientes internos. Reaplicar ao longo do dia é essencial.', icon: <img src="/iconsolares-dermato.png" alt="Ícone Protetor" style={{ width: '48px', height: '48px', objectFit: 'contain' }} /> },
    { id: '2', title: 'Skin Care', desc: 'Limpar e hidratar já fazem diferença na sua pele. Use produtos específicos para seu tipo de pele diariamente.', icon: <img src="/iconskincare-dermato.png" alt="Ícone Skin Care" style={{ width: '48px', height: '48px', objectFit: 'contain' }} /> },
    { id: '3', title: 'Hidratação Profunda', desc: 'Beba bastante água e use hidratantes adequados ao seu tipo de pele para manter a barreira fortalecida.', icon: <img src="/iconagua-dermato.png" alt="Ícone Água" style={{ width: '48px', height: '48px', objectFit: 'contain' }} /> },
];

export default function DermatologySection() {
    return (
        <section style={{
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '0 var(--spacing-lg) 40px',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: '32px',
        }}>
            {/* Banner da Arte (Dermatologista) */}
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
                        srcSet="/dermatocard-desktop.jpeg"
                    />
                    {/* Mobile: imagem atual */}
                    <img
                        src="/dermatocard-mobile.jpeg"
                        alt="Arte Dermatologista"
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

            {/* Horizontal Scroll Section - "Tratamentos" */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}>
                    <h3 style={{
                        fontSize: '1rem',
                        fontWeight: 800,
                        color: 'var(--text-main, #374151)',
                        margin: 0,
                        letterSpacing: '0.05em',
                    }}>
                        Dicas &amp; Cuidados
                    </h3>
                    <div style={{
                        height: '2px',
                        background: 'rgba(0,0,0,0.05)',
                        flex: 1,
                        marginLeft: '16px'
                    }}></div>
                </div>

                {/* Scroll Container */}
                <div style={{
                    display: 'flex',
                    gap: '16px',
                    overflowX: 'auto',
                    paddingBottom: '16px',
                    scrollSnapType: 'x mandatory',
                    WebkitOverflowScrolling: 'touch',
                    marginRight: 'calc(-1 * var(--spacing-lg))',
                    paddingRight: 'var(--spacing-lg)',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                }}
                className="hide-scrollbar desktop-center-scroll"
                >
                    {treatments.map((item) => (
                        <div key={item.id} style={{
                            flex: '0 0 auto',
                            width: '110px',
                            height: '140px',
                            background: item.image ? 'none' : item.color,
                            borderRadius: '24px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: item.image ? 'flex-end' : 'center',
                            padding: item.image ? '0' : '12px',
                            scrollSnapAlign: 'start',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                            cursor: 'pointer',
                            overflow: 'hidden',
                            position: 'relative',
                        }}>
                            {item.image ? (
                                <>
                                    <img
                                        src={item.image}
                                        alt={item.title}
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                        }}
                                    />
                                </>
                            ) : (
                                <>
                                    <div style={{
                                        width: '52px',
                                        height: '52px',
                                        background: '#fff',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        marginBottom: '12px',
                                        boxShadow: '0 4px 12px rgba(203,30,40,0.1)'
                                    }}>
                                        {item.icon}
                                    </div>
                                    <span style={{
                                        fontSize: '0.85rem',
                                        fontWeight: 700,
                                        color: '#cb1e28',
                                        textAlign: 'center'
                                    }}>
                                        {item.title}
                                    </span>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Bottom Info Section - "Rotina Diária" */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}>
                    <h3 style={{
                        fontSize: '1rem',
                        fontWeight: 800,
                        color: 'var(--text-main, #374151)',
                        margin: 0,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase'
                    }}>
                        Prevenção Diária
                    </h3>
                    <div style={{
                        height: '2px',
                        background: 'rgba(0,0,0,0.05)',
                        flex: 1,
                        marginLeft: '16px'
                    }}></div>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {tips.map((tip) => (
                        <div key={tip.id} style={{
                            background: '#ffffff',
                            borderRadius: '24px',
                            padding: '24px',
                            display: 'flex',
                            gap: '16px',
                            alignItems: 'center',
                            boxShadow: '0 10px 30px rgba(0,0,0,0.04)',
                            border: '1px solid rgba(0,0,0,0.02)',
                            transition: 'transform 0.2s',
                            cursor: 'default',
                        }}
                        onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.01)'}
                        onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                            <div style={{
                                background: 'rgba(203,30,40,0.08)',
                                color: 'var(--primary-light, #cb1e28)',
                                padding: '12px',
                                borderRadius: '16px',
                                flexShrink: 0,
                                display: 'flex',
                                alignItems: 'center',
                            }}>
                                {tip.icon}
                            </div>
                            <div>
                                <h4 style={{ margin: '0 0 4px', fontWeight: 700, color: '#374151', fontSize: '0.95rem' }}>{tip.title}</h4>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: '#6b7280', lineHeight: 1.4 }}>
                                    {tip.desc}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

        </section>
    );
}
