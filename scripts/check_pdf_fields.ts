import { PDFDocument } from 'pdf-lib';
import fs from 'fs';

async function listFields() {
  try {
    const pdfBytes = fs.readFileSync('S-302_T.pdf');
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();
    const fields = form.getFields();
    
    console.log('Fields in S-302_T.pdf:');
    fields.forEach(field => {
      console.log(`- ${field.getName()} (${field.constructor.name})`);
    });
  } catch (error) {
    console.error('Error reading PDF:', error);
  }
}

listFields();
