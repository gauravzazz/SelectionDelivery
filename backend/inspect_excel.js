const XLSX = require('xlsx');
const path = require('path');
const filePath = path.join(__dirname, '../../shipments_report_2026-02-17_080304.xlsx');
try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    console.log('Columns:', data[0]);
    console.log('First Row (JSON):', JSON.stringify(XLSX.utils.sheet_to_json(sheet)[0]));
} catch (e) {
    console.error('Error reading excel:', e.message);
}
