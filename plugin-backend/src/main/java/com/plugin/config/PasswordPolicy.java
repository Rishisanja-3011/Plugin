package com.plugin.config;

public final class PasswordPolicy {

    public static final int MIN_LENGTH = 12;
    public static final int MAX_LENGTH = 72;
    public static final int MAX_UTF8_BYTES = 72;
    public static final int LEGACY_LOGIN_MAX_LENGTH = 100;
    public static final String NEW_PASSWORD_MESSAGE = "Password must be at least 12 characters and at most 72 UTF-8 bytes";

    private PasswordPolicy() {
    }
}
