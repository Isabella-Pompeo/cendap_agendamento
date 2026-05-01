'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { BarChart3, CalendarDays, CheckCircle, ChevronLeft, DollarSign, Download, RefreshCw, Stethoscope, Trophy, XCircle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
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
    periodOnsiteCancelled: number;
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
    onsiteClinicRevenueToday: number;
    onsiteClinicRevenuePeriod: number;
    specialistClinicFee: number;
    averageOnsiteTicketPeriod: number;
    averageOnsiteClinicTicketPeriod: number;
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
    doctorClinicRevenue: RevenueRankingItem[];
    examVolumeRevenue: RevenueRankingItem[];
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
  const onsiteConsultations = data
    ? Math.max(data.summary.periodOnsiteAppointments - data.summary.periodExamAppointments - data.summary.periodReturnAppointments, 0)
    : 0;
  const onsiteCancellationRate = data && (data.summary.periodOnsiteAppointments + data.summary.periodOnsiteCancelled) > 0
    ? Math.round((data.summary.periodOnsiteCancelled / (data.summary.periodOnsiteAppointments + data.summary.periodOnsiteCancelled)) * 100)
    : 0;
  const telemedicinePaymentRate = data && data.summary.periodTelemedicineScheduled > 0
    ? Math.round((data.summary.periodTelemedicinePaid / data.summary.periodTelemedicineScheduled) * 100)
    : 0;
  const onsiteRevenueDifference = data
    ? Math.max(data.summary.onsiteRevenuePeriod - data.summary.onsiteClinicRevenuePeriod, 0)
    : 0;

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
          ['Presencial/exames', String(data.summary.periodOnsiteAppointments)],
          ['Valor presencial/exames', formatCurrency(data.summary.onsiteRevenuePeriod)],
          ['Faturamento real da clinica', formatCurrency(data.summary.onsiteClinicRevenuePeriod)],
          ['Diferenca de repasses/descontos', formatCurrency(onsiteRevenueDifference)],
          ['Ticket medio presencial', formatCurrency(data.summary.averageOnsiteTicketPeriod)],
          ['Ticket medio real da clinica', formatCurrency(data.summary.averageOnsiteClinicTicketPeriod)],
          ['Consultas presenciais', String(onsiteConsultations)],
          ['Retornos', String(data.summary.periodReturnAppointments)],
          ['Exames', String(data.summary.periodExamAppointments)],
          ['Cancelados presencial/exames', String(data.summary.periodOnsiteCancelled)],
          ['Taxa de cancelamento', `${onsiteCancellationRate}%`],
          ['Telemedicina agendada', String(data.summary.periodTelemedicineScheduled)],
          ['Telemedicina paga', `${data.summary.periodTelemedicinePaid}/${data.summary.periodTelemedicineScheduled}`],
          ['Valor telemedicina', formatCurrency(data.summary.telemedicineRevenuePeriod)],
        ],
        headStyles: { fillColor: [203, 30, 40] },
      });

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 10,
        head: [['Servicos mais agendados', 'Qtd']],
        body: (data.rankings.exams.length ? data.rankings.exams : data.rankings.services).map((item) => [item.name, String(item.count)]),
        headStyles: { fillColor: [203, 30, 40] },
      });

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 10,
        head: [['Dia', 'Total', 'Telemedicina', 'Presencial/exames', 'Retornos']],
        body: data.daily.map((item) => [
          formatDate(item.date),
          String(item.total),
          String(item.telemedicine),
          String(item.onsite),
          String(item.returns),
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
              <RefreshCw size={16} className={isFetching ? styles.spinner : ''} /> Atualizar
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
            <button onClick={fetchAnalytics} disabled={isFetching} className={`${styles.button} ${styles.primaryButton}`}>
              {isFetching ? (
                <>
                  <RefreshCw size={18} className={styles.spinner} /> Filtrando...
                </>
              ) : (
                'Aplicar filtro'
              )}
            </button>
            <div className={styles.quickGroup}>
              <QuickButton onClick={() => setQuickPeriod(1)} disabled={isFetching}>Hoje</QuickButton>
              <QuickButton onClick={() => setQuickPeriod(7)} disabled={isFetching}>7 dias</QuickButton>
              <QuickButton onClick={() => setQuickPeriod(30)} disabled={isFetching}>30 dias</QuickButton>
              <QuickButton onClick={setCurrentMonth} disabled={isFetching}>Mes atual</QuickButton>
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
              <MetricCard icon={<CalendarDays size={22} />} label="Presencial/exames" value={data.summary.periodOnsiteAppointments} featured />
              <MetricCard icon={<DollarSign size={22} />} label="Faturamento real" value={formatCurrency(data.summary.onsiteClinicRevenuePeriod)} featured />
              <MetricCard icon={<DollarSign size={22} />} label="Ticket medio real" value={formatCurrency(data.summary.averageOnsiteClinicTicketPeriod)} />
              <MetricCard icon={<Stethoscope size={22} />} label="Consultas" value={onsiteConsultations} />
              <MetricCard icon={<CheckCircle size={22} />} label="Retornos" value={data.summary.periodReturnAppointments} />
              <MetricCard icon={<Stethoscope size={22} />} label="Exames" value={data.summary.periodExamAppointments} />
              <MetricCard icon={<XCircle size={22} />} label="Taxa cancelamento" value={`${onsiteCancellationRate}%`} />
            </section>

            <section className={styles.financePanel}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Resumo financeiro da clinica</h2>
                <span className={styles.sectionHint}>Dr. Andre valor cheio; especialistas {formatCurrency(data.summary.specialistClinicFee)} por consulta/exame</span>
              </div>
              <div className={styles.financeGrid}>
                <div className={styles.financeItem}>
                  <span className={styles.financeLabel}>Faturamento bruto presencial/exames</span>
                  <strong className={styles.financeValue}>{formatCurrency(data.summary.onsiteRevenuePeriod)}</strong>
                </div>
                <div className={styles.financeItem}>
                  <span className={styles.financeLabel}>Faturamento real para a clinica</span>
                  <strong className={styles.financeValue}>{formatCurrency(data.summary.onsiteClinicRevenuePeriod)}</strong>
                </div>
                <div className={styles.financeItem}>
                  <span className={styles.financeLabel}>Repasses/descontos dos especialistas</span>
                  <strong className={styles.financeValue}>{formatCurrency(onsiteRevenueDifference)}</strong>
                </div>
              </div>
            </section>

            <div className={styles.chartGrid}>
              <section className={`${styles.panel} ${styles.chartPanel}`}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>Movimento por dia</h2>
                  <span className={styles.sectionHint}>agendamentos no periodo</span>
                </div>
                {data.daily.length === 0 ? (
                  <p className={styles.emptyText}>Nenhum agendamento encontrado neste periodo.</p>
                ) : (
                  <div className={styles.chartCanvas}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data.daily.map(d => ({ ...d, shortDate: formatShortDate(d.date) }))} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#E11D48" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#E11D48" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis dataKey="shortDate" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                        <RechartsTooltip 
                          allowEscapeViewBox={{ x: false, y: false }}
                          contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                          labelStyle={{ fontWeight: 700, color: '#0F172A', marginBottom: 4 }}
                          itemStyle={{ fontWeight: 600, fontSize: 14 }}
                        />
                        <Area type="monotone" dataKey="total" name="Total Agendamentos" stroke="#E11D48" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </section>

              <DoctorRevenueCard items={data.rankings.doctorClinicRevenue} title="Faturamento real por medico" emptyText="Sem faturamento real registrado neste periodo." />
            </div>

            <section className={styles.examValueSection}>
              <ExamVolumeCard items={data.rankings.examVolumeRevenue} />
            </section>

            <section className={styles.telemedicineSection}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Telemedicina</h2>
                <span className={styles.sectionHint}>dados separados do presencial</span>
              </div>
              <div className={styles.telemedicineGrid}>
                <MetricCard icon={<CalendarDays size={22} />} label="Agendadas" value={data.summary.periodTelemedicineScheduled} />
                <MetricCard icon={<CheckCircle size={22} />} label="Pagas" value={`${data.summary.periodTelemedicinePaid}/${data.summary.periodTelemedicineScheduled}`} />
                <MetricCard icon={<DollarSign size={22} />} label="Valor pago" value={formatCurrency(data.summary.telemedicineRevenuePeriod)} />
                <MetricCard icon={<CheckCircle size={22} />} label="Taxa de pagamento" value={`${telemedicinePaymentRate}%`} />
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function QuickButton({ children, onClick, disabled = false }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className={styles.quickButton}>
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

function DoctorRevenueCard({
  items,
  title = 'Faturamento por medico',
  emptyText = 'Sem faturamento registrado neste periodo.',
}: {
  items: RevenueRankingItem[];
  title?: string;
  emptyText?: string;
}) {
  const filteredItems = items.filter((item) => item.revenue > 0);
  const max = Math.max(...filteredItems.map((item) => item.revenue), 1);

  return (
    <div className={`${styles.panel} ${styles.revenuePanel}`}>
      <h2 className={styles.cardTitle}>
        <DollarSign size={18} className={styles.titleIcon} /> {title}
      </h2>
      {filteredItems.length === 0 ? (
        <p className={styles.emptyText}>{emptyText}</p>
      ) : (
        <div className={`${styles.rankingList} ${styles.revenueRankingList}`}>
          {filteredItems.map((item) => (
            <div key={item.name}>
              <div className={styles.rankingHeader}>
                <span className={styles.rankingName}>{item.name}</span>
                <span className={styles.rankingValue}>{formatCurrency(item.revenue)}</span>
              </div>
              <div className={styles.rankingMeta}>
                <span>{item.count} agendamento{item.count === 1 ? '' : 's'} com valor</span>
                <span>Media {formatCurrency(item.average)}</span>
              </div>
              <div className={styles.progressTrack}>
                <div className={styles.progressBar} style={{ width: `${Math.max((item.revenue / max) * 100, 6)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ExamVolumeCard({ items }: { items: RevenueRankingItem[] }) {
  const filteredItems = items.filter((item) => item.count > 0);

  return (
    <div className={styles.panel}>
      <h2 className={styles.cardTitle}>
        <Stethoscope size={18} className={styles.titleIcon} /> Exames mais agendados
      </h2>
      {filteredItems.length === 0 ? (
        <p className={styles.emptyText}>Sem exames agendados neste periodo.</p>
      ) : (
        <div className={styles.expensiveExamList}>
          {filteredItems.map((item) => (
            <div key={item.name} className={styles.expensiveExamRow}>
              <div className={styles.expensiveExamInfo}>
                <span className={styles.expensiveExamName}>{item.name}</span>
                <span className={styles.expensiveExamCount}>{item.count} agendado{item.count === 1 ? '' : 's'}</span>
              </div>
              <span className={styles.expensiveExamValue}>{formatCurrency(item.revenue)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
