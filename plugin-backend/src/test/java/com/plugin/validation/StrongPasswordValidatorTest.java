package com.plugin.validation;

import com.plugin.dto.request.RegisterRequest;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class StrongPasswordValidatorTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void acceptsComplexPasswordWithinBcryptByteLimit() {
        RegisterRequest request = validRequest("SecurePass1!");

        assertThat(validator.validate(request)).isEmpty();
    }

    @Test
    void rejectsWeakPasswordAndUnicodeValuePastBcryptByteLimit() {
        RegisterRequest weak = validRequest("aaaaaaaaaaaa");
        RegisterRequest tooManyBytes = validRequest("Aa1!" + "é".repeat(35));

        assertThat(validator.validate(weak)).isNotEmpty();
        assertThat(validator.validate(tooManyBytes)).isNotEmpty();
    }

    private RegisterRequest validRequest(String password) {
        RegisterRequest request = new RegisterRequest();
        request.setFullName("Security Test");
        request.setEmail("security@example.test");
        request.setPassword(password);
        return request;
    }
}
