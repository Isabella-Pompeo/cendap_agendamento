import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const start = url.searchParams.get('start') || '';
    const end = url.searchParams.get('end') || '';

    return NextResponse.json({
      success: true,
      generatedAt: new Date().toISOString(),
      period: { start, end },
      summary: {
        todayAppointments: 0,
        monthAppointments: 0,
        periodAppointments: 0,
        todayOnsiteAppointments: 0,
        periodOnsiteAppointments: 0,
        periodOnsiteCancelled: 0,
        periodExamAppointments: 0,
        periodReturnAppointments: 0,
        todayTelemedicineScheduled: 0,
        todayTelemedicinePaid: 0,
        monthTelemedicineScheduled: 0,
        monthTelemedicinePaid: 0,
        periodTelemedicineScheduled: 0,
        periodTelemedicinePaid: 0,
        revenueToday: 0,
        revenueMonth: 0,
        revenuePeriod: 0,
        telemedicineRevenueToday: 0,
        telemedicineRevenuePeriod: 0,
        onsiteRevenueToday: 0,
        onsiteRevenuePeriod: 0,
        onsiteClinicRevenueToday: 0,
        onsiteClinicRevenuePeriod: 0,
        specialistClinicFee: 80,
        averageOnsiteTicketPeriod: 0,
        averageOnsiteClinicTicketPeriod: 0,
        examsRevenuePeriod: 0,
        averageTicketPeriod: 0,
        cancelled: 0,
        cancelledPeriod: 0,
      },
      rankings: {
        doctors: [],
        services: [],
        exams: [],
        statuses: [],
        doctorRevenue: [],
        doctorClinicRevenue: [],
        doctorProfessionalRevenue: [],
        examVolumeRevenue: [],
        expensiveExams: [],
        examRevenue: [],
      },
      daily: [],
    });
  } catch (error: any) {
    console.error('Erro nas analises do medico:', error);
    return NextResponse.json({ error: error.message || 'Erro ao carregar analises.' }, { status: 500 });
  }
}
