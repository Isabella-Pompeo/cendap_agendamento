
// Mock of the logic in SchedulingModal.tsx

function extractSpecificDates(text: string): string[] {
    const dateRegex = /\d{1,2}\/\d{1,2}\/\d{4}/g;
    const matches = text.match(dateRegex);
    if (!matches) return [];

    return matches.map(date => {
        const [day, month, year] = date.split('/');
        return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
    });
}

function isDateAvailableForDoctor(date: Date, doctor: any): boolean {
    const day = date.getDay(); // 0 = Domingo, 6 = Sábado
    const isWeekend = day === 0 || day === 6;

    if (!doctor) return false;

    const dateStr = (doctor.date || '').toLowerCase();

    // 1. Prioridade: Datas Específicas
    const specificDates = extractSpecificDates(doctor.date || '');
    if (specificDates.length > 0) {
        const dayNum = String(date.getDate()).padStart(2, '0');
        const monthNum = String(date.getMonth() + 1).padStart(2, '0');
        const yearNum = date.getFullYear();
        const currentDataStr = `${dayNum}/${monthNum}/${yearNum}`;

        console.log(`Checking ${currentDataStr} against specific dates:`, specificDates);
        return specificDates.includes(currentDataStr);
    }

    // 2. Lógica de Dias da Semana
    if (dateStr.includes('segunda') || dateStr.includes('sexta')) {
        console.log('Using weekday logic for:', dateStr);
        if (isWeekend) {
            return false;
        }
        return true;
    }

    return false;
}

// Test Cases
const today = new Date('2026-02-10T12:00:00'); // Tuesday
const nextMonday = new Date('2026-02-16T12:00:00'); // Monday

// Case 1: Specific Date Only
const docSpecific = { date: '10/02/2026' };
console.log('Case 1 (Specific Match):', isDateAvailableForDoctor(today, docSpecific)); // Should be true

// Case 2: Specific Date Mismatch
const docSpecificMismatch = { date: '11/02/2026' };
console.log('Case 2 (Specific Mismatch):', isDateAvailableForDoctor(today, docSpecificMismatch)); // Should be false

// Case 3: Mixed (Weekday + Specific) - The Hypothesized Bug
const docMixed = { date: 'Segunda, 10/02/2026' };
// 10/02/2026 is a Tuesday. 'Segunda' means Monday. 
// If specific date is present, it extracts '10/02/2026'.
// Since today is 10/02, it should return true based on specific date.
console.log('Case 3 (Mixed Match Specific):', isDateAvailableForDoctor(today, docMixed));

const docMixed2 = { date: 'Segunda, 15/02/2026' };
// 15/02/2026 is a Sunday. 
// nextMonday is 16/02/2026.
// 'Segunda' is in string. Specific date '15/02/2026' is in string.
// Logic: specificDates = ['15/02/2026'].
// Checking nextMonday (16/02): specificDates includes 16/02? No. Returns false.
// Expected: If it supports mixed, it should fall through or combine? 
// Current logic RETURNs if specificDates > 0. So it ignores "Segunda".
console.log('Case 4 (Mixed Match Weekday - Fail expected):', isDateAvailableForDoctor(nextMonday, docMixed2)); 
