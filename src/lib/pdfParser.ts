import PDFParser from 'pdf2json';
import { parse } from 'date-fns';
import { de } from 'date-fns/locale';

export interface LessonPlanRow {
    'Std.': string;
    'Klass.': string;
    '(Fach)': string;
    '(Leh..': string;
    'Lehrer': string;
    'Fach': string;
    'Raum': string;
    'Art': string;
    'Text': string;
    [key: string]: string; // to allow dynamic access via for..in loop
}

export interface LessonPlanResult {
    date: Date | null;
    rows: LessonPlanRow[];
}

export async function parseLessonPlanPdf(bufferOrPath: any, password = "schule"): Promise<LessonPlanResult> {
    return new Promise((resolve, reject) => {
        const pdfParser = new PDFParser(null, false, password);

        pdfParser.on("pdfParser_dataError", (errData: any) => reject((errData as any).parserError ?? errData));
        pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
            const parsedRows: LessonPlanRow[] = [];
            let planDate: Date | null = null;

            pdfData.Pages.forEach((page: any) => {
                const rows: Record<number, { x: number, text: string }[]> = {};
                let inTable = false;

                page.Texts.forEach((textObj: any) => {
                    const text = decodeURIComponent(textObj.R[0].T);
                    const y = Math.round(textObj.y * 10) / 10; // group by 0.1 tolerance

                    if (!rows[y]) rows[y] = [];
                    rows[y].push({ x: textObj.x, text });
                });

                Object.keys(rows).sort((a, b) => Number(a) - Number(b)).forEach((yStr) => {
                    const y = Number(yStr);
                    const rowItems = rows[y];

                    const rowTextStr = rowItems.map(i => i.text).join(' ');

                    if (!planDate) {
                        const dateMatch = rowTextStr.match(/Vertretungen:\s*(\d{1,2}\.\d{1,2}\.)\s*\//);
                        if (dateMatch) {
                            // parse date e.g. "10.3."
                            planDate = parse(dateMatch[1], 'd.M.', new Date(), { locale: de });
                        }
                    }

                    if (rowTextStr.includes('Std.') && rowTextStr.includes('Klass.')) {
                        inTable = true;
                        return; // Skip the header itself
                    }

                    if (!inTable) return;

                    const rowData: LessonPlanRow = {
                        'Std.': '',
                        'Klass.': '',
                        '(Fach)': '',
                        '(Leh..': '',
                        'Lehrer': '',
                        'Fach': '',
                        'Raum': '',
                        'Art': '',
                        'Text': ''
                    };

                    rowItems.forEach(item => {
                        if (item.x < 2.5) rowData['Std.'] += item.text;
                        else if (item.x < 5.0) rowData['Klass.'] += item.text;
                        else if (item.x < 8.5) rowData['(Fach)'] += item.text;
                        else if (item.x < 11.0) rowData['(Leh..'] += item.text;
                        else if (item.x < 13.5) rowData['Lehrer'] += item.text;
                        else if (item.x < 17.0) rowData['Fach'] += item.text;
                        else if (item.x < 20.5) rowData['Raum'] += item.text;
                        else if (item.x < 24.5) rowData['Art'] += item.text;
                        else rowData['Text'] += item.text;
                    });

                    // Only push if it has some content, and Std. doesn't look like a long footer string
                    if ((rowData['Std.'].trim() || rowData['Klass.'].trim() || rowData['Lehrer'].trim()) && rowData['Std.'].length < 15) {
                        for (const key in rowData) rowData[key] = rowData[key].trim();
                        parsedRows.push(rowData);
                    } else if (rowData['Std.'].length > 20) {
                        // Likely hit a footer string, disable table parsing for the rest of the page
                        inTable = false;
                    }
                });
            });

            resolve({ date: planDate, rows: parsedRows });
        });

        if (Buffer.isBuffer(bufferOrPath)) {
            pdfParser.parseBuffer(bufferOrPath);
        } else {
            pdfParser.loadPDF(bufferOrPath);
        }
    });
}
