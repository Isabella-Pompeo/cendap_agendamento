'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { BarChart3, CalendarDays, CheckCircle, ChevronLeft, DollarSign, Download, RefreshCw, Stethoscope, Trophy, XCircle } from 'lucide-react';
import styles from './doctor-analytics.module.css';

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
  returns: number;
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
    periodReturnAppointments: number;
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
          ['Retornos agendados', String(data.summary.periodReturnAppointments)],
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
        head: [['Dia', 'Total', 'Tele', 'Presencial/Exames', 'Exames', 'Retornos', 'Valor tele', 'Valor presencial/exames']],
        body: data.daily.map((item) => [
          formatDate(item.date),
          String(item.total),
          String(item.telemedicine),
          String(item.onsite),
          String(item.exams),
          String(item.returns),
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
      <div className={styles.loadingPage}>
        Carregando analises...
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.container}>
          <div className={styles.topbar}>
          <button
            onClick={() => window.location.href = '/'}
            className={`${styles.button} ${styles.ghostButton}`}
          >
            <ChevronLeft size={18} /> Voltar
          </button>
          <div className={styles.actions}>
            <button
              onClick={exportPdf}
              disabled={!data || isExporting}
              className={`${styles.button} ${styles.lightButton}`}
            >
              <Download size={16} /> PDF
            </button>
            <button
              onClick={fetchAnalytics}
              disabled={isFetching}
              className={`${styles.button} ${styles.lightButton}`}
            >
              <RefreshCw size={16} /> Atualizar
            </button>
          </div>
          </div>

          <div className={styles.heroContent}>
            <div className={styles.titleBlock}>
              <div className={styles.heroIcon}>
                <BarChart3 size={32} />
              </div>
              <div>
                <p className={styles.eyebrow}>Painel medico</p>
                <h1 className={styles.title}>Analises do site</h1>
                <p className={styles.subtitle}>Telemedicina, presencial, exames e retornos em um unico relatorio.</p>
              </div>
            </div>
            <div className={styles.heroMeta}>
              <span className={styles.heroMetaLabel}>Periodo selecionado</span>
              <span className={styles.heroMetaValue}>
                {data ? `${formatDate(data.period.start)} ate ${formatDate(data.period.end)}` : `${formatDate(startDate)} ate ${formatDate(endDate)}`}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.filterPanel}>
          <div className={styles.filterHeader}>
            <h2 className={styles.filterTitle}>Filtro do relatorio</h2>
            <span className={styles.periodBadge}>Periodo personalizado</span>
          </div>
          <div className={styles.filterGrid}>
            <label className={styles.field}>
              Inicio
              <input className={styles.dateInput} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </label>
            <label className={styles.field}>
              Fim
              <input className={styles.dateInput} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </label>
            <button onClick={fetchAnalytics} className={`${styles.button} ${styles.primaryButton}`}>
              Aplicar filtro
            </button>
            <div className={styles.quickGroup}>
              <QuickButton onClick={() => setQuickPeriod(1)}>Hoje</QuickButton>
              <QuickButton onClick={() => setQuickPeriod(7)}>7 dias</QuickButton>
              <QuickButton onClick={() => setQuickPeriod(30)}>30 dias</QuickButton>
              <QuickButton onClick={setCurrentMonth}>Mes atual</QuickButton>
            </div>
          </div>
        </section>

        {error && (
          <div className={`${styles.notice} ${styles.errorNotice}`}>
            {error}
          </div>
        )}

        {data && !data.sheetAvailable && (
          <div className={`${styles.notice} ${styles.warningNotice}`}>
            A planilha ainda precisa responder analytics_report para incluir consultas presenciais e exames neste painel.
          </div>
        )}

        {data && (
          <>
            <div className={styles.periodLine}>
              <span>Periodo: {formatDate(data.period.start)} ate {formatDate(data.period.end)}</span>
              <span>Atualizado em {new Date(data.generatedAt).toLocaleString('pt-BR')}</span>
            </div>

            <section className={styles.metricGrid}>
              <MetricCard icon={<CalendarDays size={22} />} label="Agendamentos gerados" value={data.summary.periodAppointments} featured />
              <MetricCard icon={<DollarSign size={22} />} label="Valor total gerado" value={formatCurrency(data.summary.revenuePeriod)} featured />
              <MetricCard icon={<CheckCircle size={22} />} label="Telemedicina paga" value={`${data.summary.periodTelemedicinePaid}/${data.summary.periodTelemedicineScheduled}`} />
              <MetricCard icon={<DollarSign size={22} />} label="Valor telemedicina" value={formatCurrency(data.summary.telemedicineRevenuePeriod)} />
              <MetricCard icon={<Stethoscope size={22} />} label="Presencial/exames" value={data.summary.periodOnsiteAppointments} />
              <MetricCard icon={<DollarSign size={22} />} label="Valor presencial/exames" value={formatCurrency(data.summary.onsiteRevenuePeriod)} />
              <MetricCard icon={<Stethoscope size={22} />} label="Exames no periodo" value={data.summary.periodExamAppointments} />
              <MetricCard icon={<CheckCircle size={22} />} label="Retornos agendados" value={data.summary.periodReturnAppointments} />
              <MetricCard icon={<DollarSign size={22} />} label="Valor dos exames" value={formatCurrency(data.summary.examsRevenuePeriod)} />
              <MetricCard icon={<DollarSign size={22} />} label="Ticket medio" value={formatCurrency(data.summary.averageTicketPeriod)} />
              <MetricCard icon={<XCircle size={22} />} label="Cancelados" value={data.summary.cancelledPeriod} />
            </section>

            <section className={styles.panel}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Agendamentos gerados por dia</h2>
                <span className={styles.sectionHint}>por data de criacao</span>
              </div>
              {data.daily.length === 0 ? (
                <p className={styles.emptyText}>Nenhum agendamento encontrado neste periodo.</p>
              ) : (
                <div className={styles.dailyList}>
                  {data.daily.map((item) => (
                    <div key={item.date} className={styles.dailyRow}>
                      <span className={styles.dailyDate}>{formatShortDate(item.date)}</span>
                      <div className={styles.dailyTrack}>
                        <div className={styles.dailyBar} style={{ width: `${Math.max((item.total / maxDailyTotal) * 100, 4)}%` }} />
                      </div>
                      <div className={styles.dailyStats}>
                        <span className={styles.statPill}>{item.total} total</span>
                        <span className={styles.statPill}>{item.exams} exames</span>
                        <span className={styles.statPill}>{item.returns} retornos</span>
                        <span className={styles.statPill}>Tele {formatCurrency(item.telemedicineRevenue)}</span>
                        <span className={styles.statPill}>Pres. {formatCurrency(item.onsiteRevenue)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className={styles.rankGrid}>
              <RevenueRankingCard title="Receita por medico" items={data.rankings.doctorRevenue} mode="revenue" />
              <RevenueRankingCard title="Exames mais caros" items={data.rankings.expensiveExams} mode="average" />
              <RevenueRankingCard title="Exames por receita" items={data.rankings.examRevenue} mode="revenue" />
            </section>

            <section className={styles.smallRankGrid}>
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
    <button onClick={onClick} className={styles.quickButton}>
      {children}
    </button>
  );
}

function MetricCard({ icon, label, value, featured = false }: { icon: ReactNode; label: string; value: string | number; featured?: boolean }) {
  return (
    <div className={`${styles.metricCard} ${featured ? styles.metricCardFeatured : ''}`}>
      <div className={styles.metricTop}>
        <div className={styles.metricIcon}>
          {icon}
        </div>
        <span className={styles.metricAccent} />
      </div>
      <div className={styles.metricLabel}>{label}</div>
      <div className={styles.metricValue}>{value}</div>
    </div>
  );
}

function RevenueRankingCard({ title, items, mode }: { title: string; items: RevenueRankingItem[]; mode: 'revenue' | 'average' }) {
  const max = Math.max(...items.map((item) => mode === 'average' ? item.average : item.revenue), 1);

  return (
    <div className={styles.panel}>
      <h2 className={styles.cardTitle}>
        <DollarSign size={18} className={styles.titleIcon} /> {title}
      </h2>
      {items.length === 0 ? (
        <p className={styles.emptyText}>Sem valores registrados neste periodo.</p>
      ) : (
        <div className={styles.rankingList}>
          {items.map((item) => {
            const selectedValue = mode === 'average' ? item.average : item.revenue;

            return (
              <div key={item.name}>
                <div className={styles.rankingHeader}>
                  <span className={styles.rankingName}>{item.name}</span>
                  <span className={styles.rankingValue}>{formatCurrency(selectedValue)}</span>
                </div>
                <div className={styles.rankingMeta}>
                  <span>{item.count} agendamento(s)</span>
                  <span>Maior {formatCurrency(item.maxAmount)} | Medio {formatCurrency(item.average)}</span>
                </div>
                <div className={styles.progressTrack}>
                  <div className={styles.progressBar} style={{ width: `${Math.max((selectedValue / max) * 100, 6)}%` }} />
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
    <div className={styles.panel}>
      <h2 className={styles.cardTitle}>
        <Trophy size={18} className={styles.titleIcon} /> {title}
      </h2>
      {items.length === 0 ? (
        <p className={styles.emptyText}>Sem dados ainda.</p>
      ) : (
        <div className={styles.rankingList}>
          {items.map((item) => (
            <div key={item.name}>
              <div className={styles.rankingHeader}>
                <span className={styles.rankingName}>{item.name}</span>
                <span className={styles.rankingValue}>{item.count}</span>
              </div>
              <div className={styles.progressTrack}>
                <div className={styles.progressBar} style={{ width: `${Math.max((item.count / max) * 100, 6)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
