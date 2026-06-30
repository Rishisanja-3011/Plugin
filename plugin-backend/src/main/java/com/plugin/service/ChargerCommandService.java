package com.plugin.service;

import com.plugin.entity.ChargingSession;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class ChargerCommandService {

    public void stopTransaction(ChargingSession session, String reason) {
        Long sessionId = session != null ? session.getId() : null;
        String connector = session != null && session.getChargingPoint() != null
                ? session.getChargingPoint().getIdentifier()
                : "unknown";
        log.warn("Stop Transaction requested for session {} on connector {}. Reason: {}",
                sessionId, connector, reason);
    }
}
