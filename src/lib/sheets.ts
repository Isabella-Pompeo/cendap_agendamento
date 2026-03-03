
import Papa from 'papaparse';
import { Doctor } from '../data/mocks';

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
                                isLotadoToday
                            });
                        }

                        const doc = doctorMap.get(slug)!;

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

                        // Guarda a última data disponível (ou qualquer uma)
                        if (dateRaw && dateRaw.toLowerCase().trim() !== 'sem data confirmada' && !doc.dates.includes(dateRaw)) {
                            doc.dates.push(dateRaw);
                        }

                        // Atualiza startTime se encontrar um válido e o atual estiver vazio
                        // (Caso a primeira linha do médico na planilha não tenha o horário de início)
                        if (!doc.startTime && startTime) {
                            doc.startTime = startTime;
                        }

                        // Mapeia data específica para horário específico
                        if (dateRaw && dateRaw.toLowerCase().trim() !== 'sem data confirmada' && startTime) {
                            // Normaliza a data (remove espaços extras)
                            const cleanDate = dateRaw.trim();
                            // Se já tem data, guarda o horário
                            doc.dateSpecificTimes[cleanDate] = startTime;
                        }

                        // Mapeia data específica para turno específico
                        if (dateRaw && dateRaw.toLowerCase().trim() !== 'sem data confirmada' && turnoStr) {
                            const cleanDate = dateRaw.trim();
                            doc.dateSpecificTurnos[cleanDate] = turnoStr.trim();
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
                            image: `/doctors/${doc.slug}.png`,
                            available: doc.available,
                            price: 300,
                            slots: doc.slots,
                            date: doc.dates.length > 0 ? doc.dates.join(', ') : 'Sem data confirmada',
                            additionalInfo: doc.additionalInfo,
                            startTime: doc.startTime,
                            dateSpecificTimes: doc.dateSpecificTimes,
                            dateSpecificTurnos: doc.dateSpecificTurnos,
                            isLotadoToday: doc.isLotadoToday
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

function capitalize(str: string) {
    if (!str) return '';
    return str.toLowerCase().replace(/(?:^|\s)\S/g, function (a) { return a.toUpperCase(); });
}

function generateSlug(name: string): string {
    return name.toLowerCase()
        .replace(/[àáâãäå]/g, "a")
        .replace(/[èéêë]/g, "e")
        .replace(/[ìíîï]/g, "i")
        .replace(/[òóôõö]/g, "o")
        .replace(/[ùúûü]/g, "u")
        .replace(/[ç]/g, "c")
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
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
                        return {
                            id: `svc-${index}`,
                            description: row['servicos'],
                            price: row['preco'] || 'R$ 0,00',
                            doctorResponsible: row['medico responsavel'] || '',
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
