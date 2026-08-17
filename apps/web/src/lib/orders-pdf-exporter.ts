import { jsPDF } from 'jspdf';

export interface OrderPDFItem {
  id: string;
  userName?: string;
  email: string;
  item: string;
  amount: number;
  razorpayPaymentId: string;
  status: 'SUCCESS' | 'PENDING' | 'REFUNDED' | 'FAILED' | 'CANCELLED' | string;
  date: string;
  timeFormatted?: string;
  isManual?: boolean;
}

export interface OrdersPDFExportOptions {
  periodLabel: string;
  startDate?: string;
  endDate?: string;
  orders: OrderPDFItem[];
  statusFilter?: string;
}

export async function generateOrdersPDF(options: OrdersPDFExportOptions): Promise<void> {
  const { periodLabel, orders, startDate, endDate } = options;

  // A4 Landscape: 297mm width x 210mm height
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 297
  const pageHeight = doc.internal.pageSize.getHeight(); // 210
  const marginX = 14;
  const marginTop = 14;
  const marginBottom = 16;
  const contentWidth = pageWidth - marginX * 2; // 269mm

  // Summary statistics
  const totalCount = orders.length;
  const successOrders = orders.filter((o) => o.status === 'SUCCESS');
  const pendingOrders = orders.filter((o) => o.status === 'PENDING');
  const refundedOrders = orders.filter((o) => o.status === 'REFUNDED');
  const failedOrders = orders.filter((o) => o.status === 'FAILED' || o.status === 'CANCELLED');
  const totalRevenue = successOrders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);

  let currentY = marginTop;

  const drawPageHeader = (isFirstPage: boolean) => {
    // Top banner strip
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(marginX, currentY, contentWidth, isFirstPage ? 24 : 12, 'F');

    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isFirstPage ? 14 : 10);
    doc.text('PSC TIPS & TRICKS', marginX + 6, currentY + (isFirstPage ? 9 : 7));

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(isFirstPage ? 9 : 8);
    doc.setTextColor(203, 213, 225); // slate-300
    doc.text(
      isFirstPage ? 'Orders & Payment Transactions Statement' : 'Orders Statement (Continued)',
      marginX + 6,
      currentY + (isFirstPage ? 17 : 7),
      { align: isFirstPage ? 'left' : 'left' }
    );

    // Period / Date info on right
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(245, 158, 11); // amber-500
    doc.text(`Period: ${periodLabel}`, pageWidth - marginX - 6, currentY + (isFirstPage ? 9 : 7), { align: 'right' });

    if (isFirstPage) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184); // slate-400
      doc.setFontSize(7.5);
      const generatedAt = new Date().toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
      doc.text(`Generated on: ${generatedAt}`, pageWidth - marginX - 6, currentY + 17, { align: 'right' });
      currentY += 28;
    } else {
      currentY += 16;
    }
  };

  // Draw first page header
  drawPageHeader(true);

  // Summary Metrics KPI Row (Page 1 only)
  const kpiWidth = (contentWidth - 9) / 4; // 4 boxes with 3mm gaps
  const kpiHeight = 16;

  // Box 1: Total Orders
  doc.setFillColor(241, 245, 249); // slate-100
  doc.roundedRect(marginX, currentY, kpiWidth, kpiHeight, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL TRANSACTIONS', marginX + 4, currentY + 5);
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`${totalCount}`, marginX + 4, currentY + 12);

  // Box 2: Total Revenue
  const kpi2X = marginX + kpiWidth + 3;
  doc.setFillColor(236, 253, 245); // emerald-50
  doc.roundedRect(kpi2X, currentY, kpiWidth, kpiHeight, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(5, 150, 105);
  doc.text('PAID REVENUE (SUCCESS)', kpi2X + 4, currentY + 5);
  doc.setFontSize(11);
  doc.setTextColor(6, 95, 70);
  doc.text(`INR ${totalRevenue.toLocaleString('en-IN')}`, kpi2X + 4, currentY + 12);

  // Box 3: Successful Orders
  const kpi3X = kpi2X + kpiWidth + 3;
  doc.setFillColor(240, 253, 250); // teal-50
  doc.roundedRect(kpi3X, currentY, kpiWidth, kpiHeight, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(13, 148, 136);
  doc.text('SUCCESSFUL PAID', kpi3X + 4, currentY + 5);
  doc.setFontSize(11);
  doc.setTextColor(19, 78, 74);
  doc.text(`${successOrders.length}`, kpi3X + 4, currentY + 12);

  // Box 4: Pending / Refunded / Failed
  const kpi4X = kpi3X + kpiWidth + 3;
  doc.setFillColor(254, 242, 242); // rose-50
  doc.roundedRect(kpi4X, currentY, kpiWidth, kpiHeight, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(225, 29, 72);
  doc.text('PENDING / REFUNDED', kpi4X + 4, currentY + 5);
  doc.setFontSize(10);
  doc.setTextColor(159, 18, 57);
  doc.text(
    `${pendingOrders.length} pend · ${refundedOrders.length} ref · ${failedOrders.length} fail`,
    kpi4X + 4,
    currentY + 12
  );

  currentY += kpiHeight + 6;

  // Table Column Definitions
  interface ColDef {
    header: string;
    width: number;
    align: 'left' | 'right' | 'center';
  }

  const columns: ColDef[] = [
    { header: '#', width: 10, align: 'center' },
    { header: 'Order ID', width: 38, align: 'left' },
    { header: 'Customer (Name & Email)', width: 60, align: 'left' },
    { header: 'Item Purchased', width: 56, align: 'left' },
    { header: 'Date & Time', width: 30, align: 'center' },
    { header: 'Amount', width: 22, align: 'right' },
    { header: 'Razorpay / Ref ID', width: 33, align: 'left' },
    { header: 'Status', width: 20, align: 'center' },
  ];

  const drawTableHeader = () => {
    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(marginX, currentY, contentWidth, 7, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(248, 250, 252); // slate-50

    let curX = marginX;
    columns.forEach((col) => {
      let textX = curX + 2;
      if (col.align === 'center') textX = curX + col.width / 2;
      if (col.align === 'right') textX = curX + col.width - 2;

      doc.text(col.header, textX, currentY + 4.8, { align: col.align });
      curX += col.width;
    });

    currentY += 7;
  };

  drawTableHeader();

  // Table Rows
  const rowHeight = 7;

  orders.forEach((order, index) => {
    // Check if we need a new page
    if (currentY + rowHeight > pageHeight - marginBottom) {
      doc.addPage();
      currentY = marginTop;
      drawPageHeader(false);
      drawTableHeader();
    }

    // Alternating row background
    if (index % 2 === 1) {
      doc.setFillColor(248, 250, 252); // slate-50
      doc.rect(marginX, currentY, contentWidth, rowHeight, 'F');
    }

    // Row bottom border
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.15);
    doc.line(marginX, currentY + rowHeight, marginX + contentWidth, currentY + rowHeight);

    let curX = marginX;

    // 1. Index
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(String(index + 1), curX + columns[0].width / 2, currentY + 4.5, { align: 'center' });
    curX += columns[0].width;

    // 2. Order ID
    doc.setFont('courier', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(51, 65, 85);
    const shortId = order.id.length > 20 ? `${order.id.substring(0, 18)}..` : order.id;
    doc.text(shortId, curX + 2, currentY + 4.5);
    curX += columns[1].width;

    // 3. Customer (Name + Email)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(15, 23, 42);
    const custName = order.userName || 'User';
    const shortName = custName.length > 32 ? `${custName.substring(0, 30)}..` : custName;
    doc.text(shortName, curX + 2, currentY + 3.2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(100, 116, 139);
    const shortEmail = order.email.length > 34 ? `${order.email.substring(0, 32)}..` : order.email;
    doc.text(shortEmail, curX + 2, currentY + 5.8);
    curX += columns[2].width;

    // 4. Item Purchased
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(15, 23, 42);
    const shortItem = order.item.length > 34 ? `${order.item.substring(0, 32)}..` : order.item;
    doc.text(shortItem, curX + 2, currentY + 4.5);
    curX += columns[3].width;

    // 5. Date & Time
    doc.setFont('courier', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(71, 85, 105);
    const dateTimeStr = order.timeFormatted ? `${order.date} ${order.timeFormatted}` : order.date || '-';
    doc.text(dateTimeStr, curX + columns[4].width / 2, currentY + 4.5, { align: 'center' });
    curX += columns[4].width;

    // 6. Amount
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    doc.text(`INR ${order.amount}`, curX + columns[5].width - 2, currentY + 4.5, { align: 'right' });
    curX += columns[5].width;

    // 7. Razorpay / Ref ID
    doc.setFont('courier', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(71, 85, 105);
    const shortRef =
      order.razorpayPaymentId.length > 18 ? `${order.razorpayPaymentId.substring(0, 16)}..` : order.razorpayPaymentId;
    doc.text(shortRef, curX + 2, currentY + 4.5);
    curX += columns[6].width;

    // 8. Status Badge
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    const badgeWidth = 17;
    const badgeHeight = 4.2;
    const badgeX = curX + (columns[7].width - badgeWidth) / 2;
    const badgeY = currentY + 1.4;

    if (order.status === 'SUCCESS') {
      doc.setFillColor(209, 250, 229); // emerald-100
      doc.setTextColor(6, 95, 70); // emerald-800
      doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 1, 1, 'F');
      doc.text('SUCCESS', badgeX + badgeWidth / 2, badgeY + 3.1, { align: 'center' });
    } else if (order.status === 'PENDING') {
      doc.setFillColor(254, 243, 199); // amber-100
      doc.setTextColor(146, 64, 14); // amber-800
      doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 1, 1, 'F');
      doc.text('PENDING', badgeX + badgeWidth / 2, badgeY + 3.1, { align: 'center' });
    } else if (order.status === 'REFUNDED') {
      doc.setFillColor(237, 233, 254); // purple-100
      doc.setTextColor(109, 40, 217); // purple-800
      doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 1, 1, 'F');
      doc.text('REFUNDED', badgeX + badgeWidth / 2, badgeY + 3.1, { align: 'center' });
    } else if (order.status === 'CANCELLED') {
      doc.setFillColor(241, 245, 249); // slate-100
      doc.setTextColor(71, 85, 105); // slate-600
      doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 1, 1, 'F');
      doc.text('CANCELLED', badgeX + badgeWidth / 2, badgeY + 3.1, { align: 'center' });
    } else {
      doc.setFillColor(254, 226, 226); // rose-100
      doc.setTextColor(153, 27, 27); // rose-800
      doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 1, 1, 'F');
      doc.text('FAILED', badgeX + badgeWidth / 2, badgeY + 3.1, { align: 'center' });
    }

    currentY += rowHeight;
  });

  // Footer with Page Numbers on all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.line(marginX, pageHeight - 10, marginX + contentWidth, pageHeight - 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text('PSC Tips & Tricks · Confidential Financial & Transaction Summary', marginX, pageHeight - 6);
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - marginX, pageHeight - 6, { align: 'right' });
  }

  // Save the generated PDF
  const cleanDate = (d?: string) => (d ? d.replace(/[^0-9-]/g, '') : '');
  const filename = `PSC_Orders_${cleanDate(startDate) || 'all'}_to_${cleanDate(endDate) || 'current'}.pdf`;
  doc.save(filename);
}
