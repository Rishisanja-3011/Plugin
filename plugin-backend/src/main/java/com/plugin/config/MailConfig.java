package com.plugin.config;

import org.springframework.boot.autoconfigure.mail.MailProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;

import java.nio.charset.Charset;
import java.util.Properties;

@Configuration
@EnableConfigurationProperties(MailProperties.class)
public class MailConfig {

    @Bean
    @Primary
    public JavaMailSender javaMailSender(MailProperties properties) {
        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        sender.setHost(properties.getHost());
        if (properties.getPort() != null) {
            sender.setPort(properties.getPort());
        }
        sender.setUsername(properties.getUsername());
        String password = properties.getPassword();
        if (password != null) {
            sender.setPassword(password.replaceAll("\\s+", ""));
        }
        Charset encoding = properties.getDefaultEncoding();
        if (encoding != null) {
            sender.setDefaultEncoding(encoding.name());
        }
        Properties javaProps = new Properties();
        javaProps.putAll(properties.getProperties());
        sender.setJavaMailProperties(javaProps);
        return sender;
    }
}
