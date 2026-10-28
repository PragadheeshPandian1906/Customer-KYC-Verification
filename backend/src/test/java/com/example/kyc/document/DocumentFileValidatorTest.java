package com.example.kyc.document;

import com.example.kyc.common.ApiException;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class DocumentFileValidatorTest {
    @Test
    void acceptsStructurallyValidPdf() throws Exception {
        DocumentFileValidator validator = new DocumentFileValidator(1024 * 1024);
        MockMultipartFile file = new MockMultipartFile("file", "evidence.pdf", "application/pdf", createPdf());

        var result = validator.validate(file);

        assertEquals("application/pdf", result.contentType());
        assertEquals("evidence.pdf", result.originalFilename());
    }

    @Test
    void acceptsStructurallyValidPng() throws Exception {
        BufferedImage image = new BufferedImage(4, 4, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        ImageIO.write(image, "png", bytes);
        DocumentFileValidator validator = new DocumentFileValidator(1024 * 1024);

        var result = validator.validate(new MockMultipartFile("file", "evidence.png", "image/png", bytes.toByteArray()));

        assertEquals("image/png", result.contentType());
    }

    @Test
    void rejectsEmptyFile() {
        DocumentFileValidator validator = new DocumentFileValidator(1024);
        var file = new MockMultipartFile("file", "empty.pdf", "application/pdf", new byte[0]);

        ApiException exception = assertThrows(ApiException.class, () -> validator.validate(file));

        assertEquals(400, exception.getStatus().value());
    }

    @Test
    void rejectsOversizedFile() {
        DocumentFileValidator validator = new DocumentFileValidator(10);
        var file = new MockMultipartFile("file", "large.png", "image/png", new byte[11]);

        ApiException exception = assertThrows(ApiException.class, () -> validator.validate(file));

        assertEquals(413, exception.getStatus().value());
    }

    @Test
    void rejectsUnsupportedExtension() {
        DocumentFileValidator validator = new DocumentFileValidator(1024);
        var file = new MockMultipartFile("file", "evidence.txt", "text/plain", "text".getBytes());

        ApiException exception = assertThrows(ApiException.class, () -> validator.validate(file));

        assertEquals(415, exception.getStatus().value());
    }

    @Test
    void rejectsContentAndExtensionMismatch() throws Exception {
        BufferedImage image = new BufferedImage(2, 2, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        ImageIO.write(image, "png", bytes);
        DocumentFileValidator validator = new DocumentFileValidator(1024 * 1024);
        var file = new MockMultipartFile("file", "evidence.pdf", "application/pdf", bytes.toByteArray());

        ApiException exception = assertThrows(ApiException.class, () -> validator.validate(file));

        assertEquals(415, exception.getStatus().value());
    }

    @Test
    void rejectsMalformedPdf() {
        DocumentFileValidator validator = new DocumentFileValidator(1024);
        var file = new MockMultipartFile("file", "bad.pdf", "application/pdf",
            "%PDF-1.7 not a valid PDF".getBytes());

        ApiException exception = assertThrows(ApiException.class, () -> validator.validate(file));

        assertEquals(400, exception.getStatus().value());
    }

    private byte[] createPdf() throws Exception {
        try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            document.addPage(new PDPage());
            document.save(output);
            return output.toByteArray();
        }
    }
}
