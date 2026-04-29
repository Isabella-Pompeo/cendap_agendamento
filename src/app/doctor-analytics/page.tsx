'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { BarChart3, CalendarDays, CheckCircle, ChevronLeft, DollarSign, Download, RefreshCw, Stethoscope, Trophy, XCircle } from 'lucide-react';

type RankingItem = {
  name: string;
  count: number;
};

type RevenueRankingItem = {
  name: string;
  count: number;
  revenue: number;
  average: number;
  maxAmount: number;
};

type DailyItem = {
  date: string;
  total: number;
  telemedicine: number;
  onsite: number;
  exams: number;
  telemedicineRevenue: number;
  onsiteRevenue: number;
};

type AnalyticsData = {
  generatedAt: string;
  sheetAvailable: boolean;
  period: {
    start: string;
    end: string;
  };
  summary: {
    todayAppointments: number;
    monthAppointments: number;
    periodAppointments: number;
    todayOnsiteAppointments: number;
    periodOnsiteAppointments: number;
    periodExamAppointments: number;
    todayTelemedicineScheduled: number;
    todayTelemedicinePaid: number;
    monthTelemedicineScheduled: number;
    monthTelemedicinePaid: number;
    periodTelemedicineScheduled: number;
    periodTelemedicinePaid: number;
    revenueToday: number;
    revenueMonth: number;
    revenuePeriod: number;
    telemedicineRevenueToday: number;
    telemedicineRevenuePeriod: number;
    onsiteRevenueToday: number;
    onsiteRevenuePeriod: number;
    examsRevenuePeriod: number;
    averageTicketPeriod: number;
    cancelled: number;
    cancelledPeriod: number;
  };
  rankings: {
    doctors: RankingItem[];
    services: RankingItem[];
    exams: RankingItem[];
    statuses: RankingItem[];
    doctorRevenue: RevenueRankingItem[];
    expensiveExams: RevenueRankingItem[];
    examRevenue: RevenueRankingItem[];
  };
  daily: DailyItem[];
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value || 0);
};

const toDateKey = (date: Date) => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
};

const getDefaultPeriod = () => {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - 29);
  return { start: toDateKey(start), end: toDateKey(now) };
};

const formatDate = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-');
  if (!year || !month || !day) return dateKey;
  return `${day}/${month}/${year}`;
};

