package com.example.kyc.document;

import com.example.kyc.common.ApiException;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.awt.image.BufferedImage;
import java.util.Iterator;
import java.util.Locale;
import java.util.Set;

@Component
public class DocumentFileValidator {
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("pdf", "jpg", "jpeg", "png");
    private final long maxBytes;

    public DocumentFileValidator(@Value("${app.storage.max-file-size:10485760}") long maxBytes) {
        if (maxBytes < 1) {
            throw new IllegalArgumentException("Maximum upload size must be positive");
        }
        this.maxBytes = maxBytes;
    }

    public ValidatedFile validate(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Uploaded file must not be empty");
        }
        if (file.getSize() > maxBytes) {
            throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "Uploaded file exceeds the configured size limit");
        }
        String filename = file.getOriginalFilename();
        if (filename == null || filename.isBlank() || filename.length() > 255
            || filename.contains("/") || filename.contains("\\") || filename.equals(".") || filename.equals("..")
            || filename.codePoints().anyMatch(Character::isISOControl)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid uploaded filename");
        }
        String extension = extensionOf(filename);
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw new ApiException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Unsupported document file type");
        }
        try {
            byte[] content = file.getBytes();
            String detectedType = detectType(content);
            if (!matchesExtension(extension, detectedType) || !matchesContentType(file.getContentType(), detectedType)) {
                throw new ApiException(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                    "File extension, content, and declared content type must match");
            }
            validateStructure(content, detectedType);
            return new ValidatedFile(filename, detectedType, content);
        } catch (IOException exception) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Uploaded file is malformed or unreadable");
        }
    }

    private String detectType(byte[] content) {
        if (content.length >= 5 && content[0] == '%' && content[1] == 'P' && content[2] == 'D'
            && content[3] == 'F' && content[4] == '-') {
            return "application/pdf";
        }
        if (content.length >= 8 && (content[0] & 0xFF) == 0x89 && content[1] == 'P'
            && content[2] == 'N' && content[3] == 'G' && (content[4] & 0xFF) == 0x0D
            && (content[5] & 0xFF) == 0x0A && (content[6] & 0xFF) == 0x1A
            && (content[7] & 0xFF) == 0x0A) {
            return "image/png";
        }
        if (content.length >= 3 && (content[0] & 0xFF) == 0xFF
            && (content[1] & 0xFF) == 0xD8 && (content[2] & 0xFF) == 0xFF) {
            return "image/jpeg";
        }
        throw new ApiException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "File content is not a supported document type");
    }

    private boolean matchesExtension(String extension, String contentType) {
        return switch (contentType) {
            case "application/pdf" -> extension.equals("pdf");
            case "image/png" -> extension.equals("png");
            case "image/jpeg" -> extension.equals("jpg") || extension.equals("jpeg");
            default -> false;
        };
    }

    private boolean matchesContentType(String declared, String detected) {
        return declared == null || declared.equalsIgnoreCase("application/octet-stream")
            || declared.equalsIgnoreCase(detected);
    }

    private void validateStructure(byte[] content, String contentType) throws IOException {
        if (contentType.equals("application/pdf")) {
            try (PDDocument document = Loader.loadPDF(content)) {
                if (document.getNumberOfPages() < 1 || document.getNumberOfPages() > 500) {
                    throw new ApiException(HttpStatus.BAD_REQUEST, "PDF page count is outside the permitted range");
                }
            } catch (IOException exception) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Uploaded PDF is malformed");
            }
            return;
        }
        try (ImageInputStream input = ImageIO.createImageInputStream(new ByteArrayInputStream(content))) {
            if (input == null) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Uploaded image is malformed");
            }
            Iterator<ImageReader> readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Uploaded image is malformed");
            }
            ImageReader reader = readers.next();
            try {
                reader.setInput(input, true, true);
                long width = reader.getWidth(0);
                long height = reader.getHeight(0);
                if (width < 1 || height < 1 || width > 10_000 || height > 10_000
                    || width * height > 16_000_000L) {
                    throw new ApiException(HttpStatus.BAD_REQUEST, "Image dimensions exceed the permitted limit");
                }
                BufferedImage decoded = reader.read(0);
                if (decoded == null) {
                    throw new ApiException(HttpStatus.BAD_REQUEST, "Uploaded image is malformed");
                }
                decoded.flush();
            } finally {
                reader.dispose();
            }
        }
    }

    private String extensionOf(String filename) {
        int dot = filename.lastIndexOf('.');
        if (dot < 1 || dot == filename.length() - 1) {
            return "";
        }
        return filename.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    public record ValidatedFile(String originalFilename, String contentType, byte[] content) {
    }
}
