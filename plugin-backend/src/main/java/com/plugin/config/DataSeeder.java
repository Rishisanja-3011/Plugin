package com.plugin.config;

import com.plugin.entity.*;
import com.plugin.enums.*;
import com.plugin.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalTime;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final StationRepository stationRepository;
    private final ChargingPointRepository cpRepository;
    private final PricingRepository pricingRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditLogRepository auditLogRepository;

    @Override
    public void run(String... args) {
        if (userRepository.count() > 0) {
            log.info("Data already seeded, skipping.");
            return;
        }

        log.info("Seeding initial data...");

        // Users
        User admin = userRepository.save(User.builder()
                .fullName("Plugin Admin")
                .email("admin@plugin.com")
                .password(passwordEncoder.encode("Admin@123"))
                .phone("9999999999")
                .role(Role.ADMIN)
                .active(true)
                .build());

        User customer = userRepository.save(User.builder()
                .fullName("John Customer")
                .email("user@plugin.com")
                .password(passwordEncoder.encode("User@123"))
                .phone("8888888888")
                .role(Role.CUSTOMER)
                .active(true)
                .vehicleMake("Tesla")
                .vehicleModel("Model 3")
                .vehicleRegistration("MH01AB1234")
                .build());

        // Stations
        Station s1 = stationRepository.save(Station.builder()
                .name("Plugin SuperCharger - Downtown")
                .address("123 Main Street, Central Business District")
                .city("Mumbai")
                .state("Maharashtra")
                .pincode("400001")
                .contactPhone("9876543210")
                .contactEmail("downtown@plugin.com")
                .latitude(19.0760)
                .longitude(72.8777)
                .openingTime(LocalTime.of(6, 0))
                .closingTime(LocalTime.of(23, 0))
                .active(true)
                .build());

        Station s2 = stationRepository.save(Station.builder()
                .name("Plugin HyperCharge - Tech Park")
                .address("456 Innovation Drive, Tech Hub")
                .city("Bangalore")
                .state("Karnataka")
                .pincode("560001")
                .contactPhone("9876543211")
                .contactEmail("techpark@plugin.com")
                .latitude(12.9716)
                .longitude(77.5946)
                .openingTime(LocalTime.of(0, 0))
                .closingTime(LocalTime.of(23, 59))
                .active(true)
                .build());

        // Charging Points - Station 1
        cpRepository.save(ChargingPoint.builder().identifier("DT-FAST-01").station(s1)
                .pointType(PointType.FAST).maxPowerKw(150.0).connectorType("CCS2")
                .status(PointStatus.AVAILABLE).build());
        cpRepository.save(ChargingPoint.builder().identifier("DT-FAST-02").station(s1)
                .pointType(PointType.FAST).maxPowerKw(150.0).connectorType("CCS2")
                .status(PointStatus.AVAILABLE).build());
        cpRepository.save(ChargingPoint.builder().identifier("DT-SLOW-01").station(s1)
                .pointType(PointType.SLOW).maxPowerKw(22.0).connectorType("Type2")
                .status(PointStatus.AVAILABLE).build());
        cpRepository.save(ChargingPoint.builder().identifier("DT-SLOW-02").station(s1)
                .pointType(PointType.SLOW).maxPowerKw(22.0).connectorType("Type2")
                .status(PointStatus.AVAILABLE).build());

        // Charging Points - Station 2
        cpRepository.save(ChargingPoint.builder().identifier("TP-FAST-01").station(s2)
                .pointType(PointType.FAST).maxPowerKw(250.0).connectorType("CCS2")
                .status(PointStatus.AVAILABLE).build());
        cpRepository.save(ChargingPoint.builder().identifier("TP-FAST-02").station(s2)
                .pointType(PointType.FAST).maxPowerKw(250.0).connectorType("CCS2")
                .status(PointStatus.AVAILABLE).build());
        cpRepository.save(ChargingPoint.builder().identifier("TP-SLOW-01").station(s2)
                .pointType(PointType.SLOW).maxPowerKw(22.0).connectorType("Type2")
                .status(PointStatus.AVAILABLE).build());

        // Pricing
        pricingRepository.save(Pricing.builder().station(s1).pointType(PointType.FAST)
                .pricingModel(PricingModel.PER_KWH).ratePerUnit(BigDecimal.valueOf(18.00))
                .description("Fast charging at Rs 18/kWh").build());
        pricingRepository.save(Pricing.builder().station(s1).pointType(PointType.SLOW)
                .pricingModel(PricingModel.PER_KWH).ratePerUnit(BigDecimal.valueOf(12.00))
                .description("Slow charging at Rs 12/kWh").build());
        pricingRepository.save(Pricing.builder().station(s2).pointType(PointType.FAST)
                .pricingModel(PricingModel.PER_KWH).ratePerUnit(BigDecimal.valueOf(20.00))
                .description("Fast charging at Rs 20/kWh").build());
        pricingRepository.save(Pricing.builder().station(s2).pointType(PointType.SLOW)
                .pricingModel(PricingModel.PER_KWH).ratePerUnit(BigDecimal.valueOf(10.00))
                .description("Slow charging at Rs 10/kWh").build());

        // Audit
        auditLogRepository.save(AuditLog.builder()
                .action("SYSTEM_SEED")
                .entityType("SYSTEM")
                .performedBy("SYSTEM")
                .details("Initial seed data loaded successfully")
                .build());

        log.info("Seed data loaded successfully!");
    }
}
