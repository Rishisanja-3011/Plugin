package com.plugin.config;

import com.plugin.service.StationManagerDirectoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class StationManagerDirectorySyncRunner implements ApplicationRunner {

    private final StationManagerDirectoryService stationManagerDirectoryService;

    @Override
    public void run(ApplicationArguments args) {
        stationManagerDirectoryService.syncApprovedApplications();
    }
}
