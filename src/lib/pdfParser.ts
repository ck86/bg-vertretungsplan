import PDFParser from 'pdf2json';
import { parse } from 'date-fns';
import { de } from 'date-fns/locale';

export interface LessonPlanRow {
    period: string;          // Std.    – lesson period number
    class: string;           // Klass.  – class/form
    originalSubject: string; // (Fach)  – original subject (before change)
    originalTeacher: string; // (Leh..) – original teacher (before change)
    teacher: string;         // Lehrer  – substituting teacher
    subject: string;         // Fach    – substituting subject
    room: string;            // Raum    – room
    type: string;            // Art     – type of substitution
    note: string;            // Text    – additional note
    [key: string]: string;
}

export interface LessonPlanResult {
    date: Date | null;
    rows: LessonPlanRow[];
}

/**
 * Assign a text item to a column based on its x position.
 * Thresholds are midpoints between adjacent column header x-values:
 *   period(0.78) | 2.0 | class(2.85) | 4.0 | originalSubject(5.23) | 7.0 | originalTeacher(8.91) |
 *   10.1 | teacher(11.31) | 12.9 | subject(14.06) | 15.8 | room(17.48) |
 *   19.3 | type(21.16) | 23.3 | note(25.48)
 */
function assignColumn(x: number): keyof LessonPlanRow {
    if (x < 2.0) return 'period';
    if (x < 4.0) return 'class';
    if (x < 7.0) return 'originalSubject';
    if (x < 10.1) return 'originalTeacher';
    if (x < 12.9) return 'teacher';
    if (x < 15.8) return 'subject';
    if (x < 19.3) return 'room';
    if (x < 23.3) return 'type';
    return 'note';
}

/**
 * Group a flat list of items (already within one HLine section) into logical rows
 * by their y-position, using a tolerance to merge sub-line fragments of the same row.
 * Items with y-values within TOLERANCE of each other belong to the same row.
 */
function groupByY(
    items: { x: number; y: number; text: string }[],
    tolerance = 0.3,
): { x: number; text: string }[][] {
    if (items.length === 0) return [];
    const sorted = [...items].sort((a, b) => a.y - b.y);
    const groups: { x: number; text: string }[][] = [];
    let currentGroup: { x: number; text: string }[] = [];
    let currentY = sorted[0].y;

    for (const item of sorted) {
        if (item.y - currentY > tolerance) {
            groups.push(currentGroup);
            currentGroup = [];
            currentY = item.y;
        }
        currentGroup.push({ x: item.x, text: item.text });
    }
    if (currentGroup.length > 0) groups.push(currentGroup);
    return groups;
}

function buildRow(items: { x: number; text: string }[]): LessonPlanRow {
    const rowData: LessonPlanRow = {
        period: '',
        class: '',
        originalSubject: '',
        originalTeacher: '',
        teacher: '',
        subject: '',
        room: '',
        type: '',
        note: '',
    };
    // Sort left-to-right so multi-word cells concatenate in reading order
    const sorted = [...items].sort((a, b) => a.x - b.x);
    for (const item of sorted) {
        const col = assignColumn(item.x);
        rowData[col] = rowData[col] ? rowData[col] + ' ' + item.text : item.text;
    }
    for (const key in rowData) rowData[key] = rowData[key].trim();
    return rowData;
}

/**
 * Normalize raw rows from the PDF parser:
 * - Merge consecutive rows that represent the same substitution but list
 *   additional classes either:
 *   a) as separate rows that only contain a `class` value, or
 *   b) as full duplicate rows differing only in `class`.
 */
export function normalizeLessonPlanRows(rows: LessonPlanRow[]): LessonPlanRow[] {
    const merged: LessonPlanRow[] = [];

    for (const row of rows) {
        const last = merged[merged.length - 1];

        const hasOnlyClass =
            !!row.class &&
            !row.period &&
            !row.originalSubject &&
            !row.originalTeacher &&
            !row.teacher &&
            !row.subject &&
            !row.room &&
            !row.type &&
            !row.note;

        if (last) {
            const isSameSubstitution =
                last.period === row.period &&
                last.originalSubject === row.originalSubject &&
                last.originalTeacher === row.originalTeacher &&
                last.teacher === row.teacher &&
                last.subject === row.subject &&
                last.room === row.room &&
                last.type === row.type &&
                last.note === row.note &&
                last.class !== row.class;

            if (hasOnlyClass || isSameSubstitution) {
                last.class = last.class
                    ? `${last.class}, ${row.class}`
                    : row.class;
                // Ensure we don't end up with a trailing comma after merging
                last.class = last.class.replace(/,\s*$/, '');
                continue;
            }
        }

        // Also normalise trailing commas on standalone rows
        const cleaned = { ...row };
        if (cleaned.class) {
            cleaned.class = cleaned.class.replace(/,\s*$/, '');
        }
        merged.push(cleaned);
    }

    return merged;
}

