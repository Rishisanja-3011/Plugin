package com.plugin.service;

import com.lowagie.text.Document;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.Image;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.Rectangle;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import com.plugin.entity.Bill;
import com.plugin.entity.Station;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.util.StreamUtils;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

@Service
public class InvoicePdfService {

    private static final DateTimeFormatter HEADER_DATE_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy", Locale.ENGLISH);
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("dd MMM yyyy", Locale.ENGLISH);
    private static final DateTimeFormatter TIME_FORMAT = DateTimeFormatter.ofPattern("hh:mm a", Locale.ENGLISH);
    private static final java.awt.Color INK_BLACK = new java.awt.Color(18, 18, 18);
    private static final java.awt.Color TEXT_DARK = new java.awt.Color(35, 35, 35);
    private static final java.awt.Color TEXT_MUTED = new java.awt.Color(90, 90, 90);
    private static final java.awt.Color ROW_BORDER = new java.awt.Color(210, 210, 210);
    private static final java.awt.Color BORDER_GRAY = new java.awt.Color(222, 226, 230);
    private static final String PAYMENT_METHOD = "UPI";
    private static final String SUPPORT_EMAIL = "plugin.onservice@gmail.com";
    private static final String SUPPORT_PHONE = "+91 8200203790";

    public byte[] generateInvoice(Bill bill) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Document document = new Document(PageSize.A4, 36, 36, 42, 36);
        PdfWriter.getInstance(document, out);
        document.open();

        Font headerTitleFont = new Font(Font.HELVETICA, 16, Font.BOLD, INK_BLACK);
        Font subValueFont = new Font(Font.HELVETICA, 10, Font.NORMAL, TEXT_DARK);
        Font blockTitleFont = new Font(Font.HELVETICA, 10, Font.BOLD, INK_BLACK);
        Font blockValueFont = new Font(Font.HELVETICA, 10, Font.NORMAL, TEXT_DARK);
        Font sectionTitleFont = new Font(Font.HELVETICA, 10, Font.BOLD, java.awt.Color.WHITE);
        Font detailLabelFont = new Font(Font.HELVETICA, 10, Font.BOLD, INK_BLACK);
        Font detailValueFont = new Font(Font.HELVETICA, 10, Font.NORMAL, TEXT_DARK);
        Font totalValueFont = new Font(Font.HELVETICA, 10, Font.BOLD, INK_BLACK);
        Font footerFont = new Font(Font.HELVETICA, 10, Font.NORMAL, TEXT_MUTED);
        Font supportTitleFont = new Font(Font.HELVETICA, 10, Font.BOLD, INK_BLACK);
        Font supportValueFont = new Font(Font.HELVETICA, 10, Font.NORMAL, TEXT_DARK);

        addHeader(document, bill, headerTitleFont, subValueFont);
        addSpacer(document, 10f);
        addBillToAndStationBlock(document, bill, blockTitleFont, blockValueFont);
        addSpacer(document, 12f);
        addSectionTitle(document, "CHARGING SESSION DETAILS", sectionTitleFont);
        addSessionDetailsTable(document, bill, detailLabelFont, detailValueFont, totalValueFont);
        addSpacer(document, 16f);
        addThankYouSection(document, footerFont);
        addSpacer(document, 12f);
        addSupportFooter(document, supportTitleFont, supportValueFont);

