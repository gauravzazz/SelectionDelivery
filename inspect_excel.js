const XLSX = require('xlsx');
const workbook = XLSX.readFile('/Users/gauravupadhyay/Desktop/Delivery/shipments_report_2026-02-17_080304.xlsx');
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
console.log('Columns:', data[0]);
console.log('First Row:', data[1]);
