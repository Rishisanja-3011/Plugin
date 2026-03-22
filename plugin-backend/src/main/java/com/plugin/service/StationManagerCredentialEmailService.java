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

    public void sendCredentials(String recipientEmail,
                                String recipientName,
                                String portalLoginEmail,
                                String password) {
        if (mailSender == null) {
            throw new IllegalStateException("Mail service is not configured. Credentials could not be emailed.");
        }

        String from = (mailFrom != null && !mailFrom.isBlank()) ? mailFrom : mailUsername;
        if (from == null || from.isBlank()) {
            throw new IllegalStateException("Mail from address is not configured. Credentials could not be emailed.");
        }

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(recipientEmail);
            message.setFrom(from);
            message.setSubject("PLUGIN Station Manager Portal Credentials");
            message.setText(buildEmailBody(recipientName, portalLoginEmail, password));
            mailSender.send(message);
            log.info("Station manager credentials email sent to {}", recipientEmail);
        } catch (Exception ex) {
            log.warn("Failed to send station manager credentials email to {}", recipientEmail, ex);
            throw new IllegalStateException("Failed to email the station manager credentials. Please try again.");
        }
    }

    private String buildEmailBody(String recipientName, String portalLoginEmail, String password) {
        String safeName = (recipientName == null || recipientName.isBlank()) ? "Station Manager" : recipientName;

        return "Dear " + safeName + ",\n\n"
                + "Your PLUGIN Station Manager portal credentials are ready.\n\n"
                + "Login Email: " + portalLoginEmail + "\n"
                + "Password: " + password + "\n\n"
                + "You can now sign in to the Station Manager portal using these credentials.\n"
                + "For security, please change your password after your first login.\n\n"
                + "Portal: " + websiteUrl + "\n\n"
                + "Regards,\n"
                + "PLUGIN Admin Team";
    }
}
