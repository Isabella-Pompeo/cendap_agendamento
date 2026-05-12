
import Papa from 'papaparse';
import { Doctor, normalizeText } from '../data/mocks';

export interface Service {
    id: string;
    description: string;
    price: string;
    doctorResponsible: string;
    specialtyRelated: string;
    additionalInfo: string;
}

export async function getDoctors(): Promise<Doctor[]> {
    try {
        const sheetId = process.env.GOOGLE_SHEET_ID;
        if (!sheetId) {
            throw new Error('GOOGLE_SHEET_ID not defined');
        }

        const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&_t=${Date.now()}`;

        // Fetch com revalidação baseada no page.tsx
        const response = await fetch(csvUrl, {
            next: { revalidate: 60 } // Revalida a cada 60 segundos
        });
        const csvText = await response.text();

        return new Promise((resolve) => {
            Papa.parse(csvText, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    // Mapa para agrupar por nome do médico
                    const doctorMap = new Map<string, {
                        name: string;
                        slug: string;
                        specialties: Set<string>;
                        slots: string[];
                        dates: string[];
                        available: boolean;
                        additionalInfo: string;
                        startTime: string;
                        dateSpecificTimes: { [key: string]: string };
                        dateSpecificTurnos: { [key: string]: string };
                        isLotadoToday: boolean;
                        attendanceMode?: Doctor['attendanceMode'];
                    }>();

                    results.data.forEach((row: any) => {
                        const name = capitalize(row['medico'] || 'Médico Indefinido');
                        const specialty = capitalize(row['Especialidade'] || 'Geral');
                        const dateRaw = row['data/horário'] || '';
                        const turnoStr = row['turno'] || '';

                        // Parse startTime (remove 'h' or extra spaces)
                        let startTime = row['início dos atendimentos'] || '';
                        startTime = startTime.toLowerCase().replace('h', '').trim();
                        if (startTime.length === 4 && startTime.indexOf(':') === -1) {
                            // Handle "0800" case if necessary, but "08:00" is expected
                            // Assuming "08:00" or "8:00"
                        }

                        const vacancies = parseInt(row['vagas'] || '0', 10);
                        const additionalInfo = row['info adicional'] || '';
                        const attendanceMode = inferAttendanceMode(row, specialty, additionalInfo);

                        const statusStr = (row['status'] || '').toLowerCase().trim();
                        const isLotadoToday = statusStr === 'lotado' || statusStr === 'fechado';

                        // Verifica se é médico com agenda contínua (Dr. André, Técnicos ou tem dias da semana)
                        const lowerName = name.toLowerCase();
                        const isDrAndre = lowerName.includes('andré') || lowerName.includes('andre');
                        const isTecnicos = lowerName.includes('técnicos') || lowerName.includes('tecnicos');
                        const hasRecurringSchedule = /segunda|terça|quarta|quinta|sexta|sábado|sabado|domingo/i.test(dateRaw);

                        // Lógica de disponibilidade
                        let isAvailable = vacancies > 0 && dateRaw.toLowerCase().trim() !== 'sem data confirmada';

                        // Se for um médico com agenda contínua e não estiver explicitamente "sem data confirmada",
                        // ele deve aparecer como disponível (para permitir agendar dias futuros),
                        // mesmo que as vagas de hoje sejam 0 ou o status de hoje seja "lotado".
                        if ((isDrAndre || isTecnicos || hasRecurringSchedule) && dateRaw.toLowerCase().trim() !== 'sem data confirmada') {
                            isAvailable = true;
                        }

                        // Slug do nome para identificador único e imagem
                        const slug = generateSlug(name);

                        // Busca ou cria entrada no mapa
                        if (!doctorMap.has(slug)) {
                            doctorMap.set(slug, {
                                name,
                                slug,
                                specialties: new Set(),
                                slots: [],
                                dates: [],
                                available: false,
                                additionalInfo,
                                startTime,
                                dateSpecificTimes: {},
                                dateSpecificTurnos: {},
                                isLotadoToday,
                                attendanceMode
                            });
                        }

                        const doc = doctorMap.get(slug)!;
                        doc.attendanceMode = mergeAttendanceModes(doc.attendanceMode, attendanceMode);

                        // Adiciona especialidade
                        doc.specialties.add(specialty);

                        // Adiciona slot se disponível
                        if (isAvailable) {
                            const slotLabel = `${specialty}: ${dateRaw} às ${startTime}`;
                            doc.slots.push(slotLabel);
                            doc.available = true; // Pelo menos um horário disponível
                        }

                        if (isLotadoToday) {
                            doc.isLotadoToday = true;
                        }

                        const scheduleDateLabels = getScheduleDateLabels(dateRaw);

                        // Guarda a última data disponível (ou qualquer uma)
                        scheduleDateLabels.forEach((dateLabel) => {
                            const dateKey = getScheduleDateKey(dateLabel);
                            if (dateKey !== 'sem data confirmada') {
                                addUniqueScheduleDate(doc.dates, dateLabel);
                            }
                        });

                        const validScheduleDateLabels = scheduleDateLabels.filter((dateLabel) => {
                            return getScheduleDateKey(dateLabel) !== 'sem data confirmada';
                        });

                        if (validScheduleDateLabels.length > 0) {
                            const uniqueValidScheduleDateLabels = Array.from(new Set(validScheduleDateLabels));

                            // Mapeia data específica para horário específico
                            if (startTime) {
                                uniqueValidScheduleDateLabels.forEach((dateLabel) => {
                                    doc.dateSpecificTimes[dateLabel] = startTime;
                                });
                            }

                            // Mapeia data específica para turno específico
                            if (turnoStr) {
                                uniqueValidScheduleDateLabels.forEach((dateLabel) => {
                                    doc.dateSpecificTurnos[dateLabel] = turnoStr.trim();
                                });
                            }
                        }

                        // Atualiza startTime se encontrar um válido e o atual estiver vazio
                        // (Caso a primeira linha do médico na planilha não tenha o horário de início)
                        if (!doc.startTime && startTime) {
                            doc.startTime = startTime;
                        }

                    });

                    // Converte o mapa para array de Doctor
                    const doctors: Doctor[] = Array.from(doctorMap.values()).map((doc, index) => {
                        const specialtiesArray = Array.from(doc.specialties);
                        return {
                            id: `doc-${index}-${doc.slug}`,
                            name: doc.name,
                            specialty: specialtiesArray.join(' • '), // Ex: "Ginecologia • Clínico Geral • Obstetrícia"
                            specialties: specialtiesArray,
                            crm: '',
                            image: getDoctorImagePath(doc.slug),
                            available: doc.available,
                            price: 280,
                            slots: doc.slots,
                            date: doc.dates.length > 0 ? doc.dates.join(', ') : 'Sem data confirmada',
                            additionalInfo: doc.additionalInfo,
                            startTime: doc.startTime,
                            dateSpecificTimes: doc.dateSpecificTimes,
                            dateSpecificTurnos: doc.dateSpecificTurnos,
                            isLotadoToday: doc.isLotadoToday,
                            attendanceMode: doc.attendanceMode
                        };
                    });

                    resolve(doctors);
                },
                error: (error: any) => {
                    console.error('Erro ao parsear CSV:', error);
                    resolve([]);
                }
            });
        });

    } catch (error) {
        console.error('Erro ao buscar médicos da planilha:', error);
        return [];
    }
}

function inferAttendanceMode(row: any, specialty: string, additionalInfo: string): Doctor['attendanceMode'] {
    const modalityText = normalizeText([
        row['modalidade'],
        row['atendimento'],
        row['tipo de atendimento'],
        row['tipo atendimento'],
        row['modo de atendimento'],
        additionalInfo
    ].filter(Boolean).join(' '));

    const specialtyText = normalizeText(specialty);

    if (modalityText.includes('presencial') && (modalityText.includes('telemedicina') || modalityText.includes('online'))) {
        return 'ambos';
    }

    if (
        modalityText.includes('telemedicina') ||
        modalityText.includes('teleconsulta') ||
        modalityText.includes('online') ||
        specialtyText.includes('psicologia') ||
        specialtyText.includes('psicologo') ||
        specialtyText.includes('psicologa')
    ) {
        return 'telemedicina';
    }

    return 'presencial';
}

function mergeAttendanceModes(current: Doctor['attendanceMode'], next: Doctor['attendanceMode']): Doctor['attendanceMode'] {
    if (!current) return next;
    if (!next || current === next) return current;
    return 'ambos';
}

function normalizeScheduleDateLabel(value: string = '') {
    const trimmed = value.replace(/\s+/g, ' ').trim();

    return trimmed.replace(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g, (_, day, month, year) => {
        return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
    });
}

function getScheduleDateLabels(value: string = '') {
    const normalized = normalizeScheduleDateLabel(value);
    const dateMatches = normalized.match(/\b\d{2}\/\d{2}\/\d{4}\b/g);

    if (!dateMatches) {
        return normalized ? [normalized] : [];
    }

    return Array.from(new Set(dateMatches));
}

function getScheduleDateKey(value: string = '') {
    return normalizeText(normalizeScheduleDateLabel(value))
        .replace(/\s+/g, ' ')
        .trim();
}

function getParsedScheduleDate(value: string = '') {
    const match = normalizeScheduleDateLabel(value).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return null;

    const [, day, month, year] = match;
    return {
        day,
        month,
        year,
        isSuspiciousYear: Number(year) < 2000
    };
}

function isSameScheduleDay(left: string, right: string) {
    const leftDate = getParsedScheduleDate(left);
    const rightDate = getParsedScheduleDate(right);

    if (!leftDate || !rightDate) {
        return getScheduleDateKey(left) === getScheduleDateKey(right);
    }

    if (leftDate.day !== rightDate.day || leftDate.month !== rightDate.month) {
        return false;
    }

    return leftDate.year === rightDate.year || leftDate.isSuspiciousYear || rightDate.isSuspiciousYear;
}

function addUniqueScheduleDate(dates: string[], dateLabel: string) {
    const existingIndex = dates.findIndex((date) => isSameScheduleDay(date, dateLabel));

    if (existingIndex === -1) {
        dates.push(dateLabel);
        return;
    }

    const existingDate = getParsedScheduleDate(dates[existingIndex]);
    const nextDate = getParsedScheduleDate(dateLabel);

    if (existingDate?.isSuspiciousYear && nextDate && !nextDate.isSuspiciousYear) {
        dates[existingIndex] = dateLabel;
    }
}

function capitalize(str: string) {
    if (!str) return '';
    return str.toLowerCase().replace(/(?:^|\s)\S/g, function (a) { return a.toUpperCase(); });
}

function generateSlug(name: string): string {
    return normalizeText(name)
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

function getDoctorImagePath(slug: string): string {
    if (slug === 'dra-luciana-cristina') {
        return '/doctors/dra-luciana-cristina-v3.png';
    }

    return `/doctors/${slug}.png`;
}

export async function getServices(): Promise<Service[]> {
    try {
        const sheetId = process.env.GOOGLE_SHEET_ID;
        const gid = process.env.GOOGLE_SHEET_GID_SERVICES;

        if (!sheetId || !gid) {
            console.error('GOOGLE_SHEET_ID or GOOGLE_SHEET_GID_SERVICES not defined');
            return [];
        }

        const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}&_t=${Date.now()}`;

        // Fetch com revalidação
        const response = await fetch(csvUrl, {
            next: { revalidate: 60 } // Revalida a cada 60 segundos
        });
        const csvText = await response.text();

        return new Promise((resolve) => {
            Papa.parse(csvText, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    const validData = results.data.filter((row: any) => {
                        return row['servicos'] && row['servicos'].trim() !== '';
                    });

                    const services: Service[] = validData.map((row: any, index: number) => {
                        const description = row['servicos'] || '';
                        const drResp = row['medico responsavel'] || '';
                        const isDrAndre = drResp.toLowerCase().includes('andré') || drResp.toLowerCase().includes('andre') || description.toLowerCase().includes('andré') || description.toLowerCase().includes('andre');
                        
                        return {
                            id: `svc-${index}`,
                            description: description,
                            price: row['preco'] || 'R$ 0,00',
                            doctorResponsible: drResp,
                            specialtyRelated: row['especialidade relacionada'] || '',
                            additionalInfo: row['info adicional'] || ''
                        };
                    });

                    resolve(services);
                },
                error: (error: any) => {
                    console.error('Erro ao parsear CSV de serviços:', error);
                    resolve([]);
                }
            });
        });

    } catch (error) {
        console.error('Erro ao buscar serviços da planilha:', error);
        return [];
    }
}
