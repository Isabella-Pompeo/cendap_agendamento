import { NextResponse } from 'next/server';

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

const SPECIALIST_CLINIC_FEE = 80;

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
  return appointment.appointmentAt || appointment.createdAt;
};

const parseBrazilianDate = (value?: string | Date | null, time?: string) => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  const raw = String(value || '').trim();
  if (!raw) return null;

  const match = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (match) {
    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    const year = match[3].length === 2 ? `20${match[3]}` : match[3];
    const timeMatch = String(time || '').match(/(\d{1,2}):(\d{2})/);
    const hour = timeMatch ? timeMatch[1].padStart(2, '0') : '12';
    const minute = timeMatch ? timeMatch[2] : '00';

    const parsed = new Date(`${year}-${month}-${day}T${hour}:${minute}:00-03:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  const direct = new Date(raw);
  return Number.isNaN(direct.getTime()) ? null : direct.toISOString();
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

const normalizeForComparison = (value: unknown) => {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
};

const isCancelled = (status: string) => /cancel/i.test(status);
const isConfirmed = (status: string) => /confirm/i.test(normalizeForComparison(status));

const isExamAppointment = (appointment: Pick<NormalizedAppointment, 'type' | 'service'>) => {
  return /exame/i.test(`${appointment.type} ${appointment.service}`);
};

const isReturnAppointment = (appointment: Pick<NormalizedAppointment, 'type' | 'service'>) => {
  return /retorno/i.test(`${appointment.type} ${appointment.service}`);
};

const isDoctorAndre = (doctor: string) => {
  const normalized = normalizeForComparison(doctor);
  return normalized.includes('andre');
};

const isTechnician = (doctor: string) => {
  const normalized = normalizeForComparison(doctor);
  return normalized.includes('tecnico');
};

const getDoctorDisplayName = (doctor: string) => {
  return isDoctorAndre(doctor) ? 'Dr. Andre Pontes' : normalizeText(doctor);
};

const getClinicRevenueAmount = (appointment: Pick<NormalizedAppointment, 'doctor' | 'amount' | 'type' | 'service'>) => {
  if (appointment.amount <= 0) return 0;
  if (isReturnAppointment(appointment)) return 0;
  return isDoctorAndre(appointment.doctor) || isTechnician(appointment.doctor) ? appointment.amount : SPECIALIST_CLINIC_FEE;
};

const getProfessionalRevenueAmount = (appointment: Pick<NormalizedAppointment, 'doctor' | 'amount' | 'type' | 'service'>) => {
  if (appointment.amount <= 0) return 0;
  if (isReturnAppointment(appointment)) return 0;
  return isDoctorAndre(appointment.doctor) || isTechnician(appointment.doctor)
    ? appointment.amount
    : Math.max(appointment.amount - SPECIALIST_CLINIC_FEE, 0);
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
  const normalized = normalizeForComparison(key) || normalizeText(key);
  const displayName = normalizeText(key);
  const current = map.get(normalized) || {
    name: displayName,
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

export async function GET(req: Request) {
  try {
    return NextResponse.json({
      success: true,
      data: [],
      message: 'Analytics local desativada.'
    });
  } catch (error) {
    console.error('Erro ao gerar analytics local:', error);
    return NextResponse.json({ error: 'Erro ao gerar analytics local.' }, { status: 500 });
  }
}
    const now = new Date();
    const todayKey = formatDateKey(now);
    const monthKey = formatMonthKey(now);
    const period = getPeriodFromRequest(req);

    const confirmedSheetAppointments = sheetAppointments.filter((appointment) => isConfirmed(appointment.status));
    const activeAppointments = allAppointments.filter((appointment) => (
      appointment.source === 'sheet' ? isConfirmed(appointment.status) : !isCancelled(appointment.status)
    ));
    const todayAppointments = activeAppointments.filter((appointment) => formatDateKey(getReportingDate(appointment)) === todayKey);
    const monthAppointments = activeAppointments.filter((appointment) => formatMonthKey(getReportingDate(appointment)) === monthKey);
    const periodAppointments = activeAppointments.filter((appointment) => isDateKeyInPeriod(formatDateKey(getReportingDate(appointment)), period.start, period.end));
    const onsiteToday = confirmedSheetAppointments.filter((appointment) => formatDateKey(getReportingDate(appointment)) === todayKey);
    const onsitePeriod = confirmedSheetAppointments.filter((appointment) => isDateKeyInPeriod(formatDateKey(getReportingDate(appointment)), period.start, period.end));
    const onsiteCancelledPeriod = sheetAppointments.filter((appointment) => isCancelled(appointment.status) && isDateKeyInPeriod(formatDateKey(getReportingDate(appointment)), period.start, period.end));
    const examsPeriod = onsitePeriod.filter(isExamAppointment);
    const returnsPeriod = onsitePeriod.filter(isReturnAppointment);
    const activeTelemedicineAppointments = telemedicineAppointments.filter((appointment) => !isCancelled(appointment.status));
    const telemedicineToday = activeTelemedicineAppointments.filter((appointment) => formatDateKey(getReportingDate(appointment)) === todayKey);
    const telemedicineMonth = activeTelemedicineAppointments.filter((appointment) => formatMonthKey(getReportingDate(appointment)) === monthKey);
    const telemedicinePeriod = activeTelemedicineAppointments.filter((appointment) => isDateKeyInPeriod(formatDateKey(getReportingDate(appointment)), period.start, period.end));
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
    const pricedClinicOnsitePeriod = onsitePeriod.filter((appointment) => getClinicRevenueAmount(appointment) > 0);
    const onsiteClinicRevenuePeriod = onsitePeriod.reduce((sum, appointment) => sum + getClinicRevenueAmount(appointment), 0);
    const onsiteClinicRevenueToday = onsiteToday.reduce((sum, appointment) => sum + getClinicRevenueAmount(appointment), 0);
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
    const doctorClinicRevenue = new Map<string, RevenueSummary>();
    const doctorProfessionalRevenue = new Map<string, RevenueSummary>();
    const examRevenue = new Map<string, RevenueSummary>();
    const examVolumeRevenue = new Map<string, RevenueSummary>();
    const days = new Map<string, DailySummary>();

    periodAppointments.forEach((appointment) => {
      addToRanking(doctors, appointment.doctor);
      addToRanking(services, appointment.service);
      addToRanking(statuses, appointment.status);

      if (isExamAppointment(appointment)) {
        addToRanking(exams, appointment.service);
        addToRevenueRanking(examVolumeRevenue, appointment.service, appointment.amount);
      }

      if (appointment.amount > 0) {
        addToRevenueRanking(doctorRevenue, getDoctorDisplayName(appointment.doctor), appointment.amount);
        if (appointment.source === 'sheet') {
          const clinicAmount = getClinicRevenueAmount(appointment);
          if (clinicAmount > 0) {
            addToRevenueRanking(doctorClinicRevenue, getDoctorDisplayName(appointment.doctor), clinicAmount);
          }

          const professionalAmount = getProfessionalRevenueAmount(appointment);
          if (professionalAmount > 0) {
            addToRevenueRanking(doctorProfessionalRevenue, getDoctorDisplayName(appointment.doctor), professionalAmount);
          }
        }

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
        onsiteClinicRevenueToday,
        onsiteClinicRevenuePeriod,
        specialistClinicFee: SPECIALIST_CLINIC_FEE,
        averageOnsiteTicketPeriod: pricedOnsitePeriod.length > 0 ? onsiteRevenuePeriod / pricedOnsitePeriod.length : 0,
        averageOnsiteClinicTicketPeriod: pricedClinicOnsitePeriod.length > 0 ? onsiteClinicRevenuePeriod / pricedClinicOnsitePeriod.length : 0,
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
        doctorClinicRevenue: revenueRankingToArray(doctorClinicRevenue, 'revenue'),
        doctorProfessionalRevenue: revenueRankingToArray(doctorProfessionalRevenue, 'revenue'),
        examVolumeRevenue: revenueRankingToArray(examVolumeRevenue, 'count'),
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
