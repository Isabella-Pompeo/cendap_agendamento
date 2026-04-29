'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { BarChart3, CalendarDays, CheckCircle, ChevronLeft, DollarSign, RefreshCw, Stethoscope, Trophy, XCircle } from 'lucide-react';

type RankingItem = {
  name: string;
  count: number;
};

type DailyItem = {
  date: string;
  total: number;
  telemedicinePaid: number;
  revenue: number;
};

type AnalyticsData = {
  generatedAt: string;
  sheetAvailable: boolean;
  summary: {
    todayAppointments: number;
    monthAppointments: number;
    todayTelemedicineScheduled: number;
    todayTelemedicinePaid: number;
    monthTelemedicineScheduled: number;
    monthTelemedicinePaid: number;
    revenueToday: number;
    revenueMonth: number;
    cancelled: number;
  };
  rankings: {
    doctors: RankingItem[];
    services: RankingItem[];
    exams: RankingItem[];
    statuses: RankingItem[];
  };
  daily: DailyItem[];
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value || 0);
};

const formatDate = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-');
  if (!year || !month || !day) return dateKey;
  return `${day}/${month}`;
};

const cardStyle = {
  backgroundColor: 'white',
  border: '1px solid #e2e8f0',
  borderRadius: '10px',
  padding: '16px',
  boxShadow: '0 10px 30px rgba(15, 23, 42, 0.05)',
};

