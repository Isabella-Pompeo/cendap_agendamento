
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

export const mockDoctors: Doctor[] = [
  {
    id: '1',
    name: 'Dr. Ricardo Silva',
    specialty: 'Cardiologia',
    crm: '12345-SP',
    image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ricardo',
    available: true,
    price: 350,
    slots: ['09:00', '10:30', '14:00', '16:00']
  },
  {
    id: '2',
    name: 'Dra. Fernanda Oliveira',
    specialty: 'Dermatologia',
    crm: '67890-SP',
    image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Fernanda',
    available: true,
    price: 300,
    slots: ['08:00', '11:00', '13:30', '15:00', '17:00']
  },
  {
    id: '3',
    name: 'Dr. Lucas Souza',
    specialty: 'Ortopedia',
    crm: '11223-SP',
    image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Lucas',
    available: false, // Indisponível para teste visual
    price: 400,
    slots: []
  },
  {
    id: '4',
    name: 'Dra. Camila Santos',
    specialty: 'Pediatria',
    crm: '44556-SP',
    image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Camila',
    available: true,
    price: 280,
    slots: ['09:15', '10:45', '14:30']
  },
  {
    id: '5',
    name: 'Dra. Julianne Moore',
    specialty: 'Neurologia',
    crm: '99887-SP',
    image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Julianne',
    available: true,
    price: 500,
    slots: ['10:00', '11:30', '15:00', '16:30']
  }
];
