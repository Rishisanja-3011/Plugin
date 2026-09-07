package com.plugin.service;

import com.plugin.entity.Bill;
import com.plugin.entity.Booking;
import com.plugin.entity.ChargingPoint;
import com.plugin.entity.ChargingSession;
import com.plugin.entity.Pricing;
import com.plugin.entity.Station;
import com.plugin.entity.User;
import com.plugin.entity.UserVehicle;
import com.plugin.repository.BookingRepository;
import com.plugin.repository.ChargingPointRepository;
import com.plugin.repository.ChargingSessionRepository;
import com.plugin.repository.StationRepository;
import com.plugin.repository.UserRepository;
import com.plugin.repository.UserVehicleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.function.Supplier;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class EntityReferenceResolver {

    private final UserRepository userRepository;
    private final StationRepository stationRepository;
    private final ChargingPointRepository chargingPointRepository;
    private final BookingRepository bookingRepository;
    private final ChargingSessionRepository chargingSessionRepository;
    private final UserVehicleRepository userVehicleRepository;

    private final ThreadLocal<ResolutionCache> cacheHolder = new ThreadLocal<>();

    public <T> T withCache(Supplier<T> supplier) {
        boolean owner = cacheHolder.get() == null;
        if (owner) {
            cacheHolder.set(new ResolutionCache());
        }
        try {
            return supplier.get();
        } finally {
            if (owner) {
                cacheHolder.remove();
            }
        }
    }

    public Pricing hydrate(Pricing pricing) {
        if (pricing == null) {
            return null;
        }
        pricing.setStation(resolveStation(pricing.getStation(), pricing.getStationId()));
        return pricing;
    }

    public ChargingPoint hydrate(ChargingPoint point) {
        if (point == null) {
            return null;
        }
        point.setStation(resolveStation(point.getStation(), point.getStationId()));
        return point;
    }

    public Booking hydrate(Booking booking) {
        if (booking == null) {
            return null;
        }
        booking.setCustomer(resolveUser(booking.getCustomer(), booking.getCustomerId()));
        booking.setStation(resolveStation(booking.getStation(), booking.getStationId()));
        booking.setChargingPoint(hydrate(resolveChargingPoint(booking.getChargingPoint(), booking.getChargingPointId())));
        booking.setVehicle(resolveVehicle(booking.getVehicle(), booking.getVehicleId()));
        return booking;
    }

    public ChargingSession hydrate(ChargingSession session) {
        if (session == null) {
            return null;
        }
        session.setBooking(hydrate(resolveBooking(session.getBooking(), session.getBookingId())));
        session.setChargingPoint(hydrate(resolveChargingPoint(session.getChargingPoint(), session.getChargingPointId())));
        session.setCustomer(resolveUser(session.getCustomer(), session.getCustomerId()));

        if (session.getBooking() != null) {
            if (session.getChargingPoint() == null) {
                session.setChargingPoint(session.getBooking().getChargingPoint());
            }
            if (session.getCustomer() == null) {
                session.setCustomer(session.getBooking().getCustomer());
            }
        }
        return session;
    }

    public Bill hydrate(Bill bill) {
        if (bill == null) {
            return null;
        }
        bill.setSession(hydrate(resolveSession(bill.getSession(), bill.getSessionId())));
        bill.setCustomer(resolveUser(bill.getCustomer(), bill.getCustomerId()));
        bill.setStation(resolveStation(bill.getStation(), bill.getStationId()));

        if (bill.getSession() != null) {
            if (bill.getCustomer() == null) {
                bill.setCustomer(bill.getSession().getCustomer());
            }
            if (bill.getStation() == null && bill.getSession().getChargingPoint() != null) {
                bill.setStation(bill.getSession().getChargingPoint().getStation());
            }
        }
        return bill;
    }

    public Bill hydrateBillSummary(Bill bill) {
        if (bill == null) {
            return null;
        }
        bill.setCustomer(resolveUser(bill.getCustomer(), bill.getCustomerId()));
        bill.setStation(resolveStation(bill.getStation(), bill.getStationId()));
        return bill;
    }

    public void preloadForBookings(List<Booking> bookings) {
        ResolutionCache cache = cacheHolder.get();
        if (cache == null || bookings == null || bookings.isEmpty()) {
            return;
        }

        preload(bookings.stream().map(Booking::getCustomerId).toList(), cache.users, userRepository::findByIdIn);
        preload(bookings.stream().map(Booking::getStationId).toList(), cache.stations, stationRepository::findByIdIn);
        preload(bookings.stream().map(Booking::getChargingPointId).toList(), cache.chargingPoints, chargingPointRepository::findByIdIn);
        preload(bookings.stream().map(Booking::getVehicleId).toList(), cache.vehicles, userVehicleRepository::findByIdIn);
    }

    public void preloadForSessions(List<ChargingSession> sessions) {
        ResolutionCache cache = cacheHolder.get();
        if (cache == null || sessions == null || sessions.isEmpty()) {
            return;
        }

        preload(sessions.stream().map(ChargingSession::getBookingId).toList(), cache.bookings, bookingRepository::findByIdIn);
        preload(sessions.stream().map(ChargingSession::getChargingPointId).toList(), cache.chargingPoints, chargingPointRepository::findByIdIn);
        preload(sessions.stream().map(ChargingSession::getCustomerId).toList(), cache.users, userRepository::findByIdIn);

        List<Booking> loadedBookings = sessions.stream()
                .map(ChargingSession::getBookingId)
                .filter(Objects::nonNull)
                .map(cache.bookings::get)
                .filter(Objects::nonNull)
                .toList();
        preloadForBookings(loadedBookings);

        List<ChargingPoint> loadedPoints = sessions.stream()
                .map(ChargingSession::getChargingPointId)
                .filter(Objects::nonNull)
                .map(cache.chargingPoints::get)
                .filter(Objects::nonNull)
                .toList();
        preload(loadedPoints.stream().map(ChargingPoint::getStationId).toList(), cache.stations, stationRepository::findByIdIn);
    }

    public User resolveUser(User current, Long id) {
        Long effectiveId = id != null ? id : current != null ? current.getId() : null;
        if (effectiveId != null) {
            User resolved = resolve(effectiveId, ResolutionCache::users, userRepository::findById);
            if (resolved != null) {
                return resolved;
            }
        }
        return current;
    }

    public Station resolveStation(Station current, Long id) {
        Long effectiveId = id != null ? id : current != null ? current.getId() : null;
        Station station = effectiveId != null
                ? resolve(effectiveId, ResolutionCache::stations, stationRepository::findById)
                : null;
        if (station == null) {
            station = current;
        }
        if (station != null && station.getManager() == null && station.getManagerId() != null) {
            station.setManager(resolveUser(null, station.getManagerId()));
        }
        return station;
    }

    public ChargingPoint resolveChargingPoint(ChargingPoint current, Long id) {
        Long effectiveId = id != null ? id : current != null ? current.getId() : null;
        if (effectiveId != null) {
            ChargingPoint resolved = resolve(
                    effectiveId, ResolutionCache::chargingPoints, chargingPointRepository::findById);
            if (resolved != null) {
                return resolved;
            }
        }
        return current;
    }

    public Booking resolveBooking(Booking current, Long id) {
        Long effectiveId = id != null ? id : current != null ? current.getId() : null;
        if (effectiveId != null) {
            Booking resolved = resolve(effectiveId, ResolutionCache::bookings, bookingRepository::findById);
            if (resolved != null) {
                return resolved;
            }
        }
        return current;
    }

    public ChargingSession resolveSession(ChargingSession current, Long id) {
        Long effectiveId = id != null ? id : current != null ? current.getId() : null;
        if (effectiveId != null) {
            ChargingSession resolved = resolve(
                    effectiveId, ResolutionCache::sessions, chargingSessionRepository::findById);
            if (resolved != null) {
                return resolved;
            }
        }
        return current;
    }

    public UserVehicle resolveVehicle(UserVehicle current, Long id) {
        Long effectiveId = id != null ? id : current != null ? current.getId() : null;
        if (effectiveId != null) {
            UserVehicle resolved = resolve(
                    effectiveId, ResolutionCache::vehicles, userVehicleRepository::findById);
            if (resolved != null) {
                return resolved;
            }
        }
        return current;
    }

    public UserVehicle resolveFirstVehicleForUser(Long userId) {
        if (userId == null) {
            return null;
        }
        ResolutionCache cache = cacheHolder.get();
        if (cache == null) {
            return userVehicleRepository.findFirstByUserIdOrderByCreatedAtAscIdAsc(userId).orElse(null);
        }
        if (!cache.firstVehiclesByUser.containsKey(userId)) {
            cache.firstVehiclesByUser.put(userId,
                    userVehicleRepository.findFirstByUserIdOrderByCreatedAtAscIdAsc(userId).orElse(null));
        }
        return cache.firstVehiclesByUser.get(userId);
    }

    private <T> T resolve(Long id,
                          Function<ResolutionCache, Map<Long, T>> cacheAccessor,
                          Function<Long, java.util.Optional<T>> loader) {
        if (id == null) {
            return null;
        }
        ResolutionCache cache = cacheHolder.get();
        if (cache == null) {
            return loader.apply(id).orElse(null);
        }
        Map<Long, T> cacheMap = cacheAccessor.apply(cache);
        if (!cacheMap.containsKey(id)) {
            cacheMap.put(id, loader.apply(id).orElse(null));
        }
        return cacheMap.get(id);
    }

    private <T> void preload(List<Long> ids, Map<Long, T> cacheMap, Function<List<Long>, List<T>> loader) {
        List<Long> missingIds = ids == null
                ? List.of()
                : ids.stream()
                        .filter(Objects::nonNull)
                        .distinct()
                        .filter(id -> !cacheMap.containsKey(id))
                        .toList();
        if (missingIds.isEmpty()) {
            return;
        }
        Map<Long, T> loadedById = loader.apply(missingIds).stream()
                .filter(Objects::nonNull)
                .collect(Collectors.toMap(this::extractId, Function.identity(), (left, right) -> left));
        for (Long id : missingIds) {
            cacheMap.put(id, loadedById.get(id));
        }
    }

    private Long extractId(Object value) {
        if (value instanceof User user) {
            return user.getId();
        }
        if (value instanceof Station station) {
            return station.getId();
        }
        if (value instanceof ChargingPoint chargingPoint) {
            return chargingPoint.getId();
        }
        if (value instanceof Booking booking) {
            return booking.getId();
        }
        if (value instanceof ChargingSession session) {
            return session.getId();
        }
        if (value instanceof UserVehicle vehicle) {
            return vehicle.getId();
        }
        return null;
    }

    private record ResolutionCache(
            Map<Long, User> users,
            Map<Long, Station> stations,
            Map<Long, ChargingPoint> chargingPoints,
            Map<Long, Booking> bookings,
            Map<Long, ChargingSession> sessions,
            Map<Long, UserVehicle> vehicles,
            Map<Long, UserVehicle> firstVehiclesByUser
    ) {
        private ResolutionCache() {
            this(new HashMap<>(), new HashMap<>(), new HashMap<>(), new HashMap<>(),
                    new HashMap<>(), new HashMap<>(), new HashMap<>());
        }
    }
}
