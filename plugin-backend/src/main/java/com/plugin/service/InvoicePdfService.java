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
import com.plugin.enums.PaymentStatus;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.util.StreamUtils;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
public class InvoicePdfService {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("dd MMM yyyy", Locale.ENGLISH);
    private static final DateTimeFormatter TIME_FORMAT = DateTimeFormatter.ofPattern("HH:mm", Locale.ENGLISH);
    private static final java.awt.Color TEXT_DARK = new java.awt.Color(26, 26, 26);
    private static final java.awt.Color TEXT_MUTED = new java.awt.Color(90, 90, 90);
    private static final java.awt.Color BORDER_LIGHT = new java.awt.Color(210, 210, 210);
    private static final java.awt.Color BORDER_DARK = new java.awt.Color(45, 45, 45);
    private static final String PAYMENT_METHOD = "UPI";
    private static final String TRANSACTION_ID = "-";
    private static final String WEBSITE_URL = "www.plugin.com";
    private static final String SUPPORT_EMAIL = "plugin.onservice@gmail.com";

    public byte[] generateInvoice(Bill bill) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Document document = new Document(PageSize.A4, 28, 28, 24, 24);
        PdfWriter.getInstance(document, out);
        document.open();

        Font title = new Font(Font.HELVETICA, 13, Font.BOLD, TEXT_DARK);
        Font body = new Font(Font.HELVETICA, 9, Font.NORMAL, TEXT_DARK);
        Font bodyBold = new Font(Font.HELVETICA, 9, Font.BOLD, TEXT_DARK);
        Font muted = new Font(Font.HELVETICA, 9, Font.NORMAL, TEXT_MUTED);
        Font tableHeader = new Font(Font.HELVETICA, 10, Font.BOLD, TEXT_DARK);
        Font totalText = new Font(Font.HELVETICA, 10, Font.BOLD, TEXT_DARK);
        Font totalBar = new Font(Font.HELVETICA, 11, Font.BOLD, java.awt.Color.WHITE);

        addLogo(document);
        addSpacer(document, 2f);
        addDivider(document);
        addSpacer(document, 4f);

        addTopInfo(document, bill, body, bodyBold);
        addSpacer(document, 3f);
        addDivider(document);
        addSpacer(document, 4f);

        addCustomerSession(document, bill, body, bodyBold);
        addSpacer(document, 3f);
        addDivider(document);
        addSpacer(document, 4f);

        addChargeTable(document, bill, tableHeader, body, bodyBold, totalText, totalBar);
        addSpacer(document, 4f);

        addPaymentBlock(document, bill, title, body, bodyBold);
        addSpacer(document, 4f);
        addFooter(document, bodyBold, muted);

