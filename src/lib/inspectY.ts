import { parseLessonPlanPdf } from './pdfParser';
import path from 'path';

async function run() {
    const filePath = path.resolve(__dirname, '../../examples/vplan.pdf');
    const { rows } = await parseLessonPlanPdf(filePath, 'schule');
    console.log(JSON.stringify(rows.slice(20, 28), null, 2));
}
run();
