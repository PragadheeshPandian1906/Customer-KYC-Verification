package com.example.kyc.document;

import com.example.kyc.audit.AuditService;
import com.example.kyc.common.ApiException;
import com.example.kyc.kyc.KycCase;
import com.example.kyc.kyc.KycCaseService;
import com.example.kyc.kyc.KycEnums;
import com.example.kyc.user.UserAccount;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

@Service
public class DocumentService {
    private static final Logger LOGGER = LoggerFactory.getLogger(DocumentService.class);
    private final KycDocumentRepository documents;
    private final DocumentVersionRepository versions;
    private final KycCaseService caseService;
    private final DocumentStorage storage;
    private final DocumentFileValidator validator;
    private final AuditService audit;
    private final TransactionTemplate transactionTemplate;

    public DocumentService(KycDocumentRepository documents, DocumentVersionRepository versions,
                           KycCaseService caseService, DocumentStorage storage,
                           DocumentFileValidator validator, AuditService audit,
                           PlatformTransactionManager transactionManager) {
        this.documents = documents;
        this.versions = versions;
        this.caseService = caseService;
        this.storage = storage;
        this.validator = validator;
        this.audit = audit;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    public DocumentResponse upload(String caseId, String documentType, String idempotencyKey,
                                   org.springframework.web.multipart.MultipartFile file,
                                   UserAccount actor, HttpServletRequest http) {
        requireWritableCase(caseId, actor, http);
        String normalizedType = validateDocumentType(documentType);
        validateIdempotencyKey(idempotencyKey);
        DocumentFileValidator.ValidatedFile validated = validator.validate(file);
        String fingerprint = fingerprint(normalizedType, validated);
        String storageKey = UUID.randomUUID().toString();
        try {
            return transactionTemplate.execute(status -> {
                KycCase kycCase = caseService.lockAuthorizedCase(caseId, actor, http, "DOCUMENT_UPLOAD");
                ensureWritable(kycCase);
                if (idempotencyKey != null) {
                    var existing = documents.findByKycCase_IdAndIdempotencyKey(caseId, idempotencyKey);
                    if (existing.isPresent()) {
                        if (!existing.get().getRequestFingerprint().equals(fingerprint)) {
                            throw idempotencyConflict();
                        }
                        DocumentVersion original = latestVersion(existing.get().getId(), 1);
                        return DocumentResponse.from(existing.get(), original);
                    }
                }
                KycDocument document = documents.saveAndFlush(new KycDocument(kycCase, normalizedType,
                    idempotencyKey, fingerprint, actor));
                DocumentVersion version = new DocumentVersion(document, 1, null, null,
                    validated.originalFilename(), validated.contentType(), validated.content().length,
                    sha256(validated.content()), storageKey, actor);
                versions.saveAndFlush(version);
                try {
                    storage.write(storageKey, validated.content());
                } catch (IOException exception) {
                    throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Document storage is unavailable");
                }
                audit.recordChange(actor, "DOCUMENT_UPLOADED", "KYC_DOCUMENT", document.getId(), "SUCCESS", http);
                return DocumentResponse.from(document, version);
            });
        } catch (org.springframework.dao.DataIntegrityViolationException exception) {
            cleanup(storageKey, exception);
            if (idempotencyKey != null) {
                return resolveInitialUploadRetry(caseId, idempotencyKey, fingerprint);
            }
            throw new ApiException(HttpStatus.CONFLICT, "Document metadata conflicts with an existing record");
        } catch (RuntimeException exception) {
            cleanup(storageKey, exception);
            throw exception;
        } finally {
            java.util.Arrays.fill(validated.content(), (byte) 0);
        }
    }

    @Transactional(readOnly = true)
    public List<DocumentResponse> list(String caseId, UserAccount actor, HttpServletRequest http) {
        caseService.authorizedCase(caseId, actor, http, "DOCUMENT_LIST");
        List<DocumentResponse> result = documents.findAllByKycCase_IdOrderByCreatedAtDesc(caseId).stream()
            .map(document -> DocumentResponse.from(document,
                latestVersion(document.getId(), document.getCurrentVersion())))
            .toList();
        audit.record(actor, "DOCUMENT_LIST", "KYC_CASE", caseId, "SUCCESS", http);
        return result;
    }

    @Transactional(readOnly = true)
    public DocumentResponse get(String caseId, String documentId, UserAccount actor, HttpServletRequest http) {
        requireDocument(caseId, documentId, actor, http, "DOCUMENT_READ");
        KycDocument document = documents.findByIdAndKycCase_Id(documentId, caseId).orElseThrow(DocumentService::notFound);
        audit.record(actor, "DOCUMENT_READ", "KYC_DOCUMENT", documentId, "SUCCESS", http);
        return DocumentResponse.from(document, latestVersion(documentId, document.getCurrentVersion()));
    }

    @Transactional(readOnly = true)
    public List<DocumentVersionResponse> history(String caseId, String documentId,
                                                 UserAccount actor, HttpServletRequest http) {
        requireDocument(caseId, documentId, actor, http, "DOCUMENT_VERSION_LIST");
        List<DocumentVersionResponse> result = versions.findAllByDocument_IdOrderByVersionNumberDesc(documentId).stream()
            .map(DocumentVersionResponse::from).toList();
        audit.record(actor, "DOCUMENT_VERSION_LIST", "KYC_DOCUMENT", documentId, "SUCCESS", http);
        return result;
    }

    public DocumentResponse uploadVersion(String caseId, String documentId,
                                          String idempotencyKey,
                                          org.springframework.web.multipart.MultipartFile file,
                                          UserAccount actor, HttpServletRequest http) {
        requireDocument(caseId, documentId, actor, http, "DOCUMENT_VERSION_UPLOAD");
        KycCase authorizedCase = caseService.authorizedCase(caseId, actor, http, "DOCUMENT_VERSION_UPLOAD");
        ensureWritable(authorizedCase);
        validateIdempotencyKey(idempotencyKey);
        DocumentFileValidator.ValidatedFile validated = validator.validate(file);
        String fingerprint = fingerprint(null, validated);
        String storageKey = UUID.randomUUID().toString();
        try {
            return transactionTemplate.execute(status -> {
                KycCase caseLock = caseService.lockAuthorizedCase(
                    caseId, actor, http, "DOCUMENT_VERSION_UPLOAD");
                ensureWritable(caseLock);
                KycDocument document = versions.lockDocument(caseId, documentId)
                    .orElseThrow(DocumentService::notFound);
                requireDocumentAccess(document.getKycCase(), actor, http, "DOCUMENT_VERSION_UPLOAD");
                ensureWritable(document.getKycCase());
                if (idempotencyKey != null) {
                    var existing = versions.findByDocument_IdAndIdempotencyKey(documentId, idempotencyKey);
                    if (existing.isPresent()) {
                        if (!existing.get().getRequestFingerprint().equals(fingerprint)) {
                            throw idempotencyConflict();
                        }
                        return DocumentResponse.from(document, existing.get());
                    }
                }
                int nextVersion = document.getCurrentVersion() + 1;
                document.incrementVersion();
                DocumentVersion newVersion = new DocumentVersion(document, nextVersion, idempotencyKey,
                    fingerprint, validated.originalFilename(), validated.contentType(), validated.content().length,
                    sha256(validated.content()), storageKey, actor);
                versions.saveAndFlush(newVersion);
                try {
                    storage.write(storageKey, validated.content());
                } catch (IOException exception) {
                    throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Document storage is unavailable");
                }
                audit.recordChange(actor, "DOCUMENT_VERSION_UPLOADED", "KYC_DOCUMENT", document.getId(), "SUCCESS", http);
                return DocumentResponse.from(document, newVersion);
            });
        } catch (org.springframework.dao.DataIntegrityViolationException exception) {
            cleanup(storageKey, exception);
            if (idempotencyKey != null) {
                return resolveVersionUploadRetry(documentId, idempotencyKey, fingerprint);
            }
            throw new ApiException(HttpStatus.CONFLICT, "Document version conflicts with an existing record");
        } catch (RuntimeException exception) {
            cleanup(storageKey, exception);
            throw exception;
        } finally {
            java.util.Arrays.fill(validated.content(), (byte) 0);
        }
    }

    public DocumentResponse updateStatus(String caseId, String documentId, DocumentStatus nextStatus,
                                          UserAccount actor, HttpServletRequest http) {
        return transactionTemplate.execute(status -> {
            caseService.lockAuthorizedCase(caseId, actor, http, "DOCUMENT_STATUS_UPDATE");
            KycDocument document = versions.lockDocument(caseId, documentId)
                .orElseThrow(DocumentService::notFound);
            requireReviewPermission(document.getKycCase(), actor, http);
            if (nextStatus == null || document.getStatus() != DocumentStatus.PENDING_REVIEW
                || (nextStatus != DocumentStatus.ACCEPTED && nextStatus != DocumentStatus.REJECTED)) {
                audit.record(actor, "DOCUMENT_STATUS_UPDATED", "KYC_DOCUMENT", document.getId(), "FAILURE", http);
                throw new ApiException(HttpStatus.CONFLICT, "Document review status cannot make that transition");
            }
            document.setStatus(nextStatus);
            audit.recordChange(actor, "DOCUMENT_STATUS_UPDATED", "KYC_DOCUMENT", document.getId(), "SUCCESS", http);
            return DocumentResponse.from(document, latestVersion(documentId, document.getCurrentVersion()));
        });
    }

    @Transactional(readOnly = true)
    public DownloadedDocument download(String caseId, String documentId, Integer versionNumber,
                                       UserAccount actor, HttpServletRequest http) {
        requireDocument(caseId, documentId, actor, http, "DOCUMENT_DOWNLOAD");
        KycDocument document = documents.findByIdAndKycCase_Id(documentId, caseId)
            .orElseThrow(DocumentService::notFound);
        int selectedVersion = versionNumber == null ? document.getCurrentVersion() : versionNumber;
        DocumentVersion version = versions.findByDocument_IdAndVersionNumber(documentId, selectedVersion)
            .orElseThrow(DocumentService::notFound);
        try {
            byte[] content = storage.read(version.getStorageKey());
            audit.record(actor, "DOCUMENT_DOWNLOADED", "KYC_DOCUMENT", documentId, "SUCCESS", http);
            return new DownloadedDocument(version.getOriginalFilename(), version.getContentType(), content);
        } catch (IOException exception) {
            audit.record(actor, "DOCUMENT_DOWNLOADED", "KYC_DOCUMENT", documentId, "FAILURE", http);
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Document content is unavailable");
        }
    }

    private KycCase requireWritableCase(String caseId, UserAccount actor, HttpServletRequest http) {
        KycCase kycCase = caseService.authorizedCase(caseId, actor, http, "DOCUMENT_UPLOAD");
        ensureWritable(kycCase);
        return kycCase;
    }

    private void requireDocument(String caseId, String documentId, UserAccount actor,
                                 HttpServletRequest http, String event) {
        KycCase kycCase = caseService.authorizedCase(caseId, actor, http, event);
        if (documents.findByIdAndKycCase_Id(documentId, caseId).isEmpty()) {
            audit.record(actor, event, "KYC_DOCUMENT", documentId, "DENIED", http);
            throw notFound();
        }
        requireDocumentAccess(kycCase, actor, http, event);
    }

    private void requireDocumentAccess(KycCase kycCase, UserAccount actor,
                                       HttpServletRequest http, String event) {
        caseService.authorizedCase(kycCase.getId(), actor, http, event);
    }

    private void requireReviewPermission(KycCase kycCase, UserAccount actor, HttpServletRequest http) {
        if (!actor.hasRole("KYC_ANALYST") && !actor.hasRole("COMPLIANCE_SUPERVISOR")) {
            audit.record(actor, "DOCUMENT_STATUS_UPDATE", "KYC_DOCUMENT", null, "DENIED", http);
            throw new ApiException(HttpStatus.FORBIDDEN, "Only authorized KYC staff may review documents");
        }
        requireDocumentAccess(kycCase, actor, http, "DOCUMENT_STATUS_UPDATE");
        if (kycCase.getStatus() != KycEnums.CaseStatus.IN_REVIEW
            && kycCase.getStatus() != KycEnums.CaseStatus.PENDING_SUPERVISOR_APPROVAL) {
            audit.record(actor, "DOCUMENT_STATUS_UPDATE", "KYC_DOCUMENT", null, "FAILURE", http);
            throw new ApiException(HttpStatus.CONFLICT, "Documents may only be reviewed during an active case review");
        }
        if (kycCase.getStatus() == KycEnums.CaseStatus.PENDING_SUPERVISOR_APPROVAL
            && !actor.hasRole("COMPLIANCE_SUPERVISOR")) {
            audit.record(actor, "DOCUMENT_STATUS_UPDATE", "KYC_DOCUMENT", null, "DENIED", http);
            throw new ApiException(HttpStatus.FORBIDDEN, "Supervisor approval is required for this case");
        }
    }

    private void ensureWritable(KycCase kycCase) {
        if (kycCase.getStatus() == KycEnums.CaseStatus.APPROVED
            || kycCase.getStatus() == KycEnums.CaseStatus.REJECTED
            || kycCase.getStatus() == KycEnums.CaseStatus.CLOSED) {
            throw new ApiException(HttpStatus.CONFLICT, "A completed KYC case cannot accept document changes");
        }
    }

    private DocumentVersion latestVersion(String documentId, int versionNumber) {
        return versions.findByDocument_IdAndVersionNumber(documentId, versionNumber)
            .orElseThrow(DocumentService::notFound);
    }

    private String validateDocumentType(String documentType) {
        if (documentType == null || !documentType.matches("[A-Z][A-Z0-9_]{0,39}")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "documentType must be an uppercase identifier");
        }
        return documentType;
    }

