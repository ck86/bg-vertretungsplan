import PDFParser from 'pdf2json';
import fs from 'fs';

const pdfParser = new PDFParser();

pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError));
pdfParser.on("pdfParser_dataReady", pdfData => {
    fs.writeFileSync("examples/vplan.json", JSON.stringify(pdfData, null, 2));
    console.log("Wrote vplan.json with", pdfData.formImage.Pages[0].Texts.length, "text elements on page 1");
});

pdfParser.loadPDF("examples/vplan.pdf");
