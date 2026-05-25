package com.plugin.service;

import com.plugin.entity.Station;
import com.plugin.entity.StationManager;
import com.plugin.entity.StationManagerApplication;
import com.plugin.entity.User;
import com.plugin.enums.StationManagerApplicationStatus;
import com.plugin.repository.StationManagerApplicationRepository;
import com.plugin.repository.StationRepository;
import com.plugin.repository.StationManagerRepository;
import com.plugin.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class StationManagerDirectoryService {

    private final StationManagerApplicationRepository applicationRepository;
    private final StationRepository stationRepository;
    private final UserRepository userRepository;
    private final StationManagerRepository stationManagerRepository;

    @Transactional
    public void syncApprovedApplications() {
        applicationRepository.findByStatus(StationManagerApplicationStatus.APPROVED)
                .forEach(this::upsertFromApplication);
    }

    @Transactional
    public void upsertFromApplication(StationManagerApplication application) {
        if (application == null || application.getId() == null) {
            return;
        }
        if (application.getStatus() == StationManagerApplicationStatus.APPROVED) {
            application = ensureStationLink(application);
        }
        if (application.getStatus() != StationManagerApplicationStatus.APPROVED
                || application.getApprovedStation() == null) {
            deleteByApplicationId(application.getId());
            return;
        }

        Long applicationId = application.getId();
        StationManager manager = stationManagerRepository.findByApplicationId(applicationId)
                .orElseGet(() -> StationManager.builder()
                        .applicationId(applicationId)
                        .build());

        User user = application.getUser();
        Station station = application.getApprovedStation();

        manager.setApplicationId(application.getId());
        manager.setUserId(user != null ? user.getId() : null);
        manager.setApprovedStationId(station != null ? station.getId() : null);
        manager.setApplicationReferenceId(application.getApplicationReferenceId());
        manager.setFullName(application.getFullName());
        manager.setEmail(application.getEmail());
        manager.setPortalEmail(user != null ? user.getEmail() : null);
        manager.setPhone(application.getPhone());
        manager.setStatus(application.getStatus());
        manager.setBusinessType(application.getBusinessType());
        manager.setBusinessName(application.getBusinessName());
        manager.setStationName(application.getStationName());
        manager.setStationCity(application.getStationCity());
        manager.setStationState(application.getStationState());
        manager.setPortalAccessReady(user != null && application.getCredentialsIssuedAt() != null);
        manager.setSubmittedAt(application.getSubmittedAt());
        manager.setReviewedAt(application.getReviewedAt());
        manager.setCredentialsIssuedAt(application.getCredentialsIssuedAt());

        stationManagerRepository.save(manager);
    }

    private StationManagerApplication ensureStationLink(StationManagerApplication application) {
        if (application.getApprovedStation() != null) {
            return application;
        }

        Optional<Station> station = findMatchingStation(application);
        if (station.isEmpty()) {
            return application;
        }

        Station matchedStation = station.get();
        User managerUser = resolveManagerUser(application, matchedStation).orElse(null);
        if (managerUser != null) {
            application.setUser(managerUser);
            matchedStation.setManager(managerUser);
            matchedStation = stationRepository.save(matchedStation);
        }

        application.setApprovedStation(matchedStation);
        return applicationRepository.save(application);
    }

    private Optional<User> resolveManagerUser(StationManagerApplication application, Station station) {
        if (application.getUser() != null) {
            return Optional.of(application.getUser());
        }
        if (station.getManager() != null) {
            return Optional.of(station.getManager());
        }
        if (station.getManagerId() != null) {
            Optional<User> byStationManagerId = userRepository.findById(station.getManagerId());
            if (byStationManagerId.isPresent()) {
                return byStationManagerId;
            }
        }
        if (application.getEmail() != null && !application.getEmail().isBlank()) {
            return userRepository.findByEmail(application.getEmail().trim().toLowerCase(Locale.ROOT));
        }
        return Optional.empty();
    }

    private Optional<Station> findMatchingStation(StationManagerApplication application) {
        String applicationStation = normalizeKey(application.getStationName());
        String applicationCity = normalizeKey(application.getStationCity());
        String applicationEmail = normalizeKey(application.getEmail());

        return stationRepository.findAll().stream()
                .filter(station -> {
                    String stationName = normalizeKey(station.getName());
                    String stationCity = normalizeKey(station.getCity());
                    String stationEmail = normalizeKey(station.getContactEmail());

                    boolean contactEmailMatches = applicationEmail != null && applicationEmail.equals(stationEmail);
                    boolean stationNameMatches = applicationStation != null && applicationStation.equals(stationName);
                    boolean cityMatches = applicationCity == null || applicationCity.equals(stationCity);
                    return contactEmailMatches || (stationNameMatches && cityMatches);
                })
                .findFirst();
    }

    private String normalizeKey(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        return normalized.isEmpty() ? null : normalized;
    }

    @Transactional
    public void deleteByApplicationId(Long applicationId) {
        if (applicationId != null) {
            stationManagerRepository.deleteByApplicationId(applicationId);
        }
    }
}