    private void validateIdempotencyKey(String key) {
        if (key != null && !key.matches("[A-Za-z0-9._:-]{1,128}")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid Idempotency-Key header");
        }
    }

    private String fingerprint(String documentType, DocumentFileValidator.ValidatedFile file) {
        String input = (documentType == null ? "" : documentType) + "\n"
            + file.originalFilename() + "\n" + file.contentType() + "\n" + sha256(file.content());
        return digest(input.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    private String sha256(byte[] content) {
        return digest(content);
    }

    private String digest(byte[] content) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(content));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is required by the Java runtime", exception);
        }
    }

    private DocumentResponse resolveInitialUploadRetry(String caseId, String key, String fingerprint) {
        return transactionTemplate.execute(status -> documents.findByKycCase_IdAndIdempotencyKey(caseId, key)
            .filter(document -> fingerprint.equals(document.getRequestFingerprint()))
            .map(document -> DocumentResponse.from(document, latestVersion(document.getId(), 1)))
            .orElseThrow(DocumentService::idempotencyConflict));
    }

    private DocumentResponse resolveVersionUploadRetry(String documentId, String key, String fingerprint) {
        return transactionTemplate.execute(status -> versions.findByDocument_IdAndIdempotencyKey(documentId, key)
            .filter(version -> fingerprint.equals(version.getRequestFingerprint()))
            .map(version -> DocumentResponse.from(version.getDocument(), version))
            .orElseThrow(DocumentService::idempotencyConflict));
    }

    private void cleanup(String storageKey, RuntimeException original) {
        try {
            storage.delete(storageKey);
        } catch (IOException cleanupFailure) {
            original.addSuppressed(cleanupFailure);
            LOGGER.error("Unable to clean up rolled-back document storage object {}", storageKey, cleanupFailure);
        }
    }

    private static ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "Document not found");
    }

    private static ApiException idempotencyConflict() {
        return new ApiException(HttpStatus.CONFLICT,
            "Idempotency-Key was already used for a different document upload");
    }

    public record DocumentResponse(String id, String caseId, String documentType, DocumentStatus status,
                                   int currentVersion, String filename, String contentType, long size,
                                   java.time.Instant createdAt, java.time.Instant updatedAt) {
        static DocumentResponse from(KycDocument document, DocumentVersion version) {
            return new DocumentResponse(document.getId(), document.getKycCase().getId(),
                document.getDocumentType(), document.getStatus(), document.getCurrentVersion(),
                version.getOriginalFilename(), version.getContentType(), version.getFileSize(),
                document.getCreatedAt(), document.getUpdatedAt());
        }
    }

    public record DocumentVersionResponse(String id, int version, String filename, String contentType,
                                           long size, java.time.Instant uploadedAt) {
        static DocumentVersionResponse from(DocumentVersion version) {
            return new DocumentVersionResponse(version.getId(), version.getVersionNumber(),
                version.getOriginalFilename(), version.getContentType(), version.getFileSize(),
                version.getCreatedAt());
        }
    }

    public record DownloadedDocument(String filename, String contentType, byte[] content) {
    }
}
