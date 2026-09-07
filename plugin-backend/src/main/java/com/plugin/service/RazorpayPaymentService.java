package com.plugin.service;

import com.plugin.entity.User;
import com.plugin.exception.BadRequestException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.RestTemplate;

import jakarta.annotation.PostConstruct;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class RazorpayPaymentService {

    private static final String ORDERS_URL = "https://api.razorpay.com/v1/orders";
    private static final String CUSTOMERS_URL = "https://api.razorpay.com/v1/customers";
    private static final String RECURRING_PAYMENTS_URL = "https://api.razorpay.com/v1/payments/create/recurring";
    private static final String HMAC_SHA256 = "HmacSHA256";

    @Value("${app.razorpay.key-id:}")
    private String keyId;

    @Value("${app.razorpay.key-secret:}")
    private String keySecret;

    @Value("${app.razorpay.currency:INR}")
    private String currency;

    @Value("${app.razorpay.business-name:PLUGIN}")
    private String businessName;

    @Value("${app.razorpay.minimum-amount:1.00}")
    private BigDecimal minimumAmount;

    @Value("${app.production:false}")
    private boolean productionMode;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final RestTemplate restTemplate = createRestTemplate();

    public record CreatedOrder(String orderId, Integer amountInPaise, String currency, String receipt) {}
    public record PaymentMethodSummary(
            String tokenId,
            String customerId,
            String method,
            String status,
            String label,
            String last4,
            String network,
            String failureReason
    ) {}
    public record RecurringPaymentResult(
            String orderId,
            String paymentId,
            String status,
            boolean fundsSecured,
            String failureReason
    ) {}
    public record RefundResult(String refundId, String status, BigDecimal amount) {}

    public String getKeyId() {
        ensureConfigured();
        return keyId;
    }

    public String getCurrency() {
        return currency;
    }

    public String getBusinessName() {
        return businessName;
    }

    public boolean isTestMode() {
        return keyId != null && keyId.startsWith("rzp_test_");
    }

    @PostConstruct
    void validateProductionConfiguration() {
        if (!productionMode) {
            return;
        }
        if (isBlank(keyId) || isBlank(keySecret) || !keyId.startsWith("rzp_live_")) {
            throw new IllegalStateException(
                    "Production requires configured Razorpay live credentials; test mode is not allowed");
        }
    }

    public String createCustomer(User user) {
        ensureConfigured();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", user.getFullName());
        body.put("email", user.getEmail());
        if (!isBlank(user.getPhone())) {
            body.put("contact", user.getPhone());
        }
        body.put("fail_existing", "0");
        body.put("notes", Map.of("pluginCustomerId", String.valueOf(user.getId())));

        Map<?, ?> response = postForMap(CUSTOMERS_URL, body);
        Object id = response.get("id");
        if (id == null || String.valueOf(id).isBlank()) {
            throw new BadRequestException("Razorpay did not return a customer id.");
        }
        return String.valueOf(id);
    }

    public CreatedOrder createWalletTopUpOrder(Long walletId, BigDecimal amount, String receipt) {
        ensureConfigured();
        Integer amountInPaise = toPaise(resolvePayableAmount(amount));
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("amount", amountInPaise);
        body.put("currency", currency);
        body.put("receipt", cleanReceipt(receipt));
        body.put("notes", Map.of(
                "walletId", String.valueOf(walletId),
                "purpose", "wallet_top_up"
        ));

        Map<?, ?> response = postForMap(ORDERS_URL, body);
        Object id = response.get("id");
        if (id == null || String.valueOf(id).isBlank()) {
            throw new BadRequestException("Razorpay did not return an order id.");
        }
        return new CreatedOrder(String.valueOf(id), amountInPaise, currency, cleanReceipt(receipt));
    }

    public CreatedOrder createRecurringAuthorizationOrder(User user,
                                                          String customerId,
                                                          String method,
                                                          BigDecimal maxDebitAmount,
                                                          String receipt) {
        ensureConfigured();
        Integer authorizationAmount = 100;
        Integer maxAmountInPaise = toPaise(resolvePayableAmount(maxDebitAmount));
        long expireAt = java.time.Instant.now().plus(java.time.Duration.ofDays(365 * 5L)).getEpochSecond();

        Map<String, Object> token = new LinkedHashMap<>();
        token.put("max_amount", maxAmountInPaise);
        token.put("expire_at", expireAt);
        token.put("frequency", "as_presented");

        Map<String, Object> notes = new LinkedHashMap<>();
        notes.put("pluginCustomerId", String.valueOf(user.getId()));
        notes.put("purpose", "wallet_auto_top_up_mandate");

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("amount", authorizationAmount);
        body.put("currency", currency);
        body.put("customer_id", customerId);
        body.put("method", normalizeRecurringMethod(method));
        body.put("token", token);
        body.put("receipt", cleanReceipt(receipt));
        body.put("notes", notes);

        Map<?, ?> response = postForMap(ORDERS_URL, body);
        Object id = response.get("id");
        if (id == null || String.valueOf(id).isBlank()) {
            throw new BadRequestException("Razorpay did not return a mandate order id.");
        }
        return new CreatedOrder(String.valueOf(id), authorizationAmount, currency, cleanReceipt(receipt));
    }

    public PaymentMethodSummary fetchPaymentMethodSummary(String paymentId) {
        Map<?, ?> payment = fetchPayment(paymentId);
        String tokenId = stringValue(payment.get("token_id"));
        String method = stringValue(payment.get("method"));
        String status = stringValue(payment.get("status"));
        String customerId = stringValue(payment.get("customer_id"));
        String failureReason = firstNonBlank(
                stringValue(payment.get("error_description")),
                stringValue(payment.get("error_reason"))
        );

        String label = method == null ? "Saved mandate" : method.toUpperCase() + " mandate";
        String last4 = null;
        String network = null;
        Object card = payment.get("card");
        if (card instanceof Map<?, ?> cardMap) {
            last4 = stringValue(cardMap.get("last4"));
            network = stringValue(cardMap.get("network"));
            if (!isBlank(network) && !isBlank(last4)) {
                label = network + " ending " + last4;
            }
        }

        if (isBlank(tokenId)) {
            throw new BadRequestException("Razorpay did not return a recurring token for this payment.");
        }
        return new PaymentMethodSummary(tokenId, customerId, method, status, label, last4, network, failureReason);
    }

    public RecurringPaymentResult chargeRecurringPayment(User user,
                                                         String customerId,
                                                         String tokenId,
                                                         BigDecimal amount,
                                                         String receipt,
                                                         String description) {
        ensureConfigured();
        Integer amountInPaise = toPaise(resolvePayableAmount(amount));
        String cleanReceipt = cleanReceipt(receipt);

        Map<String, Object> orderBody = new LinkedHashMap<>();
        orderBody.put("amount", amountInPaise);
        orderBody.put("currency", currency);
        orderBody.put("payment_capture", true);
        orderBody.put("receipt", cleanReceipt);
        orderBody.put("notes", Map.of(
                "pluginCustomerId", String.valueOf(user.getId()),
                "purpose", "wallet_auto_top_up"
        ));

        Map<?, ?> order = postForMap(ORDERS_URL, orderBody);
        String orderId = stringValue(order.get("id"));
        if (isBlank(orderId)) {
            throw new BadRequestException("Razorpay did not return an order id for auto top-up.");
        }

        Map<String, Object> paymentBody = new LinkedHashMap<>();
        paymentBody.put("email", user.getEmail());
        if (!isBlank(user.getPhone())) {
            paymentBody.put("contact", user.getPhone());
        }
        paymentBody.put("amount", amountInPaise);
        paymentBody.put("currency", currency);
        paymentBody.put("order_id", orderId);
        paymentBody.put("customer_id", customerId);
        paymentBody.put("token", tokenId);
        paymentBody.put("recurring", true);
        paymentBody.put("description", description);
        paymentBody.put("notes", Map.of(
                "pluginCustomerId", String.valueOf(user.getId()),
                "receipt", cleanReceipt
        ));

        Map<?, ?> paymentResponse = postForMap(RECURRING_PAYMENTS_URL, paymentBody);
        String paymentId = firstNonBlank(
                stringValue(paymentResponse.get("razorpay_payment_id")),
                stringValue(paymentResponse.get("id"))
        );
        if (isBlank(paymentId)) {
            return new RecurringPaymentResult(orderId, null, "failed", false,
                    "Razorpay did not return a payment id for auto top-up.");
        }

        Map<?, ?> payment = fetchPayment(paymentId);
        String status = stringValue(payment.get("status"));
        boolean secured = "captured".equalsIgnoreCase(status) || "authorized".equalsIgnoreCase(status);
        String failureReason = firstNonBlank(
                stringValue(payment.get("error_description")),
                stringValue(payment.get("error_reason")),
                secured ? null : "Recurring debit is not captured yet."
        );
        return new RecurringPaymentResult(orderId, paymentId, status, secured, failureReason);
    }

    public RefundResult refundPayment(String paymentId, BigDecimal amount, String receipt) {
        ensureConfigured();
        BigDecimal refundAmount = resolvePayableAmount(amount);
        if (isTestMode() && paymentId != null && paymentId.startsWith("test_")) {
            return new RefundResult("test_refund_" + System.currentTimeMillis(), "processed", refundAmount);
        }

        Integer amountInPaise = toPaise(refundAmount);
        String url = "https://api.razorpay.com/v1/payments/" + paymentId + "/refund";
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("amount", amountInPaise);
        body.put("speed", "normal");
        body.put("receipt", cleanReceipt(receipt));
        body.put("notes", Map.of("purpose", "wallet_source_destined_withdrawal"));

        Map<?, ?> response = postForMap(url, body);
        String refundId = stringValue(response.get("id"));
        if (isBlank(refundId)) {
            throw new BadRequestException("Razorpay did not return a refund id.");
        }
        String status = stringValue(response.get("status"));
        if ("failed".equalsIgnoreCase(status)) {
            throw new BadRequestException("Razorpay rejected the refund request.");
        }
        return new RefundResult(refundId, status, refundAmount);
    }

    public BigDecimal resolvePayableAmount(BigDecimal amount) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BadRequestException("Amount must be greater than zero.");
        }
        BigDecimal normalized = amount.setScale(2, RoundingMode.HALF_UP);
        BigDecimal minimum = minimumAmount == null
                ? BigDecimal.ONE
                : minimumAmount.setScale(2, RoundingMode.HALF_UP);
        return normalized.compareTo(minimum) < 0 ? minimum : normalized;
    }

    public boolean verifyPaymentSignature(String orderId, String paymentId, String signature) {
        ensureConfigured();
        if (isBlank(orderId) || isBlank(paymentId) || isBlank(signature)) return false;
        try {
            Mac mac = Mac.getInstance(HMAC_SHA256);
            mac.init(new SecretKeySpec(keySecret.getBytes(StandardCharsets.UTF_8), HMAC_SHA256));
            byte[] digest = mac.doFinal((orderId + "|" + paymentId).getBytes(StandardCharsets.UTF_8));
            String expected = toHex(digest);
            return MessageDigest.isEqual(
                    expected.getBytes(StandardCharsets.UTF_8),
                    signature.getBytes(StandardCharsets.UTF_8)
            );
        } catch (Exception ex) {
            return false;
        }
    }

    /**
     * A checkout signature authenticates the callback, but it does not replace
     * server-side settlement validation. Wallet money is spendable only after
     * Razorpay reports the exact order, amount and currency as captured.
     */
    public void requireCapturedPayment(String orderId, String paymentId, BigDecimal expectedAmount) {
        Map<?, ?> payment = fetchPayment(paymentId);
        if (!orderId.equals(stringValue(payment.get("order_id")))) {
            throw new BadRequestException("Razorpay payment does not belong to this order.");
        }
        Object rawAmount = payment.get("amount");
        long actualAmount = rawAmount instanceof Number number ? number.longValue() : -1L;
        long requiredAmount = toPaise(resolvePayableAmount(expectedAmount)).longValue();
        if (actualAmount != requiredAmount) {
            throw new BadRequestException("Razorpay payment amount does not match the wallet top-up.");
        }
        if (!currency.equalsIgnoreCase(stringValue(payment.get("currency")))) {
            throw new BadRequestException("Razorpay payment currency does not match the wallet top-up.");
        }
        if (!"captured".equalsIgnoreCase(stringValue(payment.get("status")))) {
            throw new BadRequestException("Razorpay payment is not captured yet.");
        }
    }

    private Integer toPaise(BigDecimal amount) {
        return amount
                .setScale(2, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100))
                .setScale(0, RoundingMode.HALF_UP)
                .intValueExact();
    }

    private Map<?, ?> fetchPayment(String paymentId) {
        ensureConfigured();
        if (isBlank(paymentId)) {
            throw new BadRequestException("Razorpay payment id is required.");
        }
        String url = "https://api.razorpay.com/v1/payments/" + paymentId;
        HttpHeaders headers = new HttpHeaders();
        headers.setBasicAuth(keyId, keySecret);
        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                    url,
                    HttpMethod.GET,
                    new HttpEntity<>(headers),
                    Map.class
            );
            Map<?, ?> responseBody = response.getBody();
            if (responseBody == null) {
                throw new BadRequestException("Razorpay did not return payment details.");
            }
            return responseBody;
        } catch (RestClientResponseException ex) {
            throw new BadRequestException(extractRazorpayError(ex));
        } catch (RestClientException ex) {
            throw new BadRequestException("Unable to reach Razorpay. Please check internet access and try again.");
        }
    }

    private Map<?, ?> postForMap(String url, Map<String, Object> body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBasicAuth(keyId, keySecret);
        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    new HttpEntity<>(body, headers),
                    Map.class
            );
            Map<?, ?> responseBody = response.getBody();
            if (responseBody == null) {
                throw new BadRequestException("Razorpay returned an empty response.");
            }
            return responseBody;
        } catch (RestClientResponseException ex) {
            throw new BadRequestException(extractRazorpayError(ex));
        } catch (RestClientException ex) {
            throw new BadRequestException("Unable to reach Razorpay. Please check internet access and try again.");
        }
    }

    private String normalizeRecurringMethod(String method) {
        String normalized = String.valueOf(method == null ? "card" : method).trim().toLowerCase();
        if (normalized.equals("upi") || normalized.equals("emandate") || normalized.equals("card")) {
            return normalized;
        }
        return "card";
    }

    private String cleanReceipt(String value) {
        String cleaned = String.valueOf(value == null ? "plugin" : value).replaceAll("[^a-zA-Z0-9_-]", "_");
        return cleaned.length() <= 40 ? cleaned : cleaned.substring(0, 40);
    }

    private String stringValue(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (!isBlank(value)) return value;
        }
        return null;
    }

    private String extractRazorpayError(RestClientResponseException ex) {
        String responseText = ex.getResponseBodyAsString();
        try {
            Map<?, ?> body = objectMapper.readValue(responseText, Map.class);
            Object error = body.get("error");
            if (error instanceof Map<?, ?> errorMap) {
                Object description = errorMap.get("description");
                if (description != null && !String.valueOf(description).isBlank()) {
                    return "Razorpay rejected the order: " + description;
                }
            }
        } catch (Exception ignored) {
            // Fall through to generic status text below.
        }
        String statusText = ex.getStatusText();
        return "Razorpay rejected the order"
                + (statusText == null || statusText.isBlank() ? "." : ": " + statusText);
    }

    private void ensureConfigured() {
        if (isBlank(keyId) || isBlank(keySecret)) {
            throw new BadRequestException("Razorpay is not configured on the server.");
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private String toHex(byte[] bytes) {
        StringBuilder hex = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) {
            hex.append(String.format("%02x", value));
        }
        return hex.toString();
    }

    private RestTemplate createRestTemplate() {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(10000);
        requestFactory.setReadTimeout(10000);
        return new RestTemplate(requestFactory);
    }
}
