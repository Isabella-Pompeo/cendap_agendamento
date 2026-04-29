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

    const activeAppointments = allAppointments.filter((appointment) => !isCancelled(appointment.status));
    const todayAppointments = activeAppointments.filter((appointment) => formatDateKey(appointment.appointmentAt) === todayKey);
    const monthAppointments = activeAppointments.filter((appointment) => formatMonthKey(appointment.appointmentAt) === monthKey);
    const telemedicineToday = telemedicineAppointments.filter((appointment) => formatDateKey(appointment.appointmentAt) === todayKey);
    const telemedicineMonth = telemedicineAppointments.filter((appointment) => formatMonthKey(appointment.appointmentAt) === monthKey);
    const paidTelemedicineToday = telemedicineToday.filter((appointment) => appointment.paymentStatus === 'approved');
    const paidTelemedicineMonth = telemedicineMonth.filter((appointment) => appointment.paymentStatus === 'approved');

    const revenueToday = activeAppointments
      .filter((appointment) => appointment.amount > 0 && formatDateKey(appointment.createdAt) === todayKey)
      .reduce((sum, appointment) => sum + appointment.amount, 0);
    const revenueMonth = activeAppointments
      .filter((appointment) => appointment.amount > 0 && formatMonthKey(appointment.createdAt) === monthKey)
      .reduce((sum, appointment) => sum + appointment.amount, 0);

    const doctors = new Map<string, number>();
    const services = new Map<string, number>();
    const exams = new Map<string, number>();
    const statuses = new Map<string, number>();
    const days = new Map<string, { date: string; total: number; telemedicinePaid: number; revenue: number }>();

    activeAppointments.forEach((appointment) => {
      addToRanking(doctors, appointment.doctor);
      addToRanking(services, appointment.service);
      addToRanking(statuses, appointment.status);

      if (/exame/i.test(appointment.type) || appointment.source === 'sheet') {
        addToRanking(exams, appointment.service);
      }

      const key = formatDateKey(appointment.appointmentAt);
      if (key && key.startsWith(monthKey)) {
        const current = days.get(key) || { date: key, total: 0, telemedicinePaid: 0, revenue: 0 };
        current.total += 1;
        if (appointment.type === 'Telemedicina' && appointment.paymentStatus === 'approved') {
          current.telemedicinePaid += 1;
        }
        days.set(key, current);
      }
    });

    activeAppointments.forEach((appointment) => {
      const key = formatDateKey(appointment.createdAt);
      if (appointment.amount > 0 && key && key.startsWith(monthKey)) {
        const current = days.get(key) || { date: key, total: 0, telemedicinePaid: 0, revenue: 0 };
        current.revenue += appointment.amount;
        days.set(key, current);
      }
    });

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      sheetAvailable: sheetResult.available,
      summary: {
        todayAppointments: todayAppointments.length,
        monthAppointments: monthAppointments.length,
        todayTelemedicineScheduled: telemedicineToday.length,
        todayTelemedicinePaid: paidTelemedicineToday.length,
        monthTelemedicineScheduled: telemedicineMonth.length,
        monthTelemedicinePaid: paidTelemedicineMonth.length,
        revenueToday,
        revenueMonth,
        cancelled: allAppointments.filter((appointment) => isCancelled(appointment.status)).length,
      },
      rankings: {
        doctors: rankingToArray(doctors),
        services: rankingToArray(services),
        exams: rankingToArray(exams),
        statuses: rankingToArray(statuses),
      },
      daily: Array.from(days.values()).sort((a, b) => a.date.localeCompare(b.date)),
    });
  } catch (error: any) {
    console.error('Erro nas analises do medico:', error);
    return NextResponse.json({ error: error.message || 'Erro ao carregar analises.' }, { status: 500 });
  }
}
