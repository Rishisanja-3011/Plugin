package com.plugin.config;

import java.util.Locale;

public final class IdentityNormalizer {

    private IdentityNormalizer() {
    }

    public static String email(String value) {
        return value == null ? null : value.trim().toLowerCase(Locale.ROOT);
    }
}
