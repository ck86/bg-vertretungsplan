import { describe, it, expect } from 'vitest';
import { parseLessonPlanPdf } from './pdfParser';
import path from 'path';

describe('PDF Parser', () => {
    it('should parse vplan.pdf correctly', async () => {
        const filePath = path.resolve(__dirname, '../../examples/vplan.pdf');
        const { date, rows } = await parseLessonPlanPdf(filePath, 'schule');

        expect(Array.isArray(rows)).toBe(true);
        expect(rows.length).toBeGreaterThan(0);
        expect(date).toBeInstanceOf(Date);

        // Assert structure of the first row
        const firstRow = rows[0];
        expect(firstRow).toHaveProperty('Std.');
        expect(firstRow).toHaveProperty('Klass.');
        expect(firstRow).toHaveProperty('(Fach)');
        expect(firstRow).toHaveProperty('(Leh..');
        expect(firstRow).toHaveProperty('Lehrer');
        expect(firstRow).toHaveProperty('Fach');
        expect(firstRow).toHaveProperty('Raum');
        expect(firstRow).toHaveProperty('Art');
        expect(firstRow).toHaveProperty('Text');
    });

    it('should parse vplan1.pdf correctly', async () => {
        const filePath = path.resolve(__dirname, '../../examples/vplan1.pdf');
        const { date, rows } = await parseLessonPlanPdf(filePath, 'schule');

        expect(Array.isArray(rows)).toBe(true);
        expect(rows.length).toBeGreaterThan(0);
        expect(date).toBeInstanceOf(Date);

        // Ensure a specific row format exists
        const sampleRow = rows.find(r => r['Std.'] === '6' && r['Klass.'] === '7/4');
        expect(sampleRow).toBeDefined();
        if (sampleRow) {
            expect(sampleRow['Art']).toBe('Vertretung');
        }
    });

    it('should reject if invalid password provided', async () => {
        const filePath = path.resolve(__dirname, '../../examples/vplan.pdf');
        await expect(parseLessonPlanPdf(filePath, 'wrongpass')).rejects.toBeTruthy();
    });
});
