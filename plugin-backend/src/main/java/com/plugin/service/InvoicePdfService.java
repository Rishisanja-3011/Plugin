package com.plugin.service;

import com.lowagie.text.Document;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.Rectangle;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import com.plugin.entity.Bill;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@Service
public class InvoicePdfService {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("dd MMM yyyy, HH:mm");

    public byte[] generateInvoice(Bill bill) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Document document = new Document(PageSize.A4, 36, 36, 48, 36);
        PdfWriter.getInstance(document, out);
        document.open();

        Font titleFont = new Font(Font.HELVETICA, 18, Font.BOLD);
        Font labelFont = new Font(Font.HELVETICA, 10, Font.BOLD);
        Font valueFont = new Font(Font.HELVETICA, 11, Font.NORMAL);

        Paragraph title = new Paragraph("PLUGIN Charging Invoice", titleFont);
        title.setAlignment(Element.ALIGN_LEFT);
        document.add(title);

        document.add(new Paragraph("Invoice #: " + safe(bill.getInvoiceNumber()), valueFont));
        document.add(new Paragraph("Status: " + safe(bill.getPaymentStatus() != null ? bill.getPaymentStatus().name() : null), valueFont));
        document.add(new Paragraph("Billed On: " + formatDate(bill.getCreatedAt()), valueFont));
        if (bill.getPaidAt() != null) {
            document.add(new Paragraph("Paid On: " + formatDate(bill.getPaidAt()), valueFont));
        }
        document.add(new Paragraph(" "));

        PdfPTable table = new PdfPTable(2);
        table.setWidthPercentage(100f);
        table.setWidths(new float[]{1.2f, 2.3f});
        table.addCell(cell("Customer", labelFont));
        table.addCell(cell(safe(bill.getCustomer().getFullName()), valueFont));
        table.addCell(cell("Email", labelFont));
        table.addCell(cell(safe(bill.getCustomer().getEmail()), valueFont));
        table.addCell(cell("Station", labelFont));
        table.addCell(cell(safe(bill.getStation().getName()), valueFont));
        table.addCell(cell("Session ID", labelFont));
        table.addCell(cell(String.valueOf(bill.getSession().getId()), valueFont));
        table.addCell(cell("Energy (kWh)", labelFont));
        table.addCell(cell(formatNumber(bill.getEnergyKwh()), valueFont));
        table.addCell(cell("Duration (min)", labelFont));
        table.addCell(cell(formatNumber(bill.getDurationMinutes()), valueFont));
        table.addCell(cell("Rate", labelFont));
        table.addCell(cell(formatRate(bill.getRateApplied(), bill.getRateType()), valueFont));
        table.addCell(cell("Total Amount", labelFont));
        table.addCell(cell(formatMoney(bill.getTotalAmount()), valueFont));

        document.add(table);
        document.close();
        return out.toByteArray();
    }

    private PdfPCell cell(String value, Font font) {
        PdfPCell cell = new PdfPCell(new Phrase(value, font));
        cell.setPadding(8f);
        cell.setBorder(Rectangle.BOX);
        cell.setBorderColor(new java.awt.Color(230, 230, 230));
        return cell;
    }

    private String safe(String value) {
        return value == null || value.isBlank() ? "-" : value;
    }

    private String formatDate(LocalDateTime value) {
        return value == null ? "-" : value.format(DATE_FORMAT);
    }

    private String formatMoney(BigDecimal value) {
        return value == null ? "-" : "\u20B9" + value;
    }

    private String formatRate(BigDecimal rate, String rateType) {
        if (rate == null && (rateType == null || rateType.isBlank())) return "-";
        String amount = rate != null ? "\u20B9" + rate : "-";
        return rateType != null && !rateType.isBlank() ? amount + " / " + rateType : amount;
    }

    private String formatNumber(Number value) {
        return value == null ? "-" : value.toString();
    }
}