const formatShortDate = (dateKey: string) => {
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
  const defaultPeriod = useMemo(() => getDefaultPeriod(), []);
  const [startDate, setStartDate] = useState(defaultPeriod.start);
  const [endDate, setEndDate] = useState(defaultPeriod.end);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const maxDailyTotal = useMemo(() => {
    if (!data?.daily.length) return 1;
    return Math.max(...data.daily.map((item) => item.total), 1);
  }, [data]);

  const fetchAnalytics = useCallback(async () => {
    if (!session?.access_token) return;

    setIsFetching(true);
    setError('');

    try {
      const params = new URLSearchParams({ start: startDate, end: endDate });
      const response = await fetch(`/api/doctor-analytics?${params.toString()}`, {
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
  }, [endDate, session?.access_token, startDate]);

  const setQuickPeriod = (days: number) => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - (days - 1));
    setStartDate(toDateKey(start));
    setEndDate(toDateKey(now));
  };

  const setCurrentMonth = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    setStartDate(toDateKey(start));
    setEndDate(toDateKey(now));
  };

  const exportPdf = async () => {
    if (!data) return;

    setIsExporting(true);
    try {
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF();

      doc.setTextColor(203, 30, 40);
      doc.setFontSize(18);
      doc.text('Relatorio de Analises do Site', 14, 18);

      doc.setTextColor(15, 23, 42);
      doc.setFontSize(10);
      doc.text(`Periodo: ${formatDate(data.period.start)} ate ${formatDate(data.period.end)}`, 14, 26);
      doc.text(`Gerado em: ${new Date(data.generatedAt).toLocaleString('pt-BR')}`, 14, 32);

      autoTable(doc, {
        startY: 40,
        head: [['Indicador', 'Valor']],
        body: [
          ['Agendamentos gerados pelo site', String(data.summary.periodAppointments)],
          ['Atendimentos presenciais/exames gerados', String(data.summary.periodOnsiteAppointments)],
          ['Telemedicina agendada', String(data.summary.periodTelemedicineScheduled)],
          ['Telemedicina paga', String(data.summary.periodTelemedicinePaid)],
          ['Valor telemedicina paga', formatCurrency(data.summary.telemedicineRevenuePeriod)],
          ['Valor presencial/exames gerado', formatCurrency(data.summary.onsiteRevenuePeriod)],
          ['Exames gerados', String(data.summary.periodExamAppointments)],
          ['Valor gerado por exames', formatCurrency(data.summary.examsRevenuePeriod)],
          ['Valor total gerado', formatCurrency(data.summary.revenuePeriod)],
          ['Ticket medio do periodo', formatCurrency(data.summary.averageTicketPeriod)],
          ['Cancelados no periodo', String(data.summary.cancelledPeriod)],
        ],
        headStyles: { fillColor: [203, 30, 40] },
      });

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 10,
        head: [['Receita por medico', 'Qtd', 'Receita', 'Ticket medio']],
        body: data.rankings.doctorRevenue.map((item) => [
          item.name,
          String(item.count),
          formatCurrency(item.revenue),
          formatCurrency(item.average),
        ]),
        headStyles: { fillColor: [203, 30, 40] },
      });

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 10,
        head: [['Exames mais caros', 'Qtd', 'Maior valor', 'Ticket medio', 'Receita']],
        body: data.rankings.expensiveExams.map((item) => [
          item.name,
          String(item.count),
          formatCurrency(item.maxAmount),
          formatCurrency(item.average),
          formatCurrency(item.revenue),
        ]),
        headStyles: { fillColor: [203, 30, 40] },
      });

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 10,
        head: [['Medicos com mais agendamentos', 'Qtd']],
        body: data.rankings.doctors.map((item) => [item.name, String(item.count)]),
        headStyles: { fillColor: [203, 30, 40] },
      });

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 10,
        head: [['Exames/servicos mais agendados', 'Qtd']],
        body: (data.rankings.exams.length ? data.rankings.exams : data.rankings.services).map((item) => [item.name, String(item.count)]),
        headStyles: { fillColor: [203, 30, 40] },
      });

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 10,
        head: [['Dia', 'Total', 'Tele', 'Presencial/Exames', 'Exames', 'Valor tele', 'Valor presencial/exames']],
        body: data.daily.map((item) => [
          formatDate(item.date),
          String(item.total),
          String(item.telemedicine),
          String(item.onsite),
          String(item.exams),
          formatCurrency(item.telemedicineRevenue),
          formatCurrency(item.onsiteRevenue),
        ]),
        headStyles: { fillColor: [203, 30, 40] },
      });

      doc.save(`relatorio-cendap-${data.period.start}-${data.period.end}.pdf`);
    } catch (err) {
      console.error(err);
      alert('Nao foi possivel gerar o PDF.');
    } finally {
      setIsExporting(false);
    }
  };

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
      <header style={{ backgroundColor: '#cb1e28', color: 'white', padding: '18px 22px 64px' }}>
        <div style={{ maxWidth: '1180px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => window.location.href = '/'}
            style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.22)', color: 'white', borderRadius: '8px', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 700 }}
          >
            <ChevronLeft size={18} /> Voltar
          </button>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button
              onClick={exportPdf}
              disabled={!data || isExporting}
              style={{ background: 'white', border: 'none', color: '#cb1e28', borderRadius: '8px', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: !data || isExporting ? 'not-allowed' : 'pointer', fontWeight: 800 }}
            >
              <Download size={16} /> PDF
            </button>
            <button
              onClick={fetchAnalytics}
              disabled={isFetching}
              style={{ background: 'white', border: 'none', color: '#cb1e28', borderRadius: '8px', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: isFetching ? 'not-allowed' : 'pointer', fontWeight: 800 }}
            >
              <RefreshCw size={16} /> Atualizar
            </button>
          </div>
        </div>

        <div style={{ maxWidth: '1180px', margin: '26px auto 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '14px', backgroundColor: 'rgba(255,255,255,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BarChart3 size={28} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 900 }}>Analises do site</h1>
              <p style={{ margin: '4px 0 0', opacity: 0.86, fontWeight: 600 }}>Relatorio por periodo, separado por telemedicina e presencial/exames</p>
            </div>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '1180px', margin: '-48px auto 0', padding: '0 18px 32px' }}>
        <section style={{ ...cardStyle, marginBottom: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', alignItems: 'end' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: '#475569', fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase' }}>
              Inicio
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#0f172a', fontWeight: 700 }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: '#475569', fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase' }}>
              Fim
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#0f172a', fontWeight: 700 }} />
            </label>
            <button onClick={fetchAnalytics} style={{ padding: '11px 14px', border: 'none', borderRadius: '8px', backgroundColor: '#cb1e28', color: 'white', fontWeight: 900, cursor: 'pointer' }}>
              Aplicar filtro
            </button>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <QuickButton onClick={() => setQuickPeriod(1)}>Hoje</QuickButton>
              <QuickButton onClick={() => setQuickPeriod(7)}>7 dias</QuickButton>
              <QuickButton onClick={() => setQuickPeriod(30)}>30 dias</QuickButton>
              <QuickButton onClick={setCurrentMonth}>Mes atual</QuickButton>
            </div>
          </div>
        </section>

        {error && (
          <div style={{ ...cardStyle, borderColor: '#fecaca', backgroundColor: '#fff1f2', color: '#991b1b', marginBottom: '16px', fontWeight: 700 }}>
            {error}
          </div>
        )}

        {data && !data.sheetAvailable && (
          <div style={{ ...cardStyle, borderColor: '#fed7aa', backgroundColor: '#fff7ed', color: '#9a3412', marginBottom: '16px', fontWeight: 700 }}>
            A planilha ainda precisa responder analytics_report para incluir consultas presenciais e exames neste painel.
          </div>
        )}

        {data && (
          <>
            <div style={{ color: '#64748b', fontSize: '0.86rem', fontWeight: 800, marginBottom: '10px' }}>
              Periodo: {formatDate(data.period.start)} ate {formatDate(data.period.end)}
            </div>

            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px', marginBottom: '16px' }}>
              <MetricCard icon={<CalendarDays size={22} />} label="Agendamentos gerados" value={data.summary.periodAppointments} />
              <MetricCard icon={<DollarSign size={22} />} label="Valor total gerado" value={formatCurrency(data.summary.revenuePeriod)} />
              <MetricCard icon={<CheckCircle size={22} />} label="Telemedicina paga" value={`${data.summary.periodTelemedicinePaid}/${data.summary.periodTelemedicineScheduled}`} />
              <MetricCard icon={<DollarSign size={22} />} label="Valor telemedicina" value={formatCurrency(data.summary.telemedicineRevenuePeriod)} />
              <MetricCard icon={<Stethoscope size={22} />} label="Presencial/exames" value={data.summary.periodOnsiteAppointments} />
              <MetricCard icon={<DollarSign size={22} />} label="Valor presencial/exames" value={formatCurrency(data.summary.onsiteRevenuePeriod)} />
              <MetricCard icon={<Stethoscope size={22} />} label="Exames no periodo" value={data.summary.periodExamAppointments} />
              <MetricCard icon={<DollarSign size={22} />} label="Valor dos exames" value={formatCurrency(data.summary.examsRevenuePeriod)} />
              <MetricCard icon={<DollarSign size={22} />} label="Ticket medio" value={formatCurrency(data.summary.averageTicketPeriod)} />
              <MetricCard icon={<XCircle size={22} />} label="Cancelados" value={data.summary.cancelledPeriod} />
            </section>

            <section style={{ ...cardStyle, marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '14px' }}>
                <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 900 }}>Agendamentos gerados por dia</h2>
                <span style={{ color: '#64748b', fontSize: '0.82rem', fontWeight: 700 }}>por data de criação</span>
              </div>
              {data.daily.length === 0 ? (
                <p style={{ margin: 0, color: '#64748b' }}>Nenhum agendamento encontrado neste periodo.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {data.daily.map((item) => (
                    <div key={item.date} style={{ display: 'grid', gridTemplateColumns: '56px 1fr 230px', gap: '10px', alignItems: 'center' }}>
                      <span style={{ color: '#475569', fontWeight: 800, fontSize: '0.82rem' }}>{formatShortDate(item.date)}</span>
                      <div style={{ height: '14px', borderRadius: '999px', backgroundColor: '#fee2e2', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.max((item.total / maxDailyTotal) * 100, 4)}%`, height: '100%', backgroundColor: '#cb1e28', borderRadius: '999px' }} />
                      </div>
                      <span style={{ textAlign: 'right', color: '#0f172a', fontWeight: 900, fontSize: '0.82rem' }}>
                        {item.total} | Exames {item.exams} | Tele {formatCurrency(item.telemedicineRevenue)} | Pres. {formatCurrency(item.onsiteRevenue)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '14px', marginBottom: '16px' }}>
              <RevenueRankingCard title="Receita por medico" items={data.rankings.doctorRevenue} mode="revenue" />
              <RevenueRankingCard title="Exames mais caros" items={data.rankings.expensiveExams} mode="average" />
              <RevenueRankingCard title="Exames por receita" items={data.rankings.examRevenue} mode="revenue" />
            </section>

            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
              <RankingCard title="Medicos com mais agendamentos" items={data.rankings.doctors} />
              <RankingCard title="Exames e servicos mais agendados" items={data.rankings.exams.length ? data.rankings.exams : data.rankings.services} />
              <RankingCard title="Status dos agendamentos" items={data.rankings.statuses} />
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function QuickButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ padding: '10px 12px', border: '1px solid #fecaca', borderRadius: '8px', backgroundColor: '#fff1f2', color: '#cb1e28', fontWeight: 900, cursor: 'pointer' }}>
      {children}
    </button>
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

function RevenueRankingCard({ title, items, mode }: { title: string; items: RevenueRankingItem[]; mode: 'revenue' | 'average' }) {
  const max = Math.max(...items.map((item) => mode === 'average' ? item.average : item.revenue), 1);

  return (
    <div style={cardStyle}>
      <h2 style={{ margin: '0 0 14px', fontSize: '1rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px' }}>
        <DollarSign size={18} style={{ color: '#cb1e28' }} /> {title}
      </h2>
      {items.length === 0 ? (
        <p style={{ margin: 0, color: '#64748b' }}>Sem valores registrados neste periodo.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {items.map((item) => {
            const selectedValue = mode === 'average' ? item.average : item.revenue;

            return (
              <div key={item.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '5px' }}>
                  <span style={{ fontSize: '0.86rem', color: '#0f172a', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                  <span style={{ color: '#cb1e28', fontWeight: 900 }}>{formatCurrency(selectedValue)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', color: '#64748b', fontSize: '0.74rem', fontWeight: 800, marginBottom: '5px' }}>
                  <span>{item.count} agendamento(s)</span>
                  <span>Maior {formatCurrency(item.maxAmount)} | Medio {formatCurrency(item.average)}</span>
                </div>
                <div style={{ height: '8px', borderRadius: '999px', backgroundColor: '#fee2e2', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.max((selectedValue / max) * 100, 6)}%`, backgroundColor: '#cb1e28', borderRadius: '999px' }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
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
