// Admin report downloads (PDF and Excel). The two libraries load only when an
// admin asks for a file, so they never slow down the normal app.
import type { SheetData } from 'write-excel-file/browser';
import { getAdminSummary, getRides, rideFare, type AdminSummary, type ApiRide } from './api';

export interface AdminReport {
  generatedAt: Date;
  summary: AdminSummary;
  rides: ApiRide[];
}

const TOWNS = 'Carrascal · Cantilan · Madrid · Carmen · Lanuza';
const BRAND_ORANGE = '#BF531A';
const BRAND_ORANGE_RGB: [number, number, number] = [191, 83, 26];

export async function loadAdminReport(): Promise<AdminReport> {
  const [summary, rides] = await Promise.all([getAdminSummary(), getRides()]);
  return { generatedAt: new Date(), summary, rides };
}

function fileStamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function generatedLabel(date: Date): string {
  return date.toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' });
}

function statusLabel(status: string): string {
  const words = status.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// MySQL gives "2026-11-09 20:50:27"; drop the seconds for the report.
function rideTime(value: string): string {
  return value ? value.slice(0, 16) : '';
}

function overviewRows(summary: AdminSummary): [string, number][] {
  return [
    ['Total drivers', summary.total_drivers],
    ['Total passengers', summary.total_passengers],
    ['Active bookings', summary.active_rides],
    ['Completed today', summary.completed_today],
  ];
}

function statusRows(summary: AdminSummary): [string, number][] {
  return [
    ['Completed', summary.status_today.completed],
    ['Cancelled', summary.status_today.cancelled],
    ['In progress', summary.status_today.in_progress],
  ];
}

function rideFareValue(ride: ApiRide): number | null {
  const fare = rideFare(ride);
  return fare === null ? null : Number(fare);
}

export async function downloadReportPdf(report: AdminReport): Promise<void> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  const lastY = () => (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? margin;
  const heading = (text: string, y: number, x = margin) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(30, 26, 23);
    doc.text(text, x, y);
  };
  const tableStyle = {
    theme: 'grid' as const,
    styles: { font: 'helvetica', fontSize: 10, cellPadding: 6, lineColor: [236, 230, 224] as [number, number, number], textColor: [30, 26, 23] as [number, number, number] },
    headStyles: { fillColor: BRAND_ORANGE_RGB, textColor: [255, 255, 255] as [number, number, number], fontStyle: 'bold' as const },
    alternateRowStyles: { fillColor: [255, 244, 236] as [number, number, number] },
    margin: { left: margin, right: margin },
  };

  // Title band
  doc.setFillColor(...BRAND_ORANGE_RGB);
  doc.rect(0, 0, pageWidth, 72, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('PASAKJA admin report', margin, 34);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(TOWNS, margin, 54);
  doc.text(`Generated ${generatedLabel(report.generatedAt)}`, pageWidth - margin, 54, { align: 'right' });

  // Overview and today's statuses side by side
  const columnWidth = (pageWidth - margin * 2 - 24) / 2;
  const rightColumn = margin + columnWidth + 24;
  heading('Overview', 104);
  autoTable(doc, { ...tableStyle, startY: 114, head: [['Measure', 'Count']], body: overviewRows(report.summary), tableWidth: columnWidth, columnStyles: { 1: { halign: 'right' } } });
  const overviewEnd = lastY();
  heading('Booking status today', 104, rightColumn);
  autoTable(doc, { ...tableStyle, startY: 114, head: [['Status', 'Rides']], body: statusRows(report.summary), tableWidth: columnWidth, margin: { left: rightColumn, right: margin }, columnStyles: { 1: { halign: 'right' } } });
  let y = Math.max(overviewEnd, lastY()) + 32;

  heading('Rides in the last 7 days by town', y);
  const towns = report.summary.by_municipality;
  autoTable(doc, {
    ...tableStyle,
    startY: y + 10,
    head: [['Town', 'Rides', 'Drivers']],
    body: towns.length ? towns.map(town => [town.name, town.rides, town.drivers]) : [['No rides in the last 7 days', '', '']],
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
  });
  y = lastY() + 32;

  heading(`Latest rides (${report.rides.length})`, y);
  autoTable(doc, {
    ...tableStyle,
    startY: y + 10,
    styles: { ...tableStyle.styles, fontSize: 9, cellPadding: 5 },
    head: [['ID', 'Requested', 'Town', 'Passenger', 'Driver', 'Pickup', 'Destination', 'Status', 'Fare (PHP)']],
    body: report.rides.length
      ? report.rides.map(ride => {
        const fare = rideFareValue(ride);
        return [ride.id, rideTime(ride.requested_at), ride.municipality, ride.passenger_name || '', ride.driver_name || 'Unassigned', ride.pickup_label, ride.destination_label, statusLabel(ride.status), fare === null ? '' : fare.toFixed(2)];
      })
      : [['', 'No rides yet', '', '', '', '', '', '', '']],
    columnStyles: { 0: { halign: 'right', cellWidth: 32 }, 1: { cellWidth: 84 }, 8: { halign: 'right', cellWidth: 60 } },
  });

  // Page numbers
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(107, 98, 91);
    doc.text(`PASAKJA · Page ${page} of ${pages}`, pageWidth - margin, doc.internal.pageSize.getHeight() - 20, { align: 'right' });
  }

  doc.save(`pasakja-report-${fileStamp(report.generatedAt)}.pdf`);
}

export async function downloadReportExcel(report: AdminReport): Promise<void> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const header = (value: string) => ({ value, fontWeight: 'bold' as const, textColor: '#FFFFFF', backgroundColor: BRAND_ORANGE });
  const section = (value: string) => [{ value, fontWeight: 'bold' as const, fontSize: 12 }];

  const summary: SheetData = [
    [{ value: 'PASAKJA admin report', fontWeight: 'bold', fontSize: 16 }],
    [TOWNS],
    [`Generated ${generatedLabel(report.generatedAt)}`],
    [],
    section('Overview'),
    [header('Measure'), header('Count')],
    ...overviewRows(report.summary),
    [],
    section('Booking status today'),
    [header('Status'), header('Rides')],
    ...statusRows(report.summary),
    [],
    section('Rides in the last 7 days by town'),
    [header('Town'), header('Rides'), header('Drivers')],
    ...(report.summary.by_municipality.length
      ? report.summary.by_municipality.map(town => [town.name, town.rides, town.drivers])
      : [['No rides in the last 7 days']]),
  ];

  const rides: SheetData = [
    ['ID', 'Requested', 'Town', 'Passenger', 'Driver', 'Pickup', 'Destination', 'Status', 'Fare'].map(header),
    ...report.rides.map(ride => {
      const fare = rideFareValue(ride);
      return [
        ride.id,
        rideTime(ride.requested_at),
        ride.municipality,
        ride.passenger_name || '',
        ride.driver_name || 'Unassigned',
        ride.pickup_label,
        ride.destination_label,
        statusLabel(ride.status),
        fare === null ? null : { value: fare, format: '"₱"#,##0.00' },
      ];
    }),
  ];

  await writeXlsxFile([
    { sheet: 'Summary', data: summary, columns: [{ width: 34 }, { width: 14 }, { width: 14 }] },
    { sheet: 'Rides', data: rides, stickyRowsCount: 1, columns: [{ width: 8 }, { width: 18 }, { width: 14 }, { width: 22 }, { width: 22 }, { width: 32 }, { width: 32 }, { width: 14 }, { width: 12 }] },
  ]).toFile(`pasakja-report-${fileStamp(report.generatedAt)}.xlsx`);
}
