
export interface Doctor {
  id: string;
  name: string;
  specialty: string; // Mantido para compatibilidade, será a primeira especialidade
  specialties?: string[]; // Array com todas as especialidades
  crm?: string;
  image?: string;
  available: boolean;
  price?: number;
  slots: string[];
  date?: string;
  additionalInfo?: string;
  startTime?: string;
  dateSpecificTimes?: { [key: string]: string };
  dateSpecificTurnos?: { [key: string]: string };
  isLotadoToday?: boolean;
}

export interface Service {
  id: string;
  description: string;
  price: string;
  doctorResponsible: string;
  specialtyRelated: string;
  additionalInfo: string;
}

export function normalizeText(value: string = '') {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export const mockServices: Service[] = [
  {
    id: 'svc-1',
    description: 'Consulta Clínica',
    price: 'R$ 280,00',
    doctorResponsible: 'Dr. Ricardo Silva',
    specialtyRelated: 'Cardiologia',
    additionalInfo: 'Atendimento presencial'
  },
  {
    id: 'svc-2',
    description: 'Consulta Dermatologia',
    price: 'R$ 300,00',
    doctorResponsible: 'Dra. Fernanda Oliveira',
    specialtyRelated: 'Dermatologia',
    additionalInfo: 'Atendimento presencial'
  }
];

export const mockDoctors: Doctor[] = [
  {
    id: '1',
    name: 'Dr. Humberto Pinheiro',
    specialty: 'Cardiologia',
    specialties: ['Cardiologia', 'ECG', 'Avaliação Cardiovascular'],
    crm: '12345-SP',
    image: 'https://api.dicebear.com/7.x/avataaars/png?seed=Ricardo',
    available: true,
    price: 350,
    slots: ['09:00', '10:30', '14:00', '16:00'],
    date: 'Hoje',
    additionalInfo: 'Atendimento presencial e telemedicina'
  },
  {
    id: '2',
    name: 'Dra. Lorena Oshikiri',
    specialty: 'Dermatologia',
    specialties: ['Dermatologia', 'Cosmiatria'],
    crm: '67890-SP',
    image: 'https://api.dicebear.com/7.x/avataaars/png?seed=Fernanda',
    available: true,
    price: 300,
    slots: ['08:00', '11:00', '13:30', '15:00', '17:00'],
    date: 'Hoje',
    additionalInfo: 'Especialista em acne, dermatite e estética médica'
  },
  {
    id: '3',
    name: 'Dr. Ednaldo Matos',
    specialty: 'Ortopedia',
    specialties: ['Ortopedia', 'Traumatologia'],
    crm: '11223-SP',
    image: 'https://api.dicebear.com/7.x/avataaars/png?seed=Lucas',
    available: false,
    price: 400,
    slots: [],
    date: 'Próximos dias',
    additionalInfo: 'Agenda em breve para novas vagas'
  },
  {
    id: '4',
    name: 'Dr. Dilvan Machado',
    specialty: 'Neuropediatra',
    specialties: ['Neuropediatria', 'Vacinas'],
    crm: '44556-SP',
    image: 'https://api.dicebear.com/7.x/avataaars/png?seed=Camila',
    available: true,
    price: 280,
    slots: ['09:15', '10:45', '14:30'],
    date: 'Hoje',
    additionalInfo: 'Atendimento infantil e acompanhamento preventivo'
  },
  {
    id: '5',
    name: 'Dr. Antonio Cesar',
    specialty: 'Neurologia',
    specialties: ['Neurologia', 'Neuropediatria'],
    crm: '99887-SP',
    image: 'https://api.dicebear.com/7.x/avataaars/png?seed=Julianne',
    available: true,
    price: 500,
    slots: ['10:00', '11:30', '15:00', '16:30'],
    date: 'Hoje',
    additionalInfo: 'Avaliação neurológica e acompanhamento especializado'
  },
  {
    id: '6',
    name: 'Dr. Andre Pontes',
    specialty: 'Ginecologia',
    specialties: ['Ginecologia', 'Obstetrícia'],
    crm: '55555-PE',
    image: 'https://api.dicebear.com/7.x/avataaars/png?seed=Joao',
    available: true,
    price: 320,
    slots: ['09:00', '13:00', '15:00'],
    date: 'Hoje',
    additionalInfo: 'Atendimento para saúde da mulher'
  },
  {
    id: '7',
    name: 'Dr. Renato Terra',
    specialty: 'Endocrinologia',
    specialties: ['Endocrinologia', 'Metabolismo'],
    crm: '77777-RJ',
    image: 'https://api.dicebear.com/7.x/avataaars/png?seed=AnaBeatriz',
    available: true,
    price: 380,
    slots: ['08:30', '12:00', '16:00'],
    date: 'Hoje',
    additionalInfo: 'Atendimento para tireoide, diabetes e metabolismo'
  },
  {
    id: '8',
    name: 'Dr. Igor Coutinho',
    specialty: 'Oftalmologia',
    specialties: ['Oftalmologia', 'Catarata'],
    crm: '88888-SP',
    image: 'https://api.dicebear.com/7.x/avataaars/png?seed=Marcelo',
    available: true,
    price: 360,
    slots: ['09:30', '11:30', '14:30'],
    date: 'Hoje',
    additionalInfo: 'Avaliação de digestão, intestino e rotina alimentar'
  },
  {
    id: '9',
    name: 'Dr. Antonio Carlos',
    specialty: 'Urologia',
    specialties: ['Urologia', 'Nefrologia'],
    crm: '99999-SP',
    image: 'https://api.dicebear.com/7.x/avataaars/png?seed=Renata',
    available: true,
    price: 420,
    slots: ['10:00', '13:00', '17:00'],
    date: 'Hoje',
    additionalInfo: 'Acompanhamento psicológico e psiquiátrico'
  },
  {
    id: '10',
    name: 'Dra. Beatriz Pontes',
    specialty: 'Nefrologia',
    specialties: ['Nefrologia', 'Diálise'],
    crm: '99999-SP',
    image: 'https://api.dicebear.com/7.x/avataaars/png?seed=Renata',
    available: true,
    price: 420,
    slots: ['10:00', '13:00', '17:00'],
    date: 'Hoje',
    additionalInfo: 'Acompanhamento psicológico e psiquiátrico'
  }
];
