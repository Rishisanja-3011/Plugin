package com.plugin.config;

import com.plugin.entity.*;
import com.plugin.enums.*;
import com.plugin.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Comparator;
import java.util.List;

/** Creates clearly labelled, idempotent records used only in the HackOut demonstration. */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.demo-seed.enabled", havingValue = "true")
@Slf4j
public class HackathonDemoDataSeeder implements ApplicationRunner {
    private static final String CUSTOMER_EMAIL = "driver.demo@plugin.example";
    private static final String PENDING_EMAIL = "kyc.pending@plugin.example";

    private final UserRepository users;
    private final StationRepository stations;
    private final UserVehicleRepository vehicles;
    private final WalletRepository wallets;
    private final WalletLedgerEntryRepository ledger;
    private final BillRepository bills;
    private final AuditLogRepository audits;
    private final StationManagerApplicationRepository applications;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.demo-seed.password:}")
    private String demoPassword;

    @Override
    public void run(ApplicationArguments args) {
        if (demoPassword == null || demoPassword.length() < 12) {
            throw new IllegalStateException("DEMO_SEED_PASSWORD must contain at least 12 characters");
        }
        List<Station> targets = stations.findByActiveTrue().stream()
                .filter(station -> station.getName() == null
                        || !station.getName().toLowerCase().contains("surat"))
                .sorted(Comparator.comparing(Station::getId))
                .limit(4)
                .toList();
        for (int index = 0; index < targets.size(); index++) {
            seedOperator(targets.get(index), index + 1);
        }
        User customer = seedCustomer();
        seedCustomerRecords(customer, targets);
        seedPendingKycRequest();
        log.info("HackOut demo data is ready ({} station operators)", targets.size());
    }

    private void seedOperator(Station station, int number) {
        String email = "station" + number + ".demo@plugin.example";
        User operator = users.findByEmailIgnoreCase(email).orElseGet(() -> users.save(User.builder()
                .fullName("Demo Station Operator " + number)
                .email(email)
                .password(passwordEncoder.encode(demoPassword))
                .phone("+9190000000" + number)
                .role(Role.STATION_OPERATOR)
                .active(true)
                .build()));
        if (station.getManagerId() == null || station.getManagerId().equals(operator.getId())) {
            station.setManager(operator);
            station.setManagerId(operator.getId());
            stations.save(station);
        } else {
            log.warn("Demo operator {} was not assigned because station {} already has a manager", email, station.getId());
        }
    }

    private User seedCustomer() {
        return users.findByEmailIgnoreCase(CUSTOMER_EMAIL).orElseGet(() -> users.save(User.builder()
                .fullName("HackOut Demo Driver")
                .email(CUSTOMER_EMAIL)
                .password(passwordEncoder.encode(demoPassword))
                .phone("+919100000001")
                .role(Role.CUSTOMER)
                .active(true)
                .build()));
    }

    private void seedCustomerRecords(User customer, List<Station> targets) {
        if (vehicles.findByUserIdOrderByActiveDescCreatedAtDesc(customer.getId()).isEmpty()) {
            vehicles.save(UserVehicle.builder()
                    .user(customer).userId(customer.getId())
                    .vehicleMake("Tata").vehicleModel("Nexon EV Max")
                    .vehicleRegistration("GJ01DE2026")
                    .vehicleNickname("HackOut Demo EV").active(true).build());
        }

        Wallet wallet = wallets.findByCustomerId(customer.getId()).orElseGet(() -> wallets.save(Wallet.builder()
                .customerId(customer.getId()).balance(new BigDecimal("1850.00"))
                .paymentMethodLabel("Demo UPI").paymentMethodLast4("2026")
                .mandateStatus("NOT_CONFIGURED").build()));

        if (ledger.findByCustomerIdOrderByCreatedAtDesc(customer.getId(), PageRequest.of(0, 1)).isEmpty()) {
            ledger.save(WalletLedgerEntry.builder()
                    .walletId(wallet.getId()).customerId(customer.getId())
                    .type(WalletLedgerType.MANUAL_TOP_UP).status(WalletTransactionStatus.SUCCEEDED)
                    .amount(new BigDecimal("2500.00")).balanceAfter(new BigDecimal("2500.00"))
                    .referenceType("HACKOUT_DEMO_TOP_UP").referenceId("DEMO-TOPUP-2026")
                    .description("HackOut demonstration wallet top-up").build());
            ledger.save(WalletLedgerEntry.builder()
                    .walletId(wallet.getId()).customerId(customer.getId())
                    .type(WalletLedgerType.CHARGING_DEBIT).status(WalletTransactionStatus.SUCCEEDED)
                    .amount(new BigDecimal("650.00")).balanceAfter(new BigDecimal("1850.00"))
                    .referenceType("HACKOUT_DEMO_INVOICE").referenceId("HACKOUT-INV-001")
                    .description("Demo EV charging payment").build());
        }

        for (int index = 0; index < Math.min(4, targets.size()); index++) {
            seedInvoice(customer, targets.get(index), index + 1);
        }
        if (audits.findAll().stream().noneMatch(audit -> "HACKOUT_DEMO_DATA_CREATED".equals(audit.getAction()))) {
            audits.save(AuditLog.builder()
                    .action("HACKOUT_DEMO_DATA_CREATED").entityType("DEMO_CUSTOMER")
                    .entityId(customer.getId()).performedBy("hackout-demo-seeder")
                    .details("Created linked demo vehicle, wallet, transactions, invoices and KYC data")
                    .build());
        }
    }

    private void seedInvoice(User customer, Station station, int number) {
        String invoice = String.format("HACKOUT-INV-%03d", number);
        if (bills.existsByInvoiceNumber(invoice)) return;
        BigDecimal energy = BigDecimal.valueOf(10L + number * 2L);
        BigDecimal rate = new BigDecimal("13.00");
        bills.save(Bill.builder()
                .invoiceNumber(invoice).customer(customer).customerId(customer.getId())
                .station(station).stationId(station.getId())
                .energyKwh(energy).durationMinutes(35L + number * 5L)
                .durationSeconds((35L + number * 5L) * 60L)
                .rateApplied(rate).rateType("HACKOUT_DEMO").totalAmount(energy.multiply(rate))
                .chargingPreference(number % 2 == 0 ? "GREENEST" : "BALANCED")
                .renewableSharePercent(BigDecimal.valueOf(34L + number * 5L))
                .carbonKg(energy.multiply(new BigDecimal("0.48")))
                .carbonSavedKg(energy.multiply(new BigDecimal("0.22")))
                .greenScore(55 + number * 7).energyDataMode("DEMO")
                .energySource("HackOut clearly-labelled sample")
                .paymentStatus(PaymentStatus.PAID).razorpayPaymentId("pay_demo_" + number)
                .paidAt(LocalDateTime.now().minusDays(number)).build());
    }

    private void seedPendingKycRequest() {
        User applicant = users.findByEmailIgnoreCase(PENDING_EMAIL).orElseGet(() -> users.save(User.builder()
                .fullName("Pending KYC Demo Applicant").email(PENDING_EMAIL)
                .password(passwordEncoder.encode(demoPassword)).phone("+919100000002")
                .role(Role.CUSTOMER).active(true).build()));
        if (applications.findByEmailIgnoreCase(PENDING_EMAIL).isPresent()) return;
        applications.save(StationManagerApplication.builder()
                .user(applicant).status(StationManagerApplicationStatus.PENDING)
                .fullName(applicant.getFullName()).email(PENDING_EMAIL)
                .applicationReferenceId("HACKOUT-KYC-PENDING-001").phone(applicant.getPhone())
                .dateOfBirth(LocalDate.of(1992, 4, 12)).residentialAddress("HackOut demo address")
                .governmentIdType("DEMO_ID").governmentIdNumber("DEMO-PENDING-001")
                .businessType(StationManagerBusinessType.INDIVIDUAL)
                .businessName("Pending Green Charge Demo")
                .stationName("Pending Ahmedabad Green Hub")
                .stationAddress("SG Highway demo location").stationCity("Ahmedabad")
                .stationState("Gujarat").stationPincode("380054")
                .propertyOccupancyType(StationPropertyOccupancyType.LEASED)
                .openingTime(LocalTime.of(6, 0)).closingTime(LocalTime.of(23, 0))
                .emergencyContactNumber("+919100000003").numberOfChargers(6)
                .chargerTypesSummary("DC fast charging").connectorTypesSummary("CCS2")
                .totalCapacityKw(360.0).build());
    }
}
