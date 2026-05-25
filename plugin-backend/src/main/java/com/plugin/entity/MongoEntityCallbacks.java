package com.plugin.entity;

import com.plugin.service.MongoSequenceService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.mapping.event.BeforeConvertCallback;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MongoEntityCallbacks implements BeforeConvertCallback<Object> {

    private final MongoSequenceService sequenceService;

    @Override
    public Object onBeforeConvert(Object entity, String collection) {
        if (entity instanceof AuditLog auditLog) {
            assignId(auditLog, collection);
            initialize(auditLog);
        } else if (entity instanceof Bill bill) {
            assignId(bill, collection);
            syncReferences(bill);
            initialize(bill);
        } else if (entity instanceof Booking booking) {
            assignId(booking, collection);
            syncReferences(booking);
            initialize(booking);
        } else if (entity instanceof ChargingPoint chargingPoint) {
            assignId(chargingPoint, collection);
            syncReferences(chargingPoint);
            initialize(chargingPoint);
        } else if (entity instanceof ChargingSession chargingSession) {
            assignId(chargingSession, collection);
            syncReferences(chargingSession);
            initialize(chargingSession);
        } else if (entity instanceof Notification notification) {
            assignId(notification, collection);
            syncReferences(notification);
            initialize(notification);
        } else if (entity instanceof PasswordResetOtp otp) {
            assignId(otp, collection);
            initialize(otp);
        } else if (entity instanceof PendingRegistration pendingRegistration) {
            assignId(pendingRegistration, collection);
            initialize(pendingRegistration);
        } else if (entity instanceof Pricing pricing) {
            assignId(pricing, collection);
            syncReferences(pricing);
            initialize(pricing);
        } else if (entity instanceof Station station) {
            assignId(station, collection);
            syncReferences(station);
            initialize(station);
        } else if (entity instanceof StationManagerApplication application) {
            assignId(application, collection);
            initialize(application);
            prepareApplicationChildren(application);
        } else if (entity instanceof StationManagerApplicationDocument document) {
            assignId(document, collection);
            if (document.getApplication() != null) {
                document.setApplication(document.getApplication());
            }
        } else if (entity instanceof StationManagerApplicationFile file) {
            assignId(file, collection);
            initialize(file);
            if (file.getApplication() != null) {
                file.setApplication(file.getApplication());
            }
        } else if (entity instanceof StationManager manager) {
            assignId(manager, collection);
            initialize(manager);
        } else if (entity instanceof User user) {
            assignId(user, collection);
            initialize(user);
        } else if (entity instanceof UserVehicle vehicle) {
            assignId(vehicle, collection);
            syncReferences(vehicle);
            initialize(vehicle);
        }
        return entity;
    }

    private void syncReferences(Bill entity) {
        if (entity.getSession() != null) {
            entity.setSessionId(entity.getSession().getId());
        }
        if (entity.getCustomer() != null) {
            entity.setCustomerId(entity.getCustomer().getId());
        }
        if (entity.getStation() != null) {
            entity.setStationId(entity.getStation().getId());
        }
    }

    private void syncReferences(Booking entity) {
        if (entity.getCustomer() != null) {
            entity.setCustomerId(entity.getCustomer().getId());
        }
        if (entity.getStation() != null) {
            entity.setStationId(entity.getStation().getId());
        }
        if (entity.getChargingPoint() != null) {
            entity.setChargingPointId(entity.getChargingPoint().getId());
        }
        if (entity.getVehicle() != null) {
            entity.setVehicleId(entity.getVehicle().getId());
        }
    }

    private void syncReferences(ChargingPoint entity) {
        if (entity.getStation() != null) {
            entity.setStationId(entity.getStation().getId());
        }
    }

    private void syncReferences(ChargingSession entity) {
        if (entity.getBooking() != null) {
            entity.setBookingId(entity.getBooking().getId());
        }
        if (entity.getChargingPoint() != null) {
            entity.setChargingPointId(entity.getChargingPoint().getId());
        }
        if (entity.getCustomer() != null) {
            entity.setCustomerId(entity.getCustomer().getId());
        }
    }

    private void syncReferences(Notification entity) {
        if (entity.getUser() != null) {
            entity.setUserId(entity.getUser().getId());
        }
    }

    private void syncReferences(Pricing entity) {
        if (entity.getStation() != null) {
            entity.setStationId(entity.getStation().getId());
        }
    }

    private void syncReferences(Station entity) {
        if (entity.getManager() != null) {
            entity.setManagerId(entity.getManager().getId());
        }
    }

    private void syncReferences(UserVehicle entity) {
        if (entity.getUser() != null) {
            entity.setUserId(entity.getUser().getId());
        }
    }

    private void prepareApplicationChildren(StationManagerApplication application) {
        application.getBusinessDocuments().forEach(document -> {
            assignId(document, "stationManagerApplicationDocuments");
            document.setApplication(application);
        });
        application.getUploadedFiles().forEach(file -> {
            assignId(file, "stationManagerApplicationFiles");
            file.setApplication(application);
            initialize(file);
        });
    }

    private void initialize(AuditLog entity) {
        if (entity.getCreatedAt() == null) {
            entity.onCreate();
        }
    }

    private void initialize(Bill entity) {
        if (entity.getCreatedAt() == null) {
            entity.onCreate();
        }
    }

    private void initialize(Booking entity) {
        if (entity.getCreatedAt() == null) {
            entity.onCreate();
        } else {
            entity.onUpdate();
        }
    }

    private void initialize(ChargingPoint entity) {
        if (entity.getCreatedAt() == null) {
            entity.onCreate();
        } else {
            entity.onUpdate();
        }
    }

    private void initialize(ChargingSession entity) {
        if (entity.getCreatedAt() == null) {
            entity.onCreate();
        }
    }

    private void initialize(Notification entity) {
        if (entity.getCreatedAt() == null) {
            entity.onCreate();
        }
    }

    private void initialize(PasswordResetOtp entity) {
        if (entity.getCreatedAt() == null) {
            entity.onCreate();
        }
    }

    private void initialize(PendingRegistration entity) {
        if (entity.getCreatedAt() == null) {
            entity.onCreate();
        }
    }

    private void initialize(Pricing entity) {
        if (entity.getCreatedAt() == null) {
            entity.onCreate();
        } else {
            entity.onUpdate();
        }
    }

    private void initialize(Station entity) {
        if (entity.getCreatedAt() == null) {
            entity.onCreate();
        } else {
            entity.onUpdate();
        }
    }

    private void initialize(StationManagerApplication entity) {
        if (entity.getCreatedAt() == null) {
            entity.onCreate();
        } else {
            entity.onUpdate();
        }
    }

    private void initialize(StationManagerApplicationFile entity) {
        if (entity.getCreatedAt() == null) {
            entity.onCreate();
        } else {
            entity.onUpdate();
        }
    }

    private void initialize(StationManager entity) {
        if (entity.getCreatedAt() == null) {
            entity.onCreate();
        } else {
            entity.onUpdate();
        }
    }

    private void initialize(User entity) {
        if (entity.getCreatedAt() == null) {
            entity.onCreate();
        } else {
            entity.onUpdate();
        }
    }

    private void initialize(UserVehicle entity) {
        if (entity.getCreatedAt() == null) {
            entity.onCreate();
        } else {
            entity.onUpdate();
        }
    }

    private void assignId(AuditLog entity, String collection) {
        if (entity.getId() == null) {
            entity.setId(sequenceService.nextId(collection));
        }
    }

    private void assignId(Bill entity, String collection) {
        if (entity.getId() == null) {
            entity.setId(sequenceService.nextId(collection));
        }
    }

    private void assignId(Booking entity, String collection) {
        if (entity.getId() == null) {
            entity.setId(sequenceService.nextId(collection));
        }
    }

    private void assignId(ChargingPoint entity, String collection) {
        if (entity.getId() == null) {
            entity.setId(sequenceService.nextId(collection));
        }
    }

    private void assignId(ChargingSession entity, String collection) {
        if (entity.getId() == null) {
            entity.setId(sequenceService.nextId(collection));
        }
    }

    private void assignId(Notification entity, String collection) {
        if (entity.getId() == null) {
            entity.setId(sequenceService.nextId(collection));
        }
    }

    private void assignId(PasswordResetOtp entity, String collection) {
        if (entity.getId() == null) {
            entity.setId(sequenceService.nextId(collection));
        }
    }

    private void assignId(PendingRegistration entity, String collection) {
        if (entity.getId() == null) {
            entity.setId(sequenceService.nextId(collection));
        }
    }

    private void assignId(Pricing entity, String collection) {
        if (entity.getId() == null) {
            entity.setId(sequenceService.nextId(collection));
        }
    }

    private void assignId(Station entity, String collection) {
        if (entity.getId() == null) {
            entity.setId(sequenceService.nextId(collection));
        }
    }

    private void assignId(StationManagerApplication entity, String collection) {
        if (entity.getId() == null) {
            entity.setId(sequenceService.nextId(collection));
        }
    }

    private void assignId(StationManagerApplicationDocument entity, String collection) {
        if (entity.getId() == null) {
            entity.setId(sequenceService.nextId(collection));
        }
    }

    private void assignId(StationManagerApplicationFile entity, String collection) {
        if (entity.getId() == null) {
            entity.setId(sequenceService.nextId(collection));
        }
    }

    private void assignId(StationManager entity, String collection) {
        if (entity.getId() == null) {
            entity.setId(sequenceService.nextId(collection));
        }
    }

    private void assignId(User entity, String collection) {
        if (entity.getId() == null) {
            entity.setId(sequenceService.nextId(collection));
        }
    }

    private void assignId(UserVehicle entity, String collection) {
        if (entity.getId() == null) {
            entity.setId(sequenceService.nextId(collection));
        }
    }
}