export async function parseLessonPlanPdf(bufferOrPath: any, password = "schule"): Promise<LessonPlanResult> {
    return new Promise((resolve, reject) => {
        const pdfParser = new PDFParser(null, false, password);

        pdfParser.on("pdfParser_dataError", (errData: any) => reject((errData as any).parserError ?? errData));
        pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
            const parsedRows: LessonPlanRow[] = [];
            let planDate: Date | null = null;

            pdfData.Pages.forEach((page: any) => {
                // Step 1: Collect HLines that span the full table width, sorted by y.
                // These are the bottom borders of table rows/row-groups.
                const hLines: number[] = page.HLines
                    .filter((l: any) => l.l > 30)
                    .map((l: any) => l.y as number)
                    .sort((a: number, b: number) => a - b);

                // Step 2: Collect all text items with their raw positions.
                const textItems: { x: number; y: number; text: string }[] = [];
                page.Texts.forEach((textObj: any) => {
                    textItems.push({
                        x: textObj.x,
                        y: textObj.y,
                        text: decodeURIComponent(textObj.R[0].T),
                    });
                });

                // Step 3: Bucket text items by HLine section.
                // Each item goes into the section whose HLine is the first one strictly below it.
                const sections = new Map<number, { x: number; y: number; text: string }[]>();

                for (const item of textItems) {
                    const sectionLine = hLines.find(ly => ly > item.y) ?? -1;
                    if (!sections.has(sectionLine)) sections.set(sectionLine, []);
                    sections.get(sectionLine)!.push(item);
                }

                // Step 4: Within each section, split into logical rows by y-proximity.
                // This handles two cases:
                //   a) Multi-line cells: fragments at slightly different y merged by tolerance
                //   b) Missing HLines: two adjacent rows sharing a group-boundary HLine
                //      are separated because their y values differ by more than tolerance.
                let inTable = false;

                const sectionKeys = [...sections.keys()].sort((a, b) => a - b);

                for (const sectionKey of sectionKeys) {
                    const sectionItems = sections.get(sectionKey)!;
                    const yGroups = groupByY(sectionItems);

                    for (const group of yGroups) {
                        const rowTextStr = group.map(i => i.text).join(' ');

                        // Detect plan date
                        if (!planDate) {
                            const dateMatch = rowTextStr.match(/Vertretungen:\s*(\d{1,2}\.\d{1,2}\.)\s*\//);
                            if (dateMatch) {
                                planDate = parse(dateMatch[1], 'd.M.', new Date(), { locale: de });
                            }
                        }

                        // Detect table header row
                        if (rowTextStr.includes('Std.') && rowTextStr.includes('Klass.')) {
                            inTable = true;
                            continue;
                        }

                        if (!inTable) continue;

                        const rowData = buildRow(group);

                        // Discard footer rows (abnormally long period value)
                        if (rowData.period.length >= 15) {
                            inTable = false;
                            continue;
                        }

                        // Determine if it's a new row or continuation
                        if (rowData.period || rowData.class) {
                            // Start of a new row
                            parsedRows.push(rowData);
                        } else if (parsedRows.length > 0) {
                            // It's a continuation of the last row
                            const lastRow = parsedRows[parsedRows.length - 1];
                            for (const key of Object.keys(rowData)) {
                                if (rowData[key]) {
                                    lastRow[key] = lastRow[key] ? lastRow[key] + ' ' + rowData[key] : rowData[key];
                                }
                            }
                        }
                    }
                }
            });

            const normalizedRows = normalizeLessonPlanRows(parsedRows);
            resolve({ date: planDate, rows: normalizedRows });
        });

        if (Buffer.isBuffer(bufferOrPath)) {
            pdfParser.parseBuffer(bufferOrPath);
        } else {
            pdfParser.loadPDF(bufferOrPath);
        }
    });
}
