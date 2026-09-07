package com.plugin.service;

import com.plugin.dto.response.AdminCustomerResponse;
import com.plugin.entity.User;
import com.plugin.enums.BookingStatus;
import com.plugin.enums.Role;
import com.plugin.exception.BadRequestException;
import com.plugin.exception.ResourceNotFoundException;
import com.plugin.repository.BookingRepository;
import com.plugin.repository.BookingRepositoryCustom;
import com.plugin.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AdminCustomerService {

    private final UserRepository userRepository;
    private final BookingRepository bookingRepository;
    private final AuditService auditService;

    public Page<AdminCustomerResponse> getCustomers(Pageable pageable, String name, Boolean active) {
        String normalizedName = name == null ? null : name.trim();
        if (normalizedName != null && normalizedName.length() > 100) {
            throw new BadRequestException("Customer search must not exceed 100 characters");
        }
        boolean hasName = normalizedName != null && !normalizedName.isEmpty();

        if (active != null && hasName) {
            return toResponsePage(userRepository.findByRoleAndActiveAndFullNameContainingIgnoreCase(
                    Role.CUSTOMER, active, normalizedName, pageable
            ), pageable);
        }

        if (active != null) {
            return toResponsePage(userRepository.findByRoleAndActive(Role.CUSTOMER, active, pageable), pageable);
        }

        if (hasName) {
            return toResponsePage(userRepository.findByRoleAndFullNameContainingIgnoreCase(
                    Role.CUSTOMER, normalizedName, pageable
            ), pageable);
        }

        return toResponsePage(userRepository.findByRole(Role.CUSTOMER, pageable), pageable);
    }

    @Transactional
    public AdminCustomerResponse updateCustomerStatus(Long customerId, boolean active, String actor) {
        User customer = userRepository.findById(customerId)
                .orElseThrow(() -> new ResourceNotFoundException("Customer not found"));

        if (customer.getRole() != Role.CUSTOMER) {
            throw new BadRequestException("Only customer accounts can be updated");
        }

        if (!java.util.Objects.equals(customer.getActive(), active)) {
            customer.setActive(active);
            customer.revokeSessions();
        }
        customer = userRepository.save(customer);

        auditService.log(
                "UPDATE_CUSTOMER_STATUS",
                "USER",
                customer.getId(),
                actor,
                "Customer account set to " + (active ? "ACTIVE" : "DEACTIVATED")
        );

        return toResponse(customer);
    }

    private Page<AdminCustomerResponse> toResponsePage(Page<User> page, Pageable pageable) {
        List<User> users = page.getContent();
        List<Long> customerIds = users.stream().map(User::getId).toList();
        Map<Long, BookingRepositoryCustom.CustomerBookingCounts> bookingCounts =
                bookingRepository.countBookingsByCustomerIds(customerIds);
        List<AdminCustomerResponse> content = users.stream()
                .map(user -> toResponse(user, bookingCounts.getOrDefault(
                        user.getId(),
                        new BookingRepositoryCustom.CustomerBookingCounts(0, 0, 0, 0)
                )))
                .toList();
        return new PageImpl<>(content, pageable, page.getTotalElements());
    }

    private AdminCustomerResponse toResponse(User user) {
        return toResponse(user, new BookingRepositoryCustom.CustomerBookingCounts(
                bookingRepository.countByCustomerId(user.getId()),
                bookingRepository.countByCustomerIdAndStatus(user.getId(), BookingStatus.COMPLETED),
                bookingRepository.countByCustomerIdAndStatus(user.getId(), BookingStatus.CANCELLED),
                bookingRepository.countByCustomerIdAndStatus(user.getId(), BookingStatus.CONFIRMED)
                        + bookingRepository.countByCustomerIdAndStatus(user.getId(), BookingStatus.MODIFIED)
        ));
    }

    private AdminCustomerResponse toResponse(User user, BookingRepositoryCustom.CustomerBookingCounts counts) {
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
                .totalBookings(counts.total())
                .completedBookings(counts.completed())
                .cancelledBookings(counts.cancelled())
                .activeBookings(counts.active())
                .build();
    }
}
