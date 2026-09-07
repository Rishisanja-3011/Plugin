package com.plugin.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class StationManagerCredentialEmailService {

    @Autowired(required = false)
    private JavaMailSender mailSender;

    @Value("${app.mail.from:}")
    private String mailFrom;

    @Value("${spring.mail.username:}")
    private String mailUsername;

    @Value("${app.website.url:www.plugin.com}")
    private String websiteUrl;

    public void sendAccessInvitation(String recipientEmail,
                                     String recipientName,
                                     String portalLoginEmail,
                                     String setupToken) {
        if (mailSender == null) {
            throw new IllegalStateException("Mail service is not configured. The access invitation could not be emailed.");
        }

        String from = (mailFrom != null && !mailFrom.isBlank()) ? mailFrom : mailUsername;
        if (from == null || from.isBlank()) {
            throw new IllegalStateException("Mail from address is not configured. The access invitation could not be emailed.");
        }

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(recipientEmail);
            message.setFrom(from);
            message.setSubject("Set up your PLUGIN Station Manager access");
            message.setText(buildEmailBody(recipientName, portalLoginEmail, setupToken));
            mailSender.send(message);
            log.info("Station manager access invitation email sent");
        } catch (Exception ex) {
            log.warn("Failed to send station manager access invitation email");
            throw new IllegalStateException("Failed to email the access invitation. Please try again.");
        }
    }

    private String buildEmailBody(String recipientName, String portalLoginEmail, String setupToken) {
        String safeName = (recipientName == null || recipientName.isBlank()) ? "Station Manager" : recipientName;
        String baseUrl = websiteUrl == null ? "" : websiteUrl.trim();
        if (!baseUrl.startsWith("https://") && !baseUrl.startsWith("http://")) {
            baseUrl = "https://" + baseUrl;
        }
        while (baseUrl.endsWith("/")) {
            baseUrl = baseUrl.substring(0, baseUrl.length() - 1);
        }
        // URL fragments are not sent to the web server or included in HTTP
        // referrers, keeping the one-time secret out of access logs.
        String setupUrl = baseUrl + "/station-manager/setup-access#token=" + setupToken;

        return "Dear " + safeName + ",\n\n"
                + "Your PLUGIN Station Manager account has been approved.\n\n"
                + "Login Email: " + portalLoginEmail + "\n"
                + "Create your password using this one-time link:\n"
                + setupUrl + "\n\n"
                + "This link expires shortly and can be used only once. If you did not expect it, ignore this email.\n\n"
                + "Regards,\n"
                + "PLUGIN Admin Team";
    }
}
