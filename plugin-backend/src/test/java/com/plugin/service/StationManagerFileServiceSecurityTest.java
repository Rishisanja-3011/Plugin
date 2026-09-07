package com.plugin.service;

import com.plugin.entity.StationManagerApplication;
import com.plugin.entity.StationManagerApplicationFile;
import com.plugin.enums.StationManagerFileSlot;
import com.plugin.exception.BadRequestException;
import com.plugin.repository.StationManagerApplicationFileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.util.Base64;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StationManagerFileServiceSecurityTest {

    private static final byte[] ONE_PIXEL_PNG = Base64.getDecoder().decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
    );

    @Mock
    private StationManagerApplicationFileRepository fileRepository;

    private StationManagerFileService fileService;

    @BeforeEach
    void setUp() {
        fileService = new StationManagerFileService(fileRepository);
    }

    @Test
    void rejectsHtmlDisguisedAsPdf() {
        MockMultipartFile file = new MockMultipartFile(
                "governmentIdDocument",
                "proof.pdf",
                "text/html",
                "<html><script>alert(1)</script></html>".getBytes()
        );

        assertThrows(BadRequestException.class, () -> fileService.validateUpload(file));
    }

    @Test
    void rejectsSvgAndMimeSpoofing() {
        MockMultipartFile svg = new MockMultipartFile(
                "sitePhoto",
                "site.svg",
                "image/svg+xml",
                "<svg onload=alert(1)></svg>".getBytes()
        );
        MockMultipartFile mismatchedPng = new MockMultipartFile(
                "sitePhoto",
                "site.png",
                "image/jpeg",
                ONE_PIXEL_PNG
        );

        assertThrows(BadRequestException.class, () -> fileService.validateUpload(svg));
        assertThrows(BadRequestException.class, () -> fileService.validateUpload(mismatchedPng));
    }

    @Test
    void rejectsActivePdfAndOversizedFile() {
        MockMultipartFile activePdf = new MockMultipartFile(
                "bankProof",
                "bank.pdf",
                "application/pdf",
                "%PDF-1.4\n1 0 obj<</JavaScript(alert(1))>>endobj\n%%EOF".getBytes()
        );
        MockMultipartFile oversized = new MockMultipartFile(
                "bankProof",
                "bank.pdf",
                "application/pdf",
                new byte[(int) StationManagerFileService.MAX_FILE_SIZE_BYTES + 1]
        );

        assertThrows(BadRequestException.class, () -> fileService.validateUpload(activePdf));
        assertThrows(BadRequestException.class, () -> fileService.validateUpload(oversized));
    }

    @Test
    void reencodesImageAndUsesServerGeneratedFilename() {
        StationManagerApplication application = StationManagerApplication.builder().id(10L).build();
        MockMultipartFile image = new MockMultipartFile(
                "governmentIdDocument",
                "personal-name.png",
                "image/png",
                ONE_PIXEL_PNG
        );
        when(fileRepository.findByApplicationIdAndSlotType(10L, StationManagerFileSlot.GOVERNMENT_ID_DOCUMENT))
                .thenReturn(Optional.empty());
        when(fileRepository.save(any(StationManagerApplicationFile.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        String storedName = fileService.upsertStandardFile(
                application,
                StationManagerFileSlot.GOVERNMENT_ID_DOCUMENT,
                image
        );

        assertTrue(storedName.matches("kyc-government-id-document-[0-9a-f-]+\\.png"));
        assertFalse(storedName.contains("personal-name"));
    }

    @Test
    void acceptsPassiveCompletePdf() {
        byte[] bytes = "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF".getBytes();
        MockMultipartFile file = new MockMultipartFile(
                "bankProof",
                "bank.pdf",
                "application/pdf",
                bytes
        );

        fileService.validateUpload(file);
        assertEquals(bytes.length, file.getSize());
    }
}
