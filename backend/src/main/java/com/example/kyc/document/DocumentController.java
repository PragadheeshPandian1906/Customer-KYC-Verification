package com.example.kyc.document;

import com.example.kyc.user.UserAccount;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.List;

@RestController
@RequestMapping("/api/v1/kyc/cases/{caseId}/documents")
public class DocumentController {
    private final DocumentService service;

    public DocumentController(DocumentService service) {
        this.service = service;
    }

    @Operation(summary = "Upload a PDF, JPEG, or PNG KYC document")
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<DocumentService.DocumentResponse> upload(
        @PathVariable String caseId,
        @RequestParam("documentType") @Pattern(regexp = "[A-Z][A-Z0-9_]{0,39}") String documentType,
        @RequestParam("file") @NotNull MultipartFile file,
        @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
        @AuthenticationPrincipal UserAccount actor,
        HttpServletRequest http) {
        return ResponseEntity.status(201).body(service.upload(caseId, documentType, idempotencyKey, file, actor, http));
    }

    @GetMapping
    public List<DocumentService.DocumentResponse> list(@PathVariable String caseId,
                                                        @AuthenticationPrincipal UserAccount actor,
                                                        HttpServletRequest http) {
        return service.list(caseId, actor, http);
    }

    @GetMapping("/{documentId}")
    public DocumentService.DocumentResponse get(@PathVariable String caseId,
                                                 @PathVariable String documentId,
                                                 @AuthenticationPrincipal UserAccount actor,
                                                 HttpServletRequest http) {
        return service.get(caseId, documentId, actor, http);
    }

    @GetMapping("/{documentId}/versions")
    public List<DocumentService.DocumentVersionResponse> history(@PathVariable String caseId,
                                                                  @PathVariable String documentId,
                                                                  @AuthenticationPrincipal UserAccount actor,
                                                                  HttpServletRequest http) {
        return service.history(caseId, documentId, actor, http);
    }

    @PostMapping(value = "/{documentId}/versions", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public DocumentService.DocumentResponse uploadVersion(
        @PathVariable String caseId,
        @PathVariable String documentId,
        @RequestParam("file") MultipartFile file,
        @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
        @AuthenticationPrincipal UserAccount actor,
        HttpServletRequest http) {
        return service.uploadVersion(caseId, documentId, idempotencyKey, file, actor, http);
    }

    @PatchMapping("/{documentId}/status")
    public DocumentService.DocumentResponse updateStatus(@PathVariable String caseId,
                                                         @PathVariable String documentId,
    @NotNull @Valid @RequestBody StatusRequest request,
                                                         @AuthenticationPrincipal UserAccount actor,
                                                         HttpServletRequest http) {
        return service.updateStatus(caseId, documentId, request.status(), actor, http);
    }

    @GetMapping("/{documentId}/download")
    public ResponseEntity<ByteArrayResource> download(@PathVariable String caseId,
                                                       @PathVariable String documentId,
                                                       @AuthenticationPrincipal UserAccount actor,
                                                       HttpServletRequest http) {
        return downloadResponse(service.download(caseId, documentId, null, actor, http));
    }

    @GetMapping("/{documentId}/versions/{versionNumber}/content")
    public ResponseEntity<ByteArrayResource> downloadVersion(@PathVariable String caseId,
                                                               @PathVariable String documentId,
                                                               @PathVariable int versionNumber,
                                                               @AuthenticationPrincipal UserAccount actor,
                                                               HttpServletRequest http) {
        return downloadResponse(service.download(caseId, documentId, versionNumber, actor, http));
    }

    private ResponseEntity<ByteArrayResource> downloadResponse(DocumentService.DownloadedDocument document) {
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType(document.contentType()))
            .contentLength(document.content().length)
            .header(HttpHeaders.CACHE_CONTROL, "no-store")
            .header("X-Content-Type-Options", "nosniff")
            .header(HttpHeaders.CONTENT_DISPOSITION,
                ContentDisposition.attachment().filename(document.filename(), StandardCharsets.UTF_8).build().toString())
            .body(new ByteArrayResource(document.content()));
    }

    public record StatusRequest(@NotNull DocumentStatus status) {
    }
}
