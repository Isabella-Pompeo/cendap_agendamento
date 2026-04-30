import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const GOOGLE_SHEETS_API = 'https://script.google.com/macros/s/AKfycbxXLDeq4DoUOWUlmAM4yWdnPDxyWPBbzFbOSoMRNlsavPJNvtiKWUzok8ed2RkzvcSY/exec';

type SheetAppointment = {
  id?: string;
  data_criacao?: string;
  nome_paciente?: string;
  medico?: string;
  especialidade?: string;
  data_consulta?: string;
  horario?: string;
  tipo?: string;
  pagamento?: string;
  status?: string;
  valor?: string | number;
};

type NormalizedAppointment = {
  id: string;
  source: 'sheet' | 'telemedicine';
  createdAt: string | null;
  appointmentAt: string | null;
  doctor: string;
  service: string;
  type: string;
  status: string;
  paymentStatus?: string;
  amount: number;
};

type DailySummary = {
  date: string;
  total: number;
  telemedicine: number;
  onsite: number;
  exams: number;
  returns: number;
  telemedicineRevenue: number;
  onsiteRevenue: number;
};

type RevenueSummary = {
  name: string;
  count: number;
  revenue: number;
  average: number;
  maxAmount: number;
};

const formatDateKey = (value: string | Date | null | undefined) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
};

const formatMonthKey = (value: string | Date | null | undefined) => {
  const key = formatDateKey(value);
  return key ? key.slice(0, 7) : '';
};

const isValidDateKey = (value: string | null) => {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
};

const getPeriodFromRequest = (req: Request) => {
  const url = new URL(req.url);
  const now = new Date();
  const todayKey = formatDateKey(now);
  const monthKey = formatMonthKey(now);
  let start = url.searchParams.get('start');
  let end = url.searchParams.get('end');

  if (!isValidDateKey(start)) start = `${monthKey}-01`;
  if (!isValidDateKey(end)) end = todayKey;

  if (start! > end!) {
    return { start: end!, end: start! };
  }

  return { start: start!, end: end! };
};

const isDateKeyInPeriod = (key: string, start: string, end: string) => {
  return !!key && key >= start && key <= end;
};

const getReportingDate = (appointment: Pick<NormalizedAppointment, 'createdAt' | 'appointmentAt'>) => {
  return appointment.createdAt || appointment.appointmentAt;
};

