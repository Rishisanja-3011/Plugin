package com.plugin.config;

import com.plugin.service.StationManagerDirectoryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class StationManagerDirectorySyncRunner implements ApplicationRunner {

    private final StationManagerDirectoryService stationManagerDirectoryService;

    @Override
    public void run(ApplicationArguments args) {
        try {
            stationManagerDirectoryService.syncApprovedApplications();
        } catch (DataAccessException ex) {
            log.warn("Skipping station manager directory sync because MongoDB is unavailable; type={}",
                    ex.getClass().getName());
        }
    }
}
