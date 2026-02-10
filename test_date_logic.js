
// Mock of the logic in SchedulingModal.tsx with the FIXED logic

function extractSpecificDates(text) {
    const dateRegex = /\d{1,2}\/\d{1,2}\/\d{4}/g;
    const matches = text.match(dateRegex);
    if (!matches) return [];

    return matches.map(date => {
        const [day, month, year] = date.split('/');
        return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
    });
}

function isDateAvailableForDoctor(date, doctor) {
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

        console.log(`Checking ${currentDataStr} against specific dates: ${specificDates}`);
        if (specificDates.includes(currentDataStr)) {
            return true;
        }
        // FIX: Removed 'return false' else block. Letting it fall through.
    }

    // 2. Lógica de Dias da Semana
    if (dateStr.includes('segunda') || dateStr.includes('sexta')) {
        console.log(`Using weekday logic for: ${dateStr}`);
        if (isWeekend) {
            // Check for specific weekend override? Not in this simplified version.
            // But logic says: if weekend, return false (unless explicitly handled).
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
console.log('Case 1 (Specific Match):', isDateAvailableForDoctor(today, docSpecific));

// Case 2: Specific Date Mismatch (Should fall through and fail if no weekdays)
const docSpecificMismatch = { date: '11/02/2026' };
console.log('Case 2 (Specific Mismatch):', isDateAvailableForDoctor(today, docSpecificMismatch));

// Case 3: Mixed (Weekday + Specific) - The Hypothesized Bug FIXED
const docMixed = { date: 'Segunda, 10/02/2026 e 24/02/2026' };
// If specific date is present, it extracts '10/02/2026' and '24/02/2026'.
// Since today is 10/02, it should return true.
console.log('Case 3 (Mixed Match Specific):', isDateAvailableForDoctor(today, docMixed));

const docMixed2 = { date: 'Segunda e 15/02/2026' };
// 15/02/2026 is a Sunday. 
// nextMonday is 16/02/2026 (Segunda).
// Logic: specificDates = ['15/02/2026'].
// Checking nextMonday (16/02): specificDates includes 16/02? No. 
// NOW: Falls through to logic 2.
// 'Segunda' is in text. 16/02 is Monday (not weekend). Returns TRUE.
console.log('Case 4 (Mixed Match Weekday - Should PASS now):', isDateAvailableForDoctor(nextMonday, docMixed2)); 