        document.close();
        return out.toByteArray();
    }

    private void addHeader(Document document, Bill bill, Font titleFont, Font valueFont) {
        PdfPTable headerTable = new PdfPTable(new float[]{1.4f, 1.6f});
        headerTable.setWidthPercentage(100f);

        PdfPCell left = new PdfPCell();
        left.setBorder(Rectangle.NO_BORDER);
        left.setVerticalAlignment(Element.ALIGN_TOP);
        Image logo = loadLogoImage();
        if (logo != null) {
            left.addElement(logo);
        } else {
            left.addElement(new Paragraph("PLUGIN", titleFont));
        }

        PdfPCell right = new PdfPCell();
        right.setBorder(Rectangle.NO_BORDER);
        right.setHorizontalAlignment(Element.ALIGN_RIGHT);
        right.setVerticalAlignment(Element.ALIGN_TOP);
        Paragraph title = new Paragraph("Payment Confirmation", titleFont);
        title.setAlignment(Element.ALIGN_RIGHT);
        right.addElement(title);
        right.addElement(new Paragraph("Invoice Number: " + safe(bill.getInvoiceNumber()), valueFont));
        right.addElement(new Paragraph("Date: " + formatHeaderDate(resolveReferenceDateTime(bill)), valueFont));

        headerTable.addCell(left);
        headerTable.addCell(right);
        document.add(headerTable);
    }

    private void addBillToAndStationBlock(Document document, Bill bill, Font titleFont, Font valueFont) {
        PdfPTable infoTable = new PdfPTable(new float[]{1f, 1f});
        infoTable.setWidthPercentage(100f);

        PdfPCell billedTo = new PdfPCell();
        billedTo.setBorder(Rectangle.NO_BORDER);
        billedTo.setPadding(2f);
        billedTo.setVerticalAlignment(Element.ALIGN_TOP);
        billedTo.addElement(new Paragraph("Billed To:", titleFont));
        billedTo.addElement(new Paragraph(safe(bill.getCustomer() != null ? bill.getCustomer().getFullName() : null), valueFont));
        billedTo.addElement(new Paragraph(safe(bill.getCustomer() != null ? bill.getCustomer().getEmail() : null), valueFont));

        PdfPCell station = new PdfPCell();
        station.setBorder(Rectangle.NO_BORDER);
        station.setPadding(2f);
        station.setVerticalAlignment(Element.ALIGN_TOP);
        station.addElement(new Paragraph("Station Location:", titleFont));
        station.addElement(new Paragraph(buildStationLocation(bill.getStation()), valueFont));

        infoTable.addCell(billedTo);
        infoTable.addCell(station);
        document.add(infoTable);
    }

    private void addSectionTitle(Document document, String text, Font font) {
        PdfPTable section = new PdfPTable(1);
        section.setWidthPercentage(100f);
        PdfPCell cell = new PdfPCell(new Phrase(text, font));
        cell.setHorizontalAlignment(Element.ALIGN_CENTER);
        cell.setBackgroundColor(INK_BLACK);
        cell.setBorder(Rectangle.NO_BORDER);
        cell.setPadding(7f);
        section.addCell(cell);
        document.add(section);
    }

    private void addSessionDetailsTable(Document document, Bill bill, Font labelFont, Font valueFont, Font totalValueFont) {
        PdfPTable table = new PdfPTable(new float[]{1.5f, 2.2f});
        table.setWidthPercentage(100f);

        addDetailRow(table, "Session ID:", formatSessionId(bill), labelFont, valueFont, false);
        addDetailRow(table, "Charging Date & Time:", formatChargingDateTime(bill), labelFont, valueFont, false);
        addDetailRow(table, "Energy Consumed:", formatEnergy(bill.getEnergyKwh()), labelFont, valueFont, false);
        addDetailRow(table, "Duration (min):", formatNumber(bill.getDurationMinutes()), labelFont, valueFont, false);
        addDetailRow(table, "Rate:", formatRate(bill.getRateApplied(), bill.getRateType()), labelFont, valueFont, false);
        addDetailRow(table, "Payment Method:", PAYMENT_METHOD, labelFont, valueFont, false);
        addDetailRow(table, "Amount Paid:", formatMoney(bill.getTotalAmount()), labelFont, totalValueFont, true);

        document.add(table);
    }

    private void addDetailRow(
            PdfPTable table,
            String label,
            String value,
            Font labelFont,
            Font valueFont,
            boolean emphasize
    ) {
        PdfPCell left = new PdfPCell(new Phrase(label, labelFont));
        left.setPadding(6.5f);
        left.setBorder(Rectangle.BOTTOM);
        left.setBorderColor(ROW_BORDER);
        left.setVerticalAlignment(Element.ALIGN_MIDDLE);
        if (emphasize) {
            left.setBorderWidthBottom(1.25f);
        }
        table.addCell(left);

        PdfPCell right = new PdfPCell(new Phrase(value, valueFont));
        right.setPadding(6.5f);
        right.setBorder(Rectangle.BOTTOM);
        right.setBorderColor(ROW_BORDER);
        right.setVerticalAlignment(Element.ALIGN_MIDDLE);
        if (emphasize) {
            right.setBorderWidthBottom(1.25f);
        }
        table.addCell(right);
    }

    private void addThankYouSection(Document document, Font font) {
        PdfPTable thanks = new PdfPTable(new float[]{1.2f, 1.6f, 1.2f});
        thanks.setWidthPercentage(100f);

        PdfPCell left = new PdfPCell();
        left.setBorder(Rectangle.TOP);
        left.setBorderColor(BORDER_GRAY);
        left.setFixedHeight(14f);

        PdfPCell center = new PdfPCell(new Phrase("Thank You for using PLUGIN", font));
        center.setHorizontalAlignment(Element.ALIGN_CENTER);
        center.setBorder(Rectangle.NO_BORDER);
        center.setPaddingTop(1f);

        PdfPCell right = new PdfPCell();
        right.setBorder(Rectangle.TOP);
        right.setBorderColor(BORDER_GRAY);
        right.setFixedHeight(14f);

        thanks.addCell(left);
        thanks.addCell(center);
        thanks.addCell(right);
        document.add(thanks);
    }

    private void addSupportFooter(Document document, Font titleFont, Font valueFont) {
        PdfPTable footer = new PdfPTable(1);
        footer.setWidthPercentage(100f);

        PdfPCell support = new PdfPCell();
        support.setBorder(Rectangle.NO_BORDER);
        support.setPadding(2f);
        support.addElement(new Paragraph("Customer Support", titleFont));
        support.addElement(new Paragraph(SUPPORT_EMAIL, valueFont));
        support.addElement(new Paragraph(SUPPORT_PHONE, valueFont));

        footer.addCell(support);
        document.add(footer);
    }

    private void addSpacer(Document document, float spacing) {
        Paragraph spacer = new Paragraph(" ");
        spacer.setSpacingBefore(spacing);
        document.add(spacer);
    }

    private Image loadLogoImage() {
        try (InputStream input = new ClassPathResource("static/brand-logo.png").getInputStream()) {
            byte[] bytes = StreamUtils.copyToByteArray(input);
            Image logo = Image.getInstance(bytes);
            logo.scaleToFit(210f, 52f);
            logo.setAlignment(Element.ALIGN_LEFT);
            return logo;
        } catch (Exception ignored) {
            return null;
        }
    }

    private String safe(String value) {
        return value == null || value.isBlank() ? "-" : value;
    }

    private String formatDate(LocalDateTime value) {
        return value == null ? "-" : value.format(DATE_FORMAT) + ", " + value.format(TIME_FORMAT);
    }

    private String formatHeaderDate(LocalDateTime value) {
        return value == null ? "-" : value.format(HEADER_DATE_FORMAT);
    }

    private String formatMoney(BigDecimal value) {
        return value == null ? "-" : "\u20B9" + value.setScale(2, RoundingMode.HALF_UP).toPlainString();
    }

    private String formatRate(BigDecimal rate, String rateType) {
        if (rate == null && (rateType == null || rateType.isBlank())) return "-";
        String amount = rate != null ? "\u20B9" + rate.setScale(2, RoundingMode.HALF_UP).toPlainString() : "-";
        return rateType != null && !rateType.isBlank() ? amount + " / " + rateType : amount;
    }

    private String formatNumber(Number value) {
        return value == null ? "-" : value.toString();
    }

    private String formatSessionId(Bill bill) {
        if (bill.getSession() == null || bill.getSession().getId() == null) return "-";
        return String.valueOf(bill.getSession().getId());
    }

    private String formatEnergy(BigDecimal energy) {
        if (energy == null) return "-";
        return energy.setScale(2, RoundingMode.HALF_UP).toPlainString() + " kWh";
    }

    private String formatChargingDateTime(Bill bill) {
        if (bill.getSession() == null) return "-";
        LocalDateTime start = bill.getSession().getStartTime();
        LocalDateTime end = bill.getSession().getEndTime();

        if (start == null && end == null) return "-";
        if (start == null) return formatDate(end);
        if (end == null) return formatDate(start);

        String date = start.format(DATE_FORMAT);
        String startTime = start.format(TIME_FORMAT);
        String endTime = end.format(TIME_FORMAT);
        return date + ", " + startTime + " - " + endTime;
    }

    private LocalDateTime resolveReferenceDateTime(Bill bill) {
        if (bill.getPaidAt() != null) return bill.getPaidAt();
        if (bill.getCreatedAt() != null) return bill.getCreatedAt();
        if (bill.getSession() != null && bill.getSession().getEndTime() != null) return bill.getSession().getEndTime();
        if (bill.getSession() != null && bill.getSession().getStartTime() != null) return bill.getSession().getStartTime();
        return null;
    }

    private String buildStationLocation(Station station) {
        if (station == null) return "-";
        String name = safe(station.getName());
        String address = safe(station.getAddress());
        if (!"-".equals(name) && !"-".equals(address)) return name + " / " + address;
        if (!"-".equals(name)) return name;
        if (!"-".equals(address)) return address;
        return "-";
    }
}
