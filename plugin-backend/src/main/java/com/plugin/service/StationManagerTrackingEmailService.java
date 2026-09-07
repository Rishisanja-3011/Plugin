package com.plugin.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class StationManagerTrackingEmailService {

    @Autowired(required = false)
    private JavaMailSender mailSender;

    @Value("${app.mail.from:}")
    private String mailFrom;

    @Value("${spring.mail.username:}")
    private String mailUsername;

    @Value("${app.website.url:www.plugin.com}")
    private String websiteUrl;

    @Value("${app.support.email:plugin.onservice@gmail.com}")
    private String supportEmail;

    public boolean sendTrackingId(String recipientEmail,
                                  String recipientName,
                                  String trackingId,
                                  String businessName,
                                  String stationName) {
        if (mailSender == null) {
            log.warn("JavaMailSender not configured; skipping station manager tracking email");
            return false;
        }

        String from = (mailFrom != null && !mailFrom.isBlank()) ? mailFrom : mailUsername;
        if (from == null || from.isBlank()) {
            log.warn("Mail from address not configured; skipping station manager tracking email");
            return false;
        }

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(recipientEmail);
            message.setFrom(from);
            message.setSubject("PLUGIN KYC Tracking ID");
            message.setText(buildTrackingEmailBody(recipientName, trackingId, businessName, stationName));
            mailSender.send(message);
            log.info("Station manager tracking email sent");
            return true;
        } catch (Exception ex) {
            log.warn("Station manager tracking email delivery failed; type={}", ex.getClass().getName());
            return false;
        }
    }

    private String buildTrackingEmailBody(String recipientName,
                                          String trackingId,
                                          String businessName,
                                          String stationName) {
        String safeName = (recipientName == null || recipientName.isBlank()) ? "Applicant" : recipientName;
        String safeBusinessName = (businessName == null || businessName.isBlank()) ? "-" : businessName;
        String safeStationName = (stationName == null || stationName.isBlank()) ? "-" : stationName;

        return "Dear " + safeName + ",\n\n"
                + "Your station manager KYC application has been submitted successfully.\n\n"
                + "Tracking ID: " + trackingId + "\n"
                + "Business Name: " + safeBusinessName + "\n"
                + "Station Name: " + safeStationName + "\n\n"
                + "Please keep this 11-digit tracking ID safe. You can use it on the KYC status page to check whether your application is pending, approved, or needs changes.\n\n"
                + "Website: " + websiteUrl + "\n"
                + "Support: " + supportEmail + "\n\n"
                + "Regards,\n"
                + "PLUGIN Admin Team";
    }
}