export default function DoctorAnalyticsPage() {
  const { session, user, isLoading } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState('');
  const [isFetching, setIsFetching] = useState(false);

  const maxDailyTotal = useMemo(() => {
    if (!data?.daily.length) return 1;
    return Math.max(...data.daily.map((item) => item.total), 1);
  }, [data]);

  const fetchAnalytics = useCallback(async () => {
    if (!session?.access_token) return;

    setIsFetching(true);
    setError('');

    try {
      const response = await fetch('/api/doctor-analytics', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || 'Nao foi possivel carregar as analises.');
      }

      setData(result);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar analises.');
    } finally {
      setIsFetching(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (!isLoading && !user) {
      window.location.href = '/login';
      return;
    }

    if (session?.access_token) {
      fetchAnalytics();
    }
  }, [fetchAnalytics, isLoading, user, session?.access_token]);

  if (isLoading || (isFetching && !data)) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontFamily: 'system-ui, sans-serif' }}>
        Carregando analises...
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', color: '#0f172a', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ backgroundColor: '#cb1e28', color: 'white', padding: '18px 22px 28px' }}>
        <div style={{ maxWidth: '1180px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => window.location.href = '/'}
            style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.22)', color: 'white', borderRadius: '8px', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 700 }}
          >
            <ChevronLeft size={18} /> Voltar
          </button>
          <button
            onClick={fetchAnalytics}
            disabled={isFetching}
            style={{ background: 'white', border: 'none', color: '#cb1e28', borderRadius: '8px', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: isFetching ? 'not-allowed' : 'pointer', fontWeight: 800 }}
          >
            <RefreshCw size={16} /> Atualizar
          </button>
        </div>

        <div style={{ maxWidth: '1180px', margin: '26px auto 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '14px', backgroundColor: 'rgba(255,255,255,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BarChart3 size={28} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 900 }}>Analises do site</h1>
              <p style={{ margin: '4px 0 0', opacity: 0.86, fontWeight: 600 }}>Agendamentos, telemedicina, receita e rankings</p>
            </div>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '1180px', margin: '-18px auto 0', padding: '0 18px 32px' }}>
        {error && (
          <div style={{ ...cardStyle, borderColor: '#fecaca', backgroundColor: '#fff1f2', color: '#991b1b', marginBottom: '16px', fontWeight: 700 }}>
            {error}
          </div>
        )}

        {data && !data.sheetAvailable && (
          <div style={{ ...cardStyle, borderColor: '#fed7aa', backgroundColor: '#fff7ed', color: '#9a3412', marginBottom: '16px', fontWeight: 700 }}>
            A planilha ainda precisa receber a nova acao analytics_report do Apps Script para incluir consultas presenciais e exames neste painel.
          </div>
        )}

        {data && (
          <>
            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px', marginBottom: '16px' }}>
              <MetricCard icon={<CalendarDays size={22} />} label="Agendados hoje" value={data.summary.todayAppointments} />
              <MetricCard icon={<Stethoscope size={22} />} label="Agendados no mes" value={data.summary.monthAppointments} />
              <MetricCard icon={<CheckCircle size={22} />} label="Tele pagas hoje" value={`${data.summary.todayTelemedicinePaid}/${data.summary.todayTelemedicineScheduled}`} />
              <MetricCard icon={<CheckCircle size={22} />} label="Tele pagas no mes" value={`${data.summary.monthTelemedicinePaid}/${data.summary.monthTelemedicineScheduled}`} />
              <MetricCard icon={<DollarSign size={22} />} label="Receita hoje" value={formatCurrency(data.summary.revenueToday)} />
              <MetricCard icon={<DollarSign size={22} />} label="Receita no mes" value={formatCurrency(data.summary.revenueMonth)} />
            </section>

            <section style={{ ...cardStyle, marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '14px' }}>
                <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 900 }}>Agendamentos por dia</h2>
                <span style={{ color: '#64748b', fontSize: '0.82rem', fontWeight: 700 }}>mes atual</span>
              </div>
              {data.daily.length === 0 ? (
                <p style={{ margin: 0, color: '#64748b' }}>Nenhum agendamento encontrado neste mes.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {data.daily.map((item) => (
                    <div key={item.date} style={{ display: 'grid', gridTemplateColumns: '56px 1fr 88px', gap: '10px', alignItems: 'center' }}>
                      <span style={{ color: '#475569', fontWeight: 800, fontSize: '0.82rem' }}>{formatDate(item.date)}</span>
                      <div style={{ height: '14px', borderRadius: '999px', backgroundColor: '#fee2e2', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.max((item.total / maxDailyTotal) * 100, 4)}%`, height: '100%', backgroundColor: '#cb1e28', borderRadius: '999px' }} />
                      </div>
                      <span style={{ textAlign: 'right', color: '#0f172a', fontWeight: 900 }}>{item.total}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
              <RankingCard title="Medicos com mais agendamentos" items={data.rankings.doctors} />
              <RankingCard title="Exames e servicos mais agendados" items={data.rankings.exams.length ? data.rankings.exams : data.rankings.services} />
              <RankingCard title="Status dos agendamentos" items={data.rankings.statuses} />
            </section>

            <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '0.78rem', fontWeight: 700 }}>
              <XCircle size={14} /> Cancelados acumulados: {data.summary.cancelled}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
  return (
    <div style={cardStyle}>
      <div style={{ width: '42px', height: '42px', borderRadius: '12px', backgroundColor: '#fff1f2', color: '#cb1e28', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
        {icon}
      </div>
      <div style={{ color: '#64748b', fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ marginTop: '4px', fontSize: '1.55rem', fontWeight: 950, color: '#0f172a' }}>{value}</div>
    </div>
  );
}

function RankingCard({ title, items }: { title: string; items: RankingItem[] }) {
  const max = Math.max(...items.map((item) => item.count), 1);

  return (
    <div style={cardStyle}>
      <h2 style={{ margin: '0 0 14px', fontSize: '1rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Trophy size={18} style={{ color: '#cb1e28' }} /> {title}
      </h2>
      {items.length === 0 ? (
        <p style={{ margin: 0, color: '#64748b' }}>Sem dados ainda.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {items.map((item) => (
            <div key={item.name}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '5px' }}>
                <span style={{ fontSize: '0.86rem', color: '#0f172a', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                <span style={{ color: '#cb1e28', fontWeight: 900 }}>{item.count}</span>
              </div>
              <div style={{ height: '8px', borderRadius: '999px', backgroundColor: '#fee2e2', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.max((item.count / max) * 100, 6)}%`, backgroundColor: '#cb1e28', borderRadius: '999px' }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
