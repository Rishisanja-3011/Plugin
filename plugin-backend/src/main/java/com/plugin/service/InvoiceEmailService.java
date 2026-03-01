package com.plugin.service;

import com.plugin.entity.Bill;
import com.plugin.repository.BillRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

@Service
@RequiredArgsConstructor
@Slf4j
public class InvoiceEmailService {

    private final InvoicePdfService invoicePdfService;
    private final BillRepository billRepository;

    @Autowired(required = false)
    private JavaMailSender mailSender;

    @Value("${app.mail.from:}")
    private String mailFrom;

    @Value("${spring.mail.username:}")
    private String mailUsername;

    @Value("${app.support.email:plugin.onservice@gmail.com}")
    private String supportEmail;

    @Value("${app.support.phone:}")
    private String supportPhone;

    @Value("${app.website.url:www.plugin.com}")
    private String websiteUrl;

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("dd MMM yyyy", Locale.ENGLISH);
    private static final DateTimeFormatter TIME_FORMAT = DateTimeFormatter.ofPattern("hh:mm a", Locale.ENGLISH);

    @Async
    @Transactional(readOnly = true)
    public void sendPaidInvoice(Long billId) {
        Bill bill = billRepository.findById(billId).orElse(null);
        if (bill == null) {
            log.warn("Bill {} not found; skipping invoice email", billId);
            return;
        }
        if (mailSender == null) {
            log.warn("JavaMailSender not configured; skipping invoice email");
            return;
        }
        if (bill == null || bill.getCustomer() == null) {
            log.warn("Bill or customer missing; skipping invoice email");
            return;
        }
        String to = bill.getCustomer().getEmail();
        if (to == null || to.isBlank()) {
            log.warn("Customer email missing; skipping invoice email");
            return;
        }
        String from = (mailFrom != null && !mailFrom.isBlank()) ? mailFrom : mailUsername;
        if (from == null || from.isBlank()) {
            log.warn("Mail from address not configured; skipping invoice email");
            return;
        }

        try {
            byte[] pdf = invoicePdfService.generateInvoice(bill);
            String invoiceNumber = bill.getInvoiceNumber();
            String baseName = invoiceNumber != null && !invoiceNumber.isBlank()
                    ? invoiceNumber
                    : "invoice-" + bill.getId();
            String filename = baseName.replaceAll("[^a-zA-Z0-9-_]", "_") + ".pdf";

            var message = mailSender.createMimeMessage();
            var helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setTo(to);
            helper.setFrom(from);
            helper.setSubject("Payment Confirmation");
            String body = buildPaymentConfirmationBody(bill);

            helper.setText(body, false);
            helper.addAttachment(filename, new ByteArrayResource(pdf), "application/pdf");
            mailSender.send(message);
            log.info("Invoice email sent to {}", to);
            return;
        } catch (Exception e) {
            log.warn("Failed to send invoice email with attachment to {}", to, e);
        }

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(to);
            message.setFrom(from);
            message.setSubject("Payment Confirmation");
            String body = buildPaymentConfirmationBody(bill);
            message.setText(body);
            mailSender.send(message);
            log.info("Fallback invoice email sent to {}", to);
        } catch (Exception e) {
            log.warn("Failed to send fallback invoice email to {}", to, e);
        }
    }

    private String buildPaymentConfirmationBody(Bill bill) {
        String customerName = bill.getCustomer() != null && bill.getCustomer().getFullName() != null
                ? bill.getCustomer().getFullName()
                : "Customer";
        String amount = formatCurrencyInr(bill.getTotalAmount());
        String energy = bill.getEnergyKwh() != null
                ? bill.getEnergyKwh().setScale(2, RoundingMode.HALF_UP).toPlainString() + " kWh"
                : "-";
        String stationLocation = buildStationLocation(bill);
        String sessionId = bill.getSession() != null && bill.getSession().getId() != null
                ? String.valueOf(bill.getSession().getId())
                : "-";
        LocalDateTime referenceDateTime = resolveReferenceDateTime(bill);
        String date = referenceDateTime != null ? referenceDateTime.format(DATE_FORMAT) : "-";
        String time = referenceDateTime != null ? referenceDateTime.format(TIME_FORMAT) : "-";

        String supportContact = supportEmail;
        if (supportPhone != null && !supportPhone.isBlank()) {
            supportContact = supportContact + " / " + supportPhone;
        }

        return "Dear " + customerName + ",\n\n"
                + "Thank you for using PLUGIN.\n\n"
                + "We confirm that your payment of " + amount
                + " for the charging session on " + date + " at " + time
                + " has been successfully received.\n\n"
                + "Charging Details:\n\n"
                + "Station Location: " + stationLocation + "\n"
                + "Session ID: " + sessionId + "\n"
                + "Energy Consumed: " + energy + "\n"
                + "Amount Paid: " + amount + "\n"
                + "Payment Method: UPI\n\n"
                + "Your transaction has been completed successfully.\n\n"
                + "If you have any questions regarding this session, please feel free to contact our support team at "
                + supportContact + ".\n\n"
                + "Thank you for choosing our EV Charging Network. We look forward to serving you again.\n\n"
                + "Best regards,\n"
                + "Team Plugin\n"
                + supportEmail + "\n"
                + websiteUrl;
    }

    private LocalDateTime resolveReferenceDateTime(Bill bill) {
        if (bill.getPaidAt() != null) return bill.getPaidAt();
        if (bill.getSession() != null && bill.getSession().getEndTime() != null) return bill.getSession().getEndTime();
        if (bill.getSession() != null && bill.getSession().getStartTime() != null) return bill.getSession().getStartTime();
        return bill.getCreatedAt();
    }

    private String buildStationLocation(Bill bill) {
        if (bill.getStation() == null) return "-";
        String name = bill.getStation().getName() != null ? bill.getStation().getName() : "";
        String address = bill.getStation().getAddress() != null ? bill.getStation().getAddress() : "";
        if (!name.isBlank() && !address.isBlank()) return name + " / " + address;
        if (!name.isBlank()) return name;
        if (!address.isBlank()) return address;
        return "-";
    }

    private String formatCurrencyInr(BigDecimal value) {
        if (value == null) return "-";
        return "INR " + value.setScale(2, RoundingMode.HALF_UP).toPlainString();
    }
}
