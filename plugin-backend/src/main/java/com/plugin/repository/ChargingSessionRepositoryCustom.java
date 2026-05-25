package com.plugin.repository;

import com.plugin.enums.SessionStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public interface ChargingSessionRepositoryCustom {
    boolean existsByCustomerIdAndStatusAndVehicleId(Long customerId, SessionStatus status, Long vehicleId);

    BigDecimal getTotalEnergyDelivered();

    BigDecimal getTotalEnergyDeliveredByManagerId(Long managerId);

    BigDecimal getTotalEnergyDeliveredByChargingPointIds(List<Long> chargingPointIds);

    BigDecimal getEnergyDeliveredInRange(LocalDateTime start, LocalDateTime end);
}
