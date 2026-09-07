package com.plugin.validation;

import com.plugin.config.PasswordPolicy;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

import java.nio.charset.StandardCharsets;

public class StrongPasswordValidator implements ConstraintValidator<StrongPassword, String> {

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        if (value == null) {
            return true;
        }
        int characterCount = value.codePointCount(0, value.length());
        if (characterCount < PasswordPolicy.MIN_LENGTH
                || value.getBytes(StandardCharsets.UTF_8).length > PasswordPolicy.MAX_UTF8_BYTES) {
            return false;
        }

        boolean hasLower = false;
        boolean hasUpper = false;
        boolean hasDigit = false;
        boolean hasSpecial = false;
        for (int offset = 0; offset < value.length();) {
            int codePoint = value.codePointAt(offset);
            hasLower |= Character.isLowerCase(codePoint);
            hasUpper |= Character.isUpperCase(codePoint);
            hasDigit |= Character.isDigit(codePoint);
            hasSpecial |= !Character.isLetterOrDigit(codePoint) && !Character.isWhitespace(codePoint);
            offset += Character.charCount(codePoint);
        }
        return hasLower && hasUpper && hasDigit && hasSpecial;
    }
}
