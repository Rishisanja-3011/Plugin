package com.plugin.service;

import com.plugin.dto.response.AdminCustomerResponse;
import com.plugin.entity.User;
import com.plugin.enums.BookingStatus;
import com.plugin.enums.Role;
import com.plugin.exception.BadRequestException;
import com.plugin.exception.ResourceNotFoundException;
import com.plugin.repository.BookingRepository;
import com.plugin.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminCustomerService {

    private final UserRepository userRepository;
    private final BookingRepository bookingRepository;
    private final AuditService auditService;

    public Page<AdminCustomerResponse> getCustomers(Pageable pageable, String name, Boolean active) {
        String normalizedName = name == null ? null : name.trim();
        boolean hasName = normalizedName != null && !normalizedName.isEmpty();

        if (active != null && hasName) {
            return userRepository.findByRoleAndActiveAndFullNameContainingIgnoreCase(
                    Role.CUSTOMER, active, normalizedName, pageable
            ).map(this::toResponse);
        }

        if (active != null) {
            return userRepository.findByRoleAndActive(Role.CUSTOMER, active, pageable)
                    .map(this::toResponse);
        }

        if (hasName) {
            return userRepository.findByRoleAndFullNameContainingIgnoreCase(
                    Role.CUSTOMER, normalizedName, pageable
            ).map(this::toResponse);
        }

        return userRepository.findByRole(Role.CUSTOMER, pageable).map(this::toResponse);
    }

    @Transactional
    public AdminCustomerResponse updateCustomerStatus(Long customerId, boolean active, String actor) {
        User customer = userRepository.findById(customerId)
                .orElseThrow(() -> new ResourceNotFoundException("Customer not found"));

        if (customer.getRole() != Role.CUSTOMER) {
            throw new BadRequestException("Only customer accounts can be updated");
        }

        customer.setActive(active);
        customer = userRepository.save(customer);

        try {
            auditService.log(
                    "UPDATE_CUSTOMER_STATUS",
                    "USER",
                    customer.getId(),
                    actor,
                    "Customer account set to " + (active ? "ACTIVE" : "DEACTIVATED")
            );
        } catch (Exception ignored) {
        }

        return toResponse(customer);
    }

    private AdminCustomerResponse toResponse(User user) {
        long completedBookings = bookingRepository.countByCustomerIdAndStatus(user.getId(), BookingStatus.COMPLETED);
        long cancelledBookings = bookingRepository.countByCustomerIdAndStatus(user.getId(), BookingStatus.CANCELLED);
        long activeBookings =
                bookingRepository.countByCustomerIdAndStatus(user.getId(), BookingStatus.CONFIRMED)
                + bookingRepository.countByCustomerIdAndStatus(user.getId(), BookingStatus.MODIFIED);

        return AdminCustomerResponse.builder()
                .id(user.getId())
                .fullName(user.getFullName())
                .email(user.getEmail())
                .phone(user.getPhone())
                .vehicleMake(user.getVehicleMake())
                .vehicleModel(user.getVehicleModel())
                .vehicleRegistration(user.getVehicleRegistration())
                .active(Boolean.TRUE.equals(user.getActive()))
                .createdAt(user.getCreatedAt())
                .totalBookings(bookingRepository.countByCustomerId(user.getId()))
                .completedBookings(completedBookings)
                .cancelledBookings(cancelledBookings)
                .activeBookings(activeBookings)
                .build();
    }
}
