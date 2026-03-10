import { describe, it, expect } from 'vitest';
import { parseLessonPlanPdf, normalizeLessonPlanRows, type LessonPlanRow } from './pdfParser';
import path from 'path';

describe('PDF Parser', () => {
    it('should parse vplan.pdf correctly', async () => {
        const filePath = path.resolve(__dirname, '../../examples/vplan.pdf');
        const { date, rows } = await parseLessonPlanPdf(filePath, 'schule');

        expect(Array.isArray(rows)).toBe(true);
        expect(rows.length).toBeGreaterThan(0);
        expect(date).toBeInstanceOf(Date);

        // Assert structure and values of the first row
        const firstRow = rows[0];
        expect(firstRow).toHaveProperty('period');
        expect(firstRow).toHaveProperty('class');
        expect(firstRow).toHaveProperty('originalSubject');
        expect(firstRow).toHaveProperty('originalTeacher');
        expect(firstRow).toHaveProperty('teacher');
        expect(firstRow).toHaveProperty('subject');
        expect(firstRow).toHaveProperty('room');
        expect(firstRow).toHaveProperty('type');
        expect(firstRow).toHaveProperty('note');

        expect(firstRow.period).toBe('1');
        expect(firstRow.class).toBe('9/6');
        expect(firstRow.originalTeacher).toBe('amb');
        expect(firstRow.type).toBe('Entfall');

        const twentySecondRow = rows[21];
        expect(twentySecondRow.period).toBe('4');
        expect(twentySecondRow.class).toBe('11');
        expect(twentySecondRow.type).toBe('Vertretung');
        expect(twentySecondRow.note).toBe('VR, Führung durch die Ausstellung');

        const twentySeventhRow = rows[26];
        expect(twentySeventhRow.period).toBe('5');
        expect(twentySeventhRow.class).toBe('10/2');
        expect(twentySeventhRow.type).toBe('Unterricht geändert');
        expect(twentySeventhRow.note).toBe('Führung durch die Ausstellung');
    });

    it('should parse vplan1.pdf correctly', async () => {
        const filePath = path.resolve(__dirname, '../../examples/vplan1.pdf');
        const { date, rows } = await parseLessonPlanPdf(filePath, 'schule');

        expect(Array.isArray(rows)).toBe(true);
        expect(rows.length).toBeGreaterThan(0);
        expect(date).toBeInstanceOf(Date);

        // Ensure a specific row format exists
        const sampleRow = rows.find(r => r.period === '6' && r.class === '7/4');
        expect(sampleRow).toBeDefined();
        if (sampleRow) {
            expect(sampleRow.type).toBe('Vertretung');
        }
    });

    it('should reject if invalid password provided', async () => {
        const filePath = path.resolve(__dirname, '../../examples/vplan.pdf');
        await expect(parseLessonPlanPdf(filePath, 'wrongpass')).rejects.toBeTruthy();
    });

    it('should merge additional classes into a single row', () => {
        const rows: LessonPlanRow[] = [
            {
                period: '1',
                class: '8M',
                originalSubject: 'M',
                originalTeacher: 'MÜL',
                teacher: 'SCH',
                subject: 'M',
                room: '101',
                type: 'Vertretung',
                note: 'Hinweis',
            },
            {
                period: '',
                class: '8/2',
                originalSubject: '',
                originalTeacher: '',
                teacher: '',
                subject: '',
                room: '',
                type: '',
                note: '',
            },
        ];

        const merged = normalizeLessonPlanRows(rows);
        expect(merged).toHaveLength(1);
        expect(merged[0].class).toBe('8M, 8/2');
    });
});