        document.close();
        return out.toByteArray();
    }

    private void addLogo(Document document) {
        Image logo = loadLogoImage();
        if (logo != null) {
            logo.scaleToFit(220f, 62f);
            logo.setAlignment(Element.ALIGN_CENTER);
            document.add(logo);
            return;
        }
        Paragraph fallback = new Paragraph("PLUGIN", new Font(Font.HELVETICA, 28, Font.BOLD, TEXT_DARK));
        fallback.setAlignment(Element.ALIGN_CENTER);
        document.add(fallback);
    }

    private void addTopInfo(Document document, Bill bill, Font body, Font bodyBold) {
        PdfPTable table = new PdfPTable(new float[]{1f, 1f});
        table.setWidthPercentage(100f);

        PdfPCell left = baseCell();
        left.addElement(line("Invoice #:", safe(bill.getInvoiceNumber()), body, bodyBold));
        left.addElement(line("Station ID:", formatStationId(bill), body, bodyBold));
        left.addElement(line("Location:", formatLocationName(bill), body, bodyBold));

        PdfPCell right = baseCell();
        right.setHorizontalAlignment(Element.ALIGN_RIGHT);
        right.addElement(rightLine("Date:", formatDate(resolveReferenceDateTime(bill)), body, bodyBold));
        right.addElement(rightLine("Time:", formatTime(resolveReferenceDateTime(bill)), body, bodyBold));
        right.addElement(rightLine("Status:", formatStatus(bill), body, bodyBold));

        table.addCell(left);
        table.addCell(right);
        document.add(table);
    }

    private void addCustomerSession(Document document, Bill bill, Font body, Font bodyBold) {
        PdfPTable table = new PdfPTable(new float[]{1f, 1f});
        table.setWidthPercentage(100f);

        PdfPCell left = baseCell();
        left.addElement(line("Customer Name:", formatCustomerName(bill), body, bodyBold));
        left.addElement(line("Vehicle:", formatVehicle(bill), body, bodyBold));
        left.addElement(line("Connector:", formatConnector(bill), body, bodyBold));
        left.addElement(line("Session ID:", formatSessionId(bill), body, bodyBold));

        PdfPCell right = baseCell();
        right.setHorizontalAlignment(Element.ALIGN_RIGHT);
        right.addElement(rightLine("Start Time:", formatSessionStart(bill), body, bodyBold));
        right.addElement(rightLine("End Time:", formatSessionEnd(bill), body, bodyBold));
        right.addElement(rightLine("Duration:", formatDuration(resolveDurationSeconds(bill)), body, bodyBold));

        table.addCell(left);
        table.addCell(right);
        document.add(table);
    }

    private void addChargeTable(
            Document document,
            Bill bill,
            Font headerFont,
            Font body,
            Font bodyBold,
            Font totalText,
            Font totalBar
    ) {
        BigDecimal total = amountOrZero(bill.getTotalAmount());
        BigDecimal rate = amountOrZero(bill.getRateApplied());
        BigDecimal energy = amountOrZero(bill.getEnergyKwh());
        long totalSeconds = resolveDurationSeconds(bill);
        String rateType = safe(bill.getRateType()).toUpperCase(Locale.ENGLISH);

        BigDecimal energyAmount = BigDecimal.ZERO;
        BigDecimal timeAmount = BigDecimal.ZERO;
        if (rate.signum() > 0 && energy.signum() > 0 && rateType.contains("KWH")) {
            energyAmount = rate.multiply(energy).setScale(2, RoundingMode.HALF_UP);
        }
        if (rate.signum() > 0 && totalSeconds > 0 && (rateType.contains("MIN") || rateType.contains("MINUTE"))) {
            BigDecimal durationMinutesExact = BigDecimal.valueOf(totalSeconds)
                    .divide(BigDecimal.valueOf(60), 4, RoundingMode.HALF_UP);
            timeAmount = rate.multiply(durationMinutesExact).setScale(2, RoundingMode.HALF_UP);
        }

        List<InvoiceLineItem> rows = new ArrayList<>();
        rows.add(new InvoiceLineItem(
                "Energy Consumed",
                rateType.contains("KWH") ? formatMoney(rate) + "/kWh" : "-",
                energy.signum() > 0 ? formatNumber(energy) + " kWh" : "-",
                energyAmount.signum() > 0 ? energyAmount : null
        ));
        rows.add(new InvoiceLineItem(
                "Charging Time",
                (rateType.contains("MIN") || rateType.contains("MINUTE")) ? formatMoney(rate) + "/min" : "-",
                totalSeconds > 0 ? formatDuration(totalSeconds) : "-",
                timeAmount.signum() > 0 ? timeAmount : null
        ));

        BigDecimal itemSum = energyAmount.add(timeAmount).setScale(2, RoundingMode.HALF_UP);
        BigDecimal serviceFee = total.subtract(itemSum).setScale(2, RoundingMode.HALF_UP);
        if (serviceFee.signum() < 0) serviceFee = BigDecimal.ZERO;
        if (serviceFee.signum() > 0) {
            rows.add(new InvoiceLineItem("Service Fee", "-", "-", serviceFee));
            itemSum = itemSum.add(serviceFee).setScale(2, RoundingMode.HALF_UP);
        }

        if (itemSum.signum() == 0 && total.signum() > 0) {
            rows.clear();
            rows.add(new InvoiceLineItem("Charging Session", formatRate(bill.getRateApplied(), bill.getRateType()), "-", total));
            itemSum = total;
        }

        BigDecimal subtotal = itemSum;
        BigDecimal tax = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        BigDecimal grandTotal = subtotal.add(tax).setScale(2, RoundingMode.HALF_UP);

        PdfPTable table = new PdfPTable(new float[]{2.8f, 1.6f, 1.5f, 1.2f});
        table.setWidthPercentage(100f);

        addHeaderCell(table, "Description", headerFont, Element.ALIGN_LEFT);
        addHeaderCell(table, "Rate", headerFont, Element.ALIGN_CENTER);
        addHeaderCell(table, "Usage", headerFont, Element.ALIGN_CENTER);
        addHeaderCell(table, "Total", headerFont, Element.ALIGN_RIGHT);

        for (InvoiceLineItem row : rows) {
            addBodyCell(table, row.description(), body, Element.ALIGN_LEFT);
            addBodyCell(table, row.rate(), body, Element.ALIGN_CENTER);
            addBodyCell(table, row.usage(), body, Element.ALIGN_CENTER);
            addBodyCell(table, row.amount() != null ? formatMoney(row.amount()) : "-", bodyBold, Element.ALIGN_RIGHT);
        }

        PdfPCell subtotalLabel = new PdfPCell(new Phrase("Subtotal", totalText));
        subtotalLabel.setColspan(3);
        subtotalLabel.setHorizontalAlignment(Element.ALIGN_RIGHT);
        subtotalLabel.setPadding(5f);
        subtotalLabel.setBorder(Rectangle.TOP);
        subtotalLabel.setBorderColor(BORDER_LIGHT);
        table.addCell(subtotalLabel);

        PdfPCell subtotalValue = new PdfPCell(new Phrase(formatMoney(subtotal), totalText));
        subtotalValue.setHorizontalAlignment(Element.ALIGN_RIGHT);
        subtotalValue.setPadding(5f);
        subtotalValue.setBorder(Rectangle.TOP);
        subtotalValue.setBorderColor(BORDER_LIGHT);
        table.addCell(subtotalValue);

        PdfPCell taxLabel = new PdfPCell(new Phrase("Tax (0%)", totalText));
        taxLabel.setColspan(3);
        taxLabel.setHorizontalAlignment(Element.ALIGN_RIGHT);
        taxLabel.setPadding(5f);
        taxLabel.setBorder(Rectangle.TOP);
        taxLabel.setBorderColor(BORDER_LIGHT);
        table.addCell(taxLabel);

        PdfPCell taxValue = new PdfPCell(new Phrase(formatMoney(tax), totalText));
        taxValue.setHorizontalAlignment(Element.ALIGN_RIGHT);
        taxValue.setPadding(5f);
        taxValue.setBorder(Rectangle.TOP);
        taxValue.setBorderColor(BORDER_LIGHT);
        table.addCell(taxValue);

        PdfPCell grandLabel = new PdfPCell(new Phrase("TOTAL", totalBar));
        grandLabel.setColspan(3);
        grandLabel.setBackgroundColor(BORDER_DARK);
        grandLabel.setHorizontalAlignment(Element.ALIGN_LEFT);
        grandLabel.setPadding(6f);
        grandLabel.setBorder(Rectangle.NO_BORDER);
        table.addCell(grandLabel);

        PdfPCell grandValue = new PdfPCell(new Phrase(formatMoney(grandTotal), totalBar));
        grandValue.setBackgroundColor(BORDER_DARK);
        grandValue.setHorizontalAlignment(Element.ALIGN_RIGHT);
        grandValue.setPadding(6f);
        grandValue.setBorder(Rectangle.NO_BORDER);
        table.addCell(grandValue);

        document.add(table);
    }

    private void addPaymentBlock(Document document, Bill bill, Font title, Font body, Font bodyBold) {
        Paragraph heading = new Paragraph("Payment Details", title);
        heading.setSpacingAfter(5f);
        document.add(heading);

        PdfPTable table = new PdfPTable(1);
        table.setWidthPercentage(100f);

        PdfPCell cell = baseCell();
        cell.addElement(line("Payment Method:", PAYMENT_METHOD, body, bodyBold));
        cell.addElement(line("Transaction ID:", TRANSACTION_ID, body, bodyBold));
        cell.addElement(line("Status:", formatStatus(bill), body, bodyBold));
        table.addCell(cell);

        document.add(table);
    }

    private void addFooter(Document document, Font bold, Font normal) {
        addDivider(document);
        addSpacer(document, 3f);

        Paragraph thanks = new Paragraph("Thank you for charging with PLUGIN", bold);
        thanks.setAlignment(Element.ALIGN_LEFT);
        document.add(thanks);

        addSpacer(document, 2f);
        Paragraph support = new Paragraph(WEBSITE_URL + "    |    " + SUPPORT_EMAIL, normal);
        support.setAlignment(Element.ALIGN_LEFT);
        document.add(support);
    }

    private void addHeaderCell(PdfPTable table, String text, Font font, int align) {
        PdfPCell cell = new PdfPCell(new Phrase(text, font));
        cell.setPadding(5f);
        cell.setHorizontalAlignment(align);
        cell.setBorder(Rectangle.TOP | Rectangle.BOTTOM);
        cell.setBorderColor(BORDER_LIGHT);
        table.addCell(cell);
    }

    private void addBodyCell(PdfPTable table, String text, Font font, int align) {
        PdfPCell cell = new PdfPCell(new Phrase(text, font));
        cell.setPadding(5f);
        cell.setHorizontalAlignment(align);
        cell.setBorder(Rectangle.BOTTOM);
        cell.setBorderColor(BORDER_LIGHT);
        table.addCell(cell);
    }

    private Paragraph line(String label, String value, Font labelFont, Font valueFont) {
        Paragraph p = new Paragraph();
        p.setSpacingAfter(2f);
        p.add(new Phrase(label + " ", labelFont));
        p.add(new Phrase(value, valueFont));
        return p;
    }

    private Paragraph rightLine(String label, String value, Font labelFont, Font valueFont) {
        Paragraph p = line(label, value, labelFont, valueFont);
        p.setAlignment(Element.ALIGN_RIGHT);
        return p;
    }

    private PdfPCell baseCell() {
        PdfPCell cell = new PdfPCell();
        cell.setBorder(Rectangle.NO_BORDER);
        cell.setPadding(2f);
        return cell;
    }

    private void addDivider(Document document) {
        PdfPTable divider = new PdfPTable(1);
        divider.setWidthPercentage(100f);
        PdfPCell line = new PdfPCell();
        line.setFixedHeight(1f);
        line.setBorder(Rectangle.NO_BORDER);
        line.setBackgroundColor(BORDER_LIGHT);
        divider.addCell(line);
        document.add(divider);
    }

    private void addSpacer(Document document, float before) {
        PdfPTable spacer = new PdfPTable(1);
        spacer.setWidthPercentage(100f);
        PdfPCell cell = new PdfPCell();
        cell.setBorder(Rectangle.NO_BORDER);
        cell.setFixedHeight(before);
        spacer.addCell(cell);
        document.add(spacer);
    }

    private Image loadLogoImage() {
        String[] paths = {"static/brand-logo-invoice.png", "static/brand-logo.png"};
        for (String path : paths) {
            try (InputStream input = new ClassPathResource(path).getInputStream()) {
                byte[] bytes = StreamUtils.copyToByteArray(input);
                return Image.getInstance(bytes);
            } catch (Exception ignored) {
            }
        }
        return null;
    }

    private String safe(String value) {
        return value == null || value.isBlank() ? "-" : value;
    }

    private String formatDate(LocalDateTime value) {
        return value == null ? "-" : value.format(DATE_FORMAT);
    }

    private String formatTime(LocalDateTime value) {
        return value == null ? "-" : value.format(TIME_FORMAT);
    }

    private String formatMoney(BigDecimal value) {
        if (value == null) return "-";
        return "\u20B9" + value.setScale(2, RoundingMode.HALF_UP).toPlainString();
    }

    private String formatRate(BigDecimal rate, String type) {
        String amount = rate == null ? "-" : formatMoney(rate);
        if (type == null || type.isBlank()) return amount;
        return amount + " / " + type;
    }

    private String formatNumber(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP).toPlainString();
    }

    private BigDecimal amountOrZero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value.setScale(2, RoundingMode.HALF_UP);
    }

    private String formatStationId(Bill bill) {
        if (bill.getStation() == null || bill.getStation().getId() == null) return "-";
        return "ST-" + bill.getStation().getId();
    }

    private String formatLocationName(Bill bill) {
        if (bill.getStation() == null) return "-";
        String name = safe(bill.getStation().getName());
        if (!"-".equals(name)) return name;
        return safe(bill.getStation().getAddress());
    }

    private String formatCustomerName(Bill bill) {
        return safe(bill.getCustomer() != null ? bill.getCustomer().getFullName() : null);
    }

    private String formatVehicle(Bill bill) {
        if (bill.getCustomer() == null) return "-";
        String make = safe(bill.getCustomer().getVehicleMake());
        String model = safe(bill.getCustomer().getVehicleModel());
        if ("-".equals(make) && "-".equals(model)) return "-";
        if ("-".equals(make)) return model;
        if ("-".equals(model)) return make;
        return make + " " + model;
    }

    private String formatConnector(Bill bill) {
        if (bill.getSession() == null || bill.getSession().getChargingPoint() == null) return "-";
        String connector = safe(bill.getSession().getChargingPoint().getConnectorType());
        if (!"-".equals(connector)) return connector;
        return safe(bill.getSession().getChargingPoint().getIdentifier());
    }

    private String formatSessionId(Bill bill) {
        if (bill.getSession() == null || bill.getSession().getId() == null) return "-";
        return "CHG-" + bill.getSession().getId();
    }

    private String formatSessionStart(Bill bill) {
        if (bill.getSession() == null) return "-";
        return formatTime(bill.getSession().getStartTime());
    }

    private String formatSessionEnd(Bill bill) {
        if (bill.getSession() == null) return "-";
        return formatTime(bill.getSession().getEndTime());
    }

    private String formatDuration(long totalSeconds) {
        if (totalSeconds <= 0) return "0 sec";
        long minutes = totalSeconds / 60;
        long seconds = totalSeconds % 60;
        if (minutes > 0 && seconds > 0) return minutes + " min " + seconds + " sec";
        if (minutes > 0) return minutes + " min";
        return seconds + " sec";
    }

    private String formatStatus(Bill bill) {
        if (bill.getPaymentStatus() == PaymentStatus.PAID || bill.getPaidAt() != null) {
            return "Paid";
        }
        if (bill.getPaymentStatus() == null) return "-";
        String raw = bill.getPaymentStatus().name().toLowerCase(Locale.ENGLISH);
        return Character.toUpperCase(raw.charAt(0)) + raw.substring(1);
    }

    private LocalDateTime resolveReferenceDateTime(Bill bill) {
        if (bill.getPaidAt() != null) return bill.getPaidAt();
        if (bill.getCreatedAt() != null) return bill.getCreatedAt();
        if (bill.getSession() != null && bill.getSession().getEndTime() != null) return bill.getSession().getEndTime();
        if (bill.getSession() != null && bill.getSession().getStartTime() != null) return bill.getSession().getStartTime();
        return null;
    }

    private long resolveDurationSeconds(Bill bill) {
        if (bill == null) return 0;
        if (bill.getDurationSeconds() != null && bill.getDurationSeconds() > 0) {
            return Math.max(0, bill.getDurationSeconds());
        }
        if (bill.getDurationMinutes() != null && bill.getDurationMinutes() > 0) {
            return Math.max(0, bill.getDurationMinutes() * 60);
        }
        if (bill.getSession() != null && bill.getSession().getStartTime() != null && bill.getSession().getEndTime() != null) {
            long seconds = java.time.Duration.between(
                    bill.getSession().getStartTime(),
                    bill.getSession().getEndTime()
            ).getSeconds();
            return Math.max(0, seconds);
        }
        return 0;
    }

    private record InvoiceLineItem(String description, String rate, String usage, BigDecimal amount) {}
}