const parseBrazilianDate = (value?: string, time?: string) => {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime())) return direct.toISOString();

  const match = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (!match) return null;

  const day = match[1].padStart(2, '0');
  const month = match[2].padStart(2, '0');
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  const timeMatch = String(time || '').match(/(\d{1,2}):(\d{2})/);
  const hour = timeMatch ? timeMatch[1].padStart(2, '0') : '12';
  const minute = timeMatch ? timeMatch[2] : '00';

  const parsed = new Date(`${year}-${month}-${day}T${hour}:${minute}:00-03:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const parseMoney = (value: unknown) => {
  if (typeof value === 'number') return value;
  const raw = String(value || '').trim();
  if (!raw || /consultar/i.test(raw)) return 0;

  const numeric = raw.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.');
  const parsed = Number.parseFloat(numeric);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeText = (value: unknown, fallback = 'Nao informado') => {
  const text = String(value || '').trim();
  return text || fallback;
};

const isCancelled = (status: string) => /cancel/i.test(status);

const isExamAppointment = (appointment: Pick<NormalizedAppointment, 'type' | 'service'>) => {
  return /exame/i.test(`${appointment.type} ${appointment.service}`);
};

const isReturnAppointment = (appointment: Pick<NormalizedAppointment, 'type' | 'service'>) => {
  return /retorno/i.test(`${appointment.type} ${appointment.service}`);
};

const addToRanking = (map: Map<string, number>, key: string) => {
  const normalized = normalizeText(key);
  map.set(normalized, (map.get(normalized) || 0) + 1);
};

const rankingToArray = (map: Map<string, number>, limit = 6) => {
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
};

const addToRevenueRanking = (map: Map<string, RevenueSummary>, key: string, amount: number) => {
  const normalized = normalizeText(key);
  const current = map.get(normalized) || {
    name: normalized,
    count: 0,
    revenue: 0,
    average: 0,
    maxAmount: 0,
  };

  current.count += 1;
  current.revenue += amount;
  current.maxAmount = Math.max(current.maxAmount, amount);
  current.average = current.count > 0 ? current.revenue / current.count : 0;
  map.set(normalized, current);
};

const revenueRankingToArray = (map: Map<string, RevenueSummary>, sortBy: 'revenue' | 'average' | 'count' = 'revenue', limit = 8) => {
  return Array.from(map.values())
    .sort((a, b) => b[sortBy] - a[sortBy])
    .slice(0, limit);
};

async function verifyDoctor(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token || !supabaseUrl || !anonKey || !serviceKey) return false;

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const admin = createClient(supabaseUrl, serviceKey);

  const { data: userResult, error: userError } = await authClient.auth.getUser();
  if (userError || !userResult.user) return false;

  const { data: doctorSetting, error: doctorError } = await admin
    .from('doctor_settings')
    .select('id')
    .eq('user_id', userResult.user.id)
    .maybeSingle();

  return !doctorError && !!doctorSetting;
}

async function fetchSheetAppointments() {
  try {
    const response = await fetch(GOOGLE_SHEETS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'analytics_report' }),
      cache: 'no-store',
    });
    const data = await response.json();

    if (data?.result !== 'success' || !Array.isArray(data.data)) {
      return { rows: [] as SheetAppointment[], available: false };
    }

    return { rows: data.data as SheetAppointment[], available: true };
  } catch (error) {
    console.error('Erro ao buscar relatorio da planilha:', error);
    return { rows: [] as SheetAppointment[], available: false };
  }
}

export async function GET(req: Request) {
  try {
    const isDoctor = await verifyDoctor(req);
    if (!isDoctor) {
      return NextResponse.json({ error: 'Apenas medicos autorizados podem acessar as analises.' }, { status: 403 });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const [{ data: consultations, error: consultationsError }, sheetResult] = await Promise.all([
      admin
        .from('consultations')
        .select('id, doctor_name, appointment_date, status, created_at, payments(id, status, amount, created_at, appointment_data)'),
      fetchSheetAppointments(),
    ]);

    if (consultationsError) throw consultationsError;

    const sheetAppointments: NormalizedAppointment[] = sheetResult.rows
      .filter((row) => !/telemedicina/i.test(String(row.tipo || '')))
      .map((row) => ({
        id: normalizeText(row.id, `sheet-${Math.random()}`),
        source: 'sheet',
        createdAt: parseBrazilianDate(row.data_criacao),
        appointmentAt: parseBrazilianDate(row.data_consulta, row.horario),
        doctor: normalizeText(row.medico),
        service: normalizeText(row.especialidade, normalizeText(row.tipo, 'Servico')),
        type: normalizeText(row.tipo, 'Agendamento'),
        status: normalizeText(row.status, 'Pendente'),
        paymentStatus: normalizeText(row.pagamento, ''),
        amount: parseMoney(row.valor),
      }));

    const telemedicineAppointments: NormalizedAppointment[] = (consultations || []).map((consultation: any) => {
      const payment = Array.isArray(consultation.payments) ? consultation.payments[0] : consultation.payments;
      return {
        id: consultation.id,
        source: 'telemedicine',
        createdAt: consultation.created_at || payment?.created_at || null,
        appointmentAt: consultation.appointment_date || null,
        doctor: normalizeText(consultation.doctor_name, 'Telemedicina'),
        service: 'Telemedicina',
        type: 'Telemedicina',
        status: normalizeText(consultation.status, 'scheduled'),
        paymentStatus: normalizeText(payment?.status, 'pending'),
        amount: payment?.status === 'approved' ? Number(payment.amount || 0) / 100 : 0,
      };
    });

    const allAppointments = [...sheetAppointments, ...telemedicineAppointments];
    const now = new Date();
    const todayKey = formatDateKey(now);
    const monthKey = formatMonthKey(now);
    const period = getPeriodFromRequest(req);

    const activeAppointments = allAppointments.filter((appointment) => !isCancelled(appointment.status));
    const todayAppointments = activeAppointments.filter((appointment) => formatDateKey(getReportingDate(appointment)) === todayKey);
    const monthAppointments = activeAppointments.filter((appointment) => formatMonthKey(getReportingDate(appointment)) === monthKey);
    const periodAppointments = activeAppointments.filter((appointment) => isDateKeyInPeriod(formatDateKey(getReportingDate(appointment)), period.start, period.end));
    const onsiteToday = sheetAppointments.filter((appointment) => !isCancelled(appointment.status) && formatDateKey(getReportingDate(appointment)) === todayKey);
    const onsitePeriod = sheetAppointments.filter((appointment) => !isCancelled(appointment.status) && isDateKeyInPeriod(formatDateKey(getReportingDate(appointment)), period.start, period.end));
    const onsiteCancelledPeriod = sheetAppointments.filter((appointment) => isCancelled(appointment.status) && isDateKeyInPeriod(formatDateKey(getReportingDate(appointment)), period.start, period.end));
    const examsPeriod = onsitePeriod.filter(isExamAppointment);
    const returnsPeriod = onsitePeriod.filter(isReturnAppointment);
    const telemedicineToday = telemedicineAppointments.filter((appointment) => formatDateKey(getReportingDate(appointment)) === todayKey);
    const telemedicineMonth = telemedicineAppointments.filter((appointment) => formatMonthKey(getReportingDate(appointment)) === monthKey);
    const telemedicinePeriod = telemedicineAppointments.filter((appointment) => isDateKeyInPeriod(formatDateKey(getReportingDate(appointment)), period.start, period.end));
    const paidTelemedicineToday = telemedicineToday.filter((appointment) => appointment.paymentStatus === 'approved');
    const paidTelemedicineMonth = telemedicineMonth.filter((appointment) => appointment.paymentStatus === 'approved');
    const paidTelemedicinePeriod = telemedicinePeriod.filter((appointment) => appointment.paymentStatus === 'approved');

    const telemedicineRevenueToday = paidTelemedicineToday.reduce((sum, appointment) => sum + appointment.amount, 0);
    const telemedicineRevenuePeriod = paidTelemedicinePeriod.reduce((sum, appointment) => sum + appointment.amount, 0);
    const onsiteRevenueToday = onsiteToday
      .filter((appointment) => appointment.amount > 0)
      .reduce((sum, appointment) => sum + appointment.amount, 0);
    const pricedOnsitePeriod = onsitePeriod.filter((appointment) => appointment.amount > 0);
    const onsiteRevenuePeriod = onsitePeriod
      .filter((appointment) => appointment.amount > 0)
      .reduce((sum, appointment) => sum + appointment.amount, 0);
    const examsRevenuePeriod = examsPeriod
      .filter((appointment) => appointment.amount > 0)
      .reduce((sum, appointment) => sum + appointment.amount, 0);
    const revenueToday = telemedicineRevenueToday + onsiteRevenueToday;
    const revenueMonth = activeAppointments
      .filter((appointment) => appointment.amount > 0 && formatMonthKey(getReportingDate(appointment)) === monthKey)
      .reduce((sum, appointment) => sum + appointment.amount, 0);
    const revenuePeriod = telemedicineRevenuePeriod + onsiteRevenuePeriod;

    const doctors = new Map<string, number>();
    const services = new Map<string, number>();
    const exams = new Map<string, number>();
    const statuses = new Map<string, number>();
    const doctorRevenue = new Map<string, RevenueSummary>();
    const examRevenue = new Map<string, RevenueSummary>();
    const days = new Map<string, DailySummary>();

    periodAppointments.forEach((appointment) => {
      addToRanking(doctors, appointment.doctor);
      addToRanking(services, appointment.service);
      addToRanking(statuses, appointment.status);

      if (isExamAppointment(appointment) || appointment.source === 'sheet') {
        addToRanking(exams, appointment.service);
      }

      if (appointment.amount > 0) {
        addToRevenueRanking(doctorRevenue, appointment.doctor, appointment.amount);

        if (isExamAppointment(appointment)) {
          addToRevenueRanking(examRevenue, appointment.service, appointment.amount);
        }
      }

      const key = formatDateKey(getReportingDate(appointment));
      if (isDateKeyInPeriod(key, period.start, period.end)) {
        const current = days.get(key) || {
          date: key,
          total: 0,
          telemedicine: 0,
          onsite: 0,
          exams: 0,
          returns: 0,
          telemedicineRevenue: 0,
          onsiteRevenue: 0,
        };
        current.total += 1;
        if (appointment.source === 'telemedicine') {
          current.telemedicine += 1;
        } else {
          current.onsite += 1;
          if (isExamAppointment(appointment)) {
            current.exams += 1;
          }
          if (isReturnAppointment(appointment)) {
            current.returns += 1;
          }
        }
        days.set(key, current);
      }
    });

    activeAppointments.forEach((appointment) => {
      const key = formatDateKey(getReportingDate(appointment));
      if (appointment.amount > 0 && isDateKeyInPeriod(key, period.start, period.end)) {
        const current = days.get(key) || {
          date: key,
          total: 0,
          telemedicine: 0,
          onsite: 0,
          exams: 0,
          returns: 0,
          telemedicineRevenue: 0,
          onsiteRevenue: 0,
        };
        if (appointment.source === 'telemedicine') {
          current.telemedicineRevenue += appointment.amount;
        } else {
          current.onsiteRevenue += appointment.amount;
        }
        days.set(key, current);
      }
    });

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      sheetAvailable: sheetResult.available,
      period,
      summary: {
        todayAppointments: todayAppointments.length,
        monthAppointments: monthAppointments.length,
        periodAppointments: periodAppointments.length,
        todayOnsiteAppointments: onsiteToday.length,
        periodOnsiteAppointments: onsitePeriod.length,
        periodOnsiteCancelled: onsiteCancelledPeriod.length,
        periodExamAppointments: examsPeriod.length,
        periodReturnAppointments: returnsPeriod.length,
        todayTelemedicineScheduled: telemedicineToday.length,
        todayTelemedicinePaid: paidTelemedicineToday.length,
        monthTelemedicineScheduled: telemedicineMonth.length,
        monthTelemedicinePaid: paidTelemedicineMonth.length,
        periodTelemedicineScheduled: telemedicinePeriod.length,
        periodTelemedicinePaid: paidTelemedicinePeriod.length,
        revenueToday,
        revenueMonth,
        revenuePeriod,
        telemedicineRevenueToday,
        telemedicineRevenuePeriod,
        onsiteRevenueToday,
        onsiteRevenuePeriod,
        averageOnsiteTicketPeriod: pricedOnsitePeriod.length > 0 ? onsiteRevenuePeriod / pricedOnsitePeriod.length : 0,
        examsRevenuePeriod,
        averageTicketPeriod: periodAppointments.length > 0 ? revenuePeriod / periodAppointments.length : 0,
        cancelled: allAppointments.filter((appointment) => isCancelled(appointment.status)).length,
        cancelledPeriod: allAppointments.filter((appointment) => isCancelled(appointment.status) && isDateKeyInPeriod(formatDateKey(getReportingDate(appointment)), period.start, period.end)).length,
      },
      rankings: {
        doctors: rankingToArray(doctors),
        services: rankingToArray(services),
        exams: rankingToArray(exams),
        statuses: rankingToArray(statuses),
        doctorRevenue: revenueRankingToArray(doctorRevenue, 'revenue'),
        expensiveExams: revenueRankingToArray(examRevenue, 'average'),
        examRevenue: revenueRankingToArray(examRevenue, 'revenue'),
      },
      daily: Array.from(days.values()).sort((a, b) => a.date.localeCompare(b.date)),
    });
  } catch (error: any) {
    console.error('Erro nas analises do medico:', error);
    return NextResponse.json({ error: error.message || 'Erro ao carregar analises.' }, { status: 500 });
  }
}
