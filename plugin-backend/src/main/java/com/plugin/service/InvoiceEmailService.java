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
            helper.setSubject("PLUGIN - Invoice Paid");

            String customerName = bill.getCustomer().getFullName() != null
                    ? bill.getCustomer().getFullName()
                    : "Customer";
            String amount = bill.getTotalAmount() != null ? "INR " + bill.getTotalAmount() : "-";
            String body = "Hi " + customerName + ",\n\n"
                    + "Thanks for your payment. Your invoice is attached.\n\n"
                    + "Invoice #: " + baseName + "\n"
                    + "Amount: " + amount + "\n\n"
                    + "Regards,\n"
                    + "PLUGIN Team";

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
            message.setSubject("PLUGIN - Invoice Paid");
            String customerName = bill.getCustomer().getFullName() != null
                    ? bill.getCustomer().getFullName()
                    : "Customer";
            String amount = bill.getTotalAmount() != null ? "INR " + bill.getTotalAmount() : "-";
            String baseName = bill.getInvoiceNumber() != null && !bill.getInvoiceNumber().isBlank()
                    ? bill.getInvoiceNumber()
                    : "invoice-" + bill.getId();
            String body = "Hi " + customerName + ",\n\n"
                    + "Thanks for your payment. Your invoice is ready.\n\n"
                    + "Invoice #: " + baseName + "\n"
                    + "Amount: " + amount + "\n\n"
                    + "You can also download the PDF anytime from the Billing page.\n\n"
                    + "Regards,\n"
                    + "PLUGIN Team";
            message.setText(body);
            mailSender.send(message);
            log.info("Fallback invoice email sent to {}", to);
        } catch (Exception e) {
            log.warn("Failed to send fallback invoice email to {}", to, e);
        }
    }
}
