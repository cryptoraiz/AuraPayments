import jsPDF from 'jspdf';

// --- Theme Constants ---
const COLORS = {
    primary: [15, 23, 42],      // Slate-950 (Deep Blue/Black)
    accent: [59, 130, 246],     // Blue-500
    success: [34, 197, 94],     // Green-500
    text: {
        dark: [30, 41, 59],     // Slate-800
        muted: [100, 116, 139], // Slate-500
        light: [255, 255, 255]  // White
    },
    bg: {
        card: [248, 250, 252],  // Slate-50
        border: [226, 232, 240] // Slate-200
    }
};

const drawReceiptOnDoc = (doc, paymentData) => {
    // Helper for centering text
    const centerText = (text, y) => {
        const textWidth = doc.getStringUnitWidth(text) * doc.internal.getFontSize() / doc.internal.scaleFactor;
        const x = (doc.internal.pageSize.width - textWidth) / 2;
        doc.text(text, x, y);
    };

    // Helper for Right Align
    const rightAlignText = (text, y, xParam = 190) => {
        const textWidth = doc.getStringUnitWidth(text) * doc.internal.getFontSize() / doc.internal.scaleFactor;
        doc.text(text, xParam - textWidth, y);
    };

    // === HEADER BACKGROUND ===
    doc.setFillColor(...COLORS.primary);
    doc.rect(0, 0, 210, 60, 'F'); // Taller header for premium feel

    // === LOGO & BRANDING ===
    doc.setTextColor(...COLORS.text.light);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(26);
    doc.text('Arc Invoice', 20, 25);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184); // Slate-400
    doc.text('Professional Payment Protocol', 20, 32);

    // === RECEIPT LABEL (Top Right) ===
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...COLORS.text.light);
    rightAlignText('RECEIPT', 25);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    // Use ID or fallback to truncated timestamp
    const receiptId = paymentData.id ? `#${paymentData.id.slice(0, 8).toUpperCase()}` : `#${Date.now()}`;
    rightAlignText(receiptId, 32);

    // === STATUS PILL ===
    // Center the pill in the header area or below logo? Let's put it on the right side under ID
    const statusText = paymentData.status === 'paid' ? 'CONFIRMED' : 'PENDING';
    const pillColor = paymentData.status === 'paid' ? COLORS.success : [234, 179, 8]; // Green or Yellow

    doc.setFillColor(...pillColor);
    doc.roundedRect(165, 38, 25, 6, 3, 3, 'F');
    doc.setTextColor(...COLORS.text.light);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    // Manual centering for fixed width pill is tricky, simplified alignment:
    doc.text(statusText, 177.5, 42.5, { align: 'center' });

    // === MAIN AMOUNT CARD ===
    // Floating card effect overlapping the header
    doc.setFillColor(...COLORS.text.light);
    doc.setDrawColor(...COLORS.bg.border);
    doc.roundedRect(20, 50, 170, 35, 2, 2, 'FD');

    doc.setTextColor(...COLORS.text.muted);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL PAID', 30, 62);

    doc.setTextColor(...COLORS.accent);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    const sign = paymentData.type === 'sent' ? '-' : '';
    doc.text(`${sign}${paymentData.amount} ${paymentData.currency}`, 30, 75);

    // Date in the card (Right side)
    doc.setTextColor(...COLORS.text.muted);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    rightAlignText('DATE', 62, 180);

    doc.setTextColor(...COLORS.text.dark);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const dateStr = new Date(paymentData.paidAt || Date.now()).toLocaleString('en-US');
    rightAlignText(dateStr, 73, 180);

    // === DETAILS SECTION ===
    let y = 105;

    // Helper to draw a "field row"
    const drawField = (label, value, valueYOffset = 6, isCode = false) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.text.muted);
        doc.text(label.toUpperCase(), 20, y);

        if (isCode) {
            doc.setFont('courier', 'normal');
            doc.setFontSize(9);
        } else {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(11);
        }

        doc.setTextColor(...COLORS.text.dark);
        doc.text(value || 'N/A', 20, y + valueYOffset);

        // Return next Y
        return y + 18;
    };

    // Sender
    y = drawField('From (Payer)', paymentData.payer || 'Unknown', 6, true);

    // Recipient
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.text.muted);
    doc.text('TO (Recipient)', 20, y);

    doc.setFont('helvetica', 'bold'); // Name Bold
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.text.dark);
    doc.text(paymentData.recipientName || 'N/A', 20, y + 6);

    doc.setFont('courier', 'normal'); // Wallet Code below name
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.text.muted); // Slightly lighter for wallet
    doc.text(paymentData.recipientWallet || 'N/A', 20, y + 11);
    y += 22;

    // Description
    if (paymentData.description) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.text.muted);
        doc.text('DESCRIPTION', 20, y);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(...COLORS.text.dark);

        const descriptionLines = doc.splitTextToSize(paymentData.description, 170);
        doc.text(descriptionLines, 20, y + 6);
        y += (descriptionLines.length * 5) + 12;
    }

    // Divider
    doc.setDrawColor(...COLORS.bg.border);
    doc.line(20, y, 190, y);
    y += 10;

    // Hash Logic
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.text.muted);
    doc.text('TRANSACTION ID (HASH)', 20, y);

    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.text.dark);
    doc.text(paymentData.txHash || 'N/A', 20, y + 6);
    y += 15;

    // Link
    if (paymentData.txHash) {
        doc.setTextColor(...COLORS.accent);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.textWithLink('View on ArcScan ->', 20, y, {
            url: `https://testnet.arcscan.app/tx/${paymentData.txHash}`
        });
    }

    // === FOOTER BRANDING ===
    const pageHeight = doc.internal.pageSize.height;

    // Background Footer
    doc.setFillColor(...COLORS.bg.card);
    doc.rect(0, pageHeight - 20, 210, 20, 'F');
    doc.setDrawColor(...COLORS.bg.border);
    doc.line(0, pageHeight - 20, 210, pageHeight - 20);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.text.muted);
    centerText('Generated via Arc Invoice - The new era of payments.', pageHeight - 8);
};

/**
 * Generate a single payment receipt
 */
export const generatePaymentReceipt = (paymentData) => {
    const doc = new jsPDF();
    drawReceiptOnDoc(doc, paymentData);
    const filename = `ArcReceipt_${paymentData.id ? paymentData.id.slice(0, 8) : 'New'}.pdf`;
    doc.save(filename);
};

/**
 * Generate a batch PDF with multiple receipts (one per page)
 */
export const generateBatchReceipts = (paymentsArray, walletAddress) => {
    if (!paymentsArray || paymentsArray.length === 0) return;

    const doc = new jsPDF();

    // COVER PAGE
    doc.setFillColor(...COLORS.primary);
    doc.rect(0, 0, 210, 297, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(36);
    doc.text('Complete Report', 105, 120, { align: 'center' });

    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(`Wallet: ${walletAddress}`, 105, 135, { align: 'center' });
    doc.text(`${paymentsArray.length} Recorded Transactions`, 105, 145, { align: 'center' });

    doc.setFontSize(10);
    doc.text(`Generated at: ${new Date().toLocaleString('en-US')}`, 105, 270, { align: 'center' });

    // PAGES
    paymentsArray.forEach((item) => {
        doc.addPage();
        drawReceiptOnDoc(doc, item);
    });

    const filename = `ArcBackup_${Date.now()}.pdf`;
    doc.save(filename);
};
