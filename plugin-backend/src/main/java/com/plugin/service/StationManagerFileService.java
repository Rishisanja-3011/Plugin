package com.plugin.service;

import com.plugin.entity.StationManagerApplication;
import com.plugin.entity.StationManagerApplicationFile;
import com.plugin.enums.StationManagerBusinessDocumentType;
import com.plugin.enums.StationManagerFileSlot;
import com.plugin.exception.BadRequestException;
import com.plugin.exception.ResourceNotFoundException;
import com.plugin.repository.StationManagerApplicationFileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class StationManagerFileService {

    public static final long MAX_FILE_SIZE_BYTES = 10L * 1024L * 1024L;
    public static final long MAX_TOTAL_UPLOAD_SIZE_BYTES = 50L * 1024L * 1024L;
    private static final long MAX_IMAGE_PIXELS = 20_000_000L;
    private static final int MAX_IMAGE_DIMENSION = 10_000;
    private static final byte[] PDF_SIGNATURE = "%PDF-".getBytes(StandardCharsets.US_ASCII);
    private static final byte[] PNG_SIGNATURE = new byte[]{
            (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A
    };

    public record DownloadedFile(byte[] data, String fileName, String contentType) {}

    private final StationManagerApplicationFileRepository fileRepository;

    public void validateUpload(MultipartFile file) {
        if (file != null && !file.isEmpty()) {
            validateAndSanitize(file);
        }
    }

    @Transactional
    public String upsertStandardFile(StationManagerApplication application,
                                     StationManagerFileSlot slotType,
                                     MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return null;
        }

        StationManagerApplicationFile entity = fileRepository.findByApplicationIdAndSlotType(application.getId(), slotType)
                .orElse(StationManagerApplicationFile.builder()
                        .application(application)
                        .slotType(slotType)
                        .build());
        applyFile(entity, file);
        return fileRepository.save(entity).getOriginalFileName();
    }

    @Transactional
    public String upsertBusinessDocumentFile(StationManagerApplication application,
                                             StationManagerBusinessDocumentType documentType,
                                             MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return null;
        }

        StationManagerApplicationFile entity = fileRepository
                .findByApplicationIdAndSlotTypeAndBusinessDocumentType(application.getId(), StationManagerFileSlot.BUSINESS_DOCUMENT, documentType)
                .orElse(StationManagerApplicationFile.builder()
                        .application(application)
                        .slotType(StationManagerFileSlot.BUSINESS_DOCUMENT)
                        .businessDocumentType(documentType)
                        .build());
        applyFile(entity, file);
        return fileRepository.save(entity).getOriginalFileName();
    }

    @Transactional(readOnly = true)
    public boolean hasStandardFile(Long applicationId, StationManagerFileSlot slotType) {
        return fileRepository.findByApplicationIdAndSlotType(applicationId, slotType).isPresent();
    }

    @Transactional(readOnly = true)
    public boolean hasBusinessDocumentFile(Long applicationId, StationManagerBusinessDocumentType documentType) {
        return fileRepository.findByApplicationIdAndSlotTypeAndBusinessDocumentType(
                applicationId,
                StationManagerFileSlot.BUSINESS_DOCUMENT,
                documentType
        ).isPresent();
    }

    @Transactional
    public void deleteMissingBusinessDocumentFiles(Long applicationId, Set<StationManagerBusinessDocumentType> activeTypes) {
        List<StationManagerApplicationFile> existing = fileRepository.findAllByApplicationIdAndSlotType(applicationId, StationManagerFileSlot.BUSINESS_DOCUMENT);
        for (StationManagerApplicationFile file : existing) {
            if (file.getBusinessDocumentType() == null || !activeTypes.contains(file.getBusinessDocumentType())) {
                fileRepository.delete(file);
            }
        }
    }

    @Transactional(readOnly = true)
    public DownloadedFile getStandardFile(Long applicationId, StationManagerFileSlot slotType) {
        StationManagerApplicationFile file = fileRepository.findByApplicationIdAndSlotType(applicationId, slotType)
                .orElseThrow(() -> new ResourceNotFoundException("Application file not found"));
        return new DownloadedFile(file.getFileData(), file.getOriginalFileName(), file.getContentType());
    }

    @Transactional(readOnly = true)
    public DownloadedFile getBusinessDocumentFile(Long applicationId, StationManagerBusinessDocumentType documentType) {
        StationManagerApplicationFile file = fileRepository
                .findByApplicationIdAndSlotTypeAndBusinessDocumentType(applicationId, StationManagerFileSlot.BUSINESS_DOCUMENT, documentType)
                .orElseThrow(() -> new ResourceNotFoundException("Business document file not found"));
        return new DownloadedFile(file.getFileData(), file.getOriginalFileName(), file.getContentType());
    }

    private void applyFile(StationManagerApplicationFile entity, MultipartFile file) {
        SanitizedUpload upload = validateAndSanitize(file);
        String slot = entity.getBusinessDocumentType() != null
                ? entity.getBusinessDocumentType().name()
                : entity.getSlotType().name();
        String storedName = "kyc-" + slot.toLowerCase(Locale.ROOT).replace('_', '-')
                + "-" + UUID.randomUUID() + upload.extension();

        entity.setOriginalFileName(storedName);
        entity.setContentType(upload.contentType());
        entity.setFileSize((long) upload.data().length);
        entity.setFileData(upload.data());
    }

    private SanitizedUpload validateAndSanitize(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Uploaded file is empty.");
        }
        if (file.getSize() <= 0 || file.getSize() > MAX_FILE_SIZE_BYTES) {
            throw new BadRequestException("Each uploaded file must be 10 MB or smaller.");
        }

        byte[] data;
        try {
            data = file.getBytes();
        } catch (IOException ex) {
            throw new BadRequestException("Failed to read uploaded file.");
        }
        if (data.length == 0 || data.length > MAX_FILE_SIZE_BYTES) {
            throw new BadRequestException("Each uploaded file must be 10 MB or smaller.");
        }

        DetectedType detected = detectType(data);
        validateDeclaredType(file, detected);
        if (detected == DetectedType.PDF) {
            validatePassivePdf(data);
            return new SanitizedUpload(data, ".pdf", MediaTypeNames.PDF);
        }

        return sanitizeImage(data, detected);
    }

    private DetectedType detectType(byte[] data) {
        if (startsWith(data, PDF_SIGNATURE)) {
            return DetectedType.PDF;
        }
        if (startsWith(data, PNG_SIGNATURE)) {
            return DetectedType.PNG;
        }
        if (data.length >= 3
                && (data[0] & 0xFF) == 0xFF
                && (data[1] & 0xFF) == 0xD8
                && (data[2] & 0xFF) == 0xFF) {
            return DetectedType.JPEG;
        }
        throw new BadRequestException("Only genuine PDF, PNG, and JPEG files are allowed.");
    }

    private void validateDeclaredType(MultipartFile file, DetectedType detected) {
        String originalName = file.getOriginalFilename() == null
                ? ""
                : file.getOriginalFilename().trim().toLowerCase(Locale.ROOT);
        if (originalName.contains("\r") || originalName.contains("\n") || originalName.indexOf('\0') >= 0) {
            throw new BadRequestException("Invalid uploaded filename.");
        }
        boolean extensionMatches = switch (detected) {
            case PDF -> originalName.endsWith(".pdf");
            case PNG -> originalName.endsWith(".png");
            case JPEG -> originalName.endsWith(".jpg") || originalName.endsWith(".jpeg");
        };
        if (!extensionMatches) {
            throw new BadRequestException("The filename extension does not match the uploaded file.");
        }

        String declared = file.getContentType() == null
                ? ""
                : file.getContentType().split(";", 2)[0].trim().toLowerCase(Locale.ROOT);
        if (declared.isBlank() || "application/octet-stream".equals(declared)) {
            return;
        }
        boolean mimeMatches = switch (detected) {
            case PDF -> MediaTypeNames.PDF.equals(declared);
            case PNG -> MediaTypeNames.PNG.equals(declared);
            case JPEG -> MediaTypeNames.JPEG.equals(declared) || "image/jpg".equals(declared);
        };
        if (!mimeMatches) {
            throw new BadRequestException("The declared file type does not match the uploaded file.");
        }
    }

    private SanitizedUpload sanitizeImage(byte[] data, DetectedType detected) {
        validateImageDimensionsBeforeDecode(data, detected);
        try (ByteArrayInputStream input = new ByteArrayInputStream(data);
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            BufferedImage decoded = ImageIO.read(input);
            if (decoded == null || decoded.getWidth() <= 0 || decoded.getHeight() <= 0) {
                throw new BadRequestException("The uploaded image is corrupt or unsupported.");
            }
            BufferedImage safeImage = decoded;
            String format;
            String extension;
            String contentType;
            if (detected == DetectedType.JPEG) {
                safeImage = new BufferedImage(decoded.getWidth(), decoded.getHeight(), BufferedImage.TYPE_INT_RGB);
                Graphics2D graphics = safeImage.createGraphics();
                try {
                    graphics.drawImage(decoded, 0, 0, null);
                } finally {
                    graphics.dispose();
                }
                format = "jpg";
                extension = ".jpg";
                contentType = MediaTypeNames.JPEG;
            } else {
                format = "png";
                extension = ".png";
                contentType = MediaTypeNames.PNG;
            }

            if (!ImageIO.write(safeImage, format, output)) {
                throw new BadRequestException("The uploaded image could not be sanitized.");
            }
            byte[] sanitized = output.toByteArray();
            if (sanitized.length == 0 || sanitized.length > MAX_FILE_SIZE_BYTES) {
                throw new BadRequestException("The sanitized image is too large.");
            }
            return new SanitizedUpload(sanitized, extension, contentType);
        } catch (BadRequestException ex) {
            throw ex;
        } catch (IOException | RuntimeException ex) {
            throw new BadRequestException("The uploaded image is corrupt or unsupported.");
        }
    }

    private void validateImageDimensionsBeforeDecode(byte[] data, DetectedType detected) {
        ImageReader reader = null;
        try (ImageInputStream imageInput = ImageIO.createImageInputStream(new ByteArrayInputStream(data))) {
            if (imageInput == null) {
                throw new BadRequestException("The uploaded image is corrupt or unsupported.");
            }
            Iterator<ImageReader> readers = ImageIO.getImageReaders(imageInput);
            if (!readers.hasNext()) {
                throw new BadRequestException("The uploaded image is corrupt or unsupported.");
            }
            reader = readers.next();
            String format = reader.getFormatName().toLowerCase(Locale.ROOT);
            boolean formatMatches = detected == DetectedType.PNG
                    ? "png".equals(format)
                    : "jpeg".equals(format) || "jpg".equals(format);
            if (!formatMatches) {
                throw new BadRequestException("The image format does not match its file signature.");
            }
            reader.setInput(imageInput, true, true);
            int width = reader.getWidth(0);
            int height = reader.getHeight(0);
            long pixels = (long) width * (long) height;
            if (width <= 0 || height <= 0
                    || width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION
                    || pixels > MAX_IMAGE_PIXELS) {
                throw new BadRequestException("The uploaded image dimensions are too large.");
            }
        } catch (BadRequestException ex) {
            throw ex;
        } catch (IOException | RuntimeException ex) {
            throw new BadRequestException("The uploaded image is corrupt or unsupported.");
        } finally {
            if (reader != null) {
                reader.dispose();
            }
        }
    }

    private void validatePassivePdf(byte[] data) {
        int tailStart = Math.max(0, data.length - 2048);
        String tail = new String(Arrays.copyOfRange(data, tailStart, data.length), StandardCharsets.ISO_8859_1);
        if (!tail.contains("%%EOF")) {
            throw new BadRequestException("The uploaded PDF is incomplete or corrupt.");
        }

        String content = new String(data, StandardCharsets.ISO_8859_1).toLowerCase(Locale.ROOT);
        if (content.contains("/javascript")
                || content.contains("/launch")
                || content.contains("/embeddedfile")
                || content.contains("/richmedia")) {
            throw new BadRequestException("Active PDF content is not allowed.");
        }
    }

    private boolean startsWith(byte[] data, byte[] signature) {
        if (data.length < signature.length) {
            return false;
        }
        for (int index = 0; index < signature.length; index += 1) {
            if (data[index] != signature[index]) {
                return false;
            }
        }
        return true;
    }

    private enum DetectedType {
        PDF,
        PNG,
        JPEG
    }

    private record SanitizedUpload(byte[] data, String extension, String contentType) {}

    private static final class MediaTypeNames {
        private static final String PDF = "application/pdf";
        private static final String PNG = "image/png";
        private static final String JPEG = "image/jpeg";

        private MediaTypeNames() {}
    }
}
