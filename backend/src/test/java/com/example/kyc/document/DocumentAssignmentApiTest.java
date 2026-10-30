package com.example.kyc.document;

import com.example.kyc.audit.AuditEventRepository;
import com.example.kyc.auth.AuthController;
import com.example.kyc.auth.SessionAuthenticationFilter;
import com.example.kyc.customer.CustomerService;
import com.example.kyc.kyc.KycCaseService;
import com.example.kyc.role.Role;
import com.example.kyc.role.RoleRepository;
import com.example.kyc.user.UserAccount;
import com.example.kyc.user.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.io.ByteArrayOutputStream;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class DocumentAssignmentApiTest {
    private static final String PASSWORD = "Test-Password-21!";
    private static final java.util.concurrent.atomic.AtomicInteger LOGIN_SOURCE = new java.util.concurrent.atomic.AtomicInteger();

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private UserRepository users;
    @Autowired
    private RoleRepository roles;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private DocumentVersionRepository documentVersions;
    @Autowired
    private AuditEventRepository auditEvents;
    @Autowired
    private com.example.kyc.kyc.VerificationCheckRepository verificationChecks;
    @Autowired
    private com.example.kyc.kyc.VerificationDecisionRepository verificationDecisions;
    @Autowired
    private com.example.kyc.kyc.SupervisorApprovalRepository supervisorApprovals;
    @Autowired
    private com.example.kyc.kyc.CaseStatusHistoryRepository caseStatusHistory;

    private UserAccount supervisor;
    private UserAccount analyst;

    @BeforeEach
    void createUsers() {
        supervisor = createUser("COMPLIANCE_SUPERVISOR");
        analyst = createUserWithRoles("KYC_ANALYST", "COMPLIANCE_SUPERVISOR");
    }

    @Test
    void assignedCaseSupportsEncryptedDocumentVersionsReviewAndAudit() throws Exception {
        Csrf csrf = fetchCsrf();
        Cookie session = login(supervisor.getEmail(), csrf);
        String customerId = createCustomer(session, csrf);
        String caseId = createCase(session, csrf, customerId);
        String otherCaseId = createCase(session, csrf, createCustomer(session, csrf));

        mockMvc.perform(post("/api/v1/kyc/cases/{caseId}/assignments", caseId)
                .cookie(session, csrf.cookie())
                .header("X-XSRF-TOKEN", csrf.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsBytes(new KycCaseService.AssignmentRequest(analyst.getId()))))
            .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/kyc/cases/{caseId}/review/start", caseId)
                .cookie(session, csrf.cookie())
                .header("X-XSRF-TOKEN", csrf.token()))
            .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/kyc/cases/{caseId}/close", caseId)
                .cookie(session, csrf.cookie())
                .header("X-XSRF-TOKEN", csrf.token()))
            .andExpect(status().isConflict());

        byte[] firstPdf = createPdf();
        String uploadResponse = uploadFirstVersion(caseId, session, csrf, firstPdf);
        JsonNode uploaded = objectMapper.readTree(uploadResponse);
        String documentId = uploaded.get("id").asText();
        assertEquals(1, uploaded.get("currentVersion").asInt());
        assertFalse(uploadResponse.contains("storageKey"));
        mockMvc.perform(get("/api/v1/kyc/cases/{caseId}/documents/{documentId}",
                    otherCaseId, documentId).cookie(session))
            .andExpect(status().isNotFound());
        JsonNode repeatedUpload = objectMapper.readTree(uploadFirstVersion(caseId, session, csrf, firstPdf));
        assertEquals(documentId, repeatedUpload.get("id").asText());
        assertEquals(1, documentVersions.findAllByDocument_IdOrderByVersionNumberDesc(documentId).size());
        mockMvc.perform(multipart("/api/v1/kyc/cases/{caseId}/documents", caseId)
                .file(new MockMultipartFile("file", "different-name.pdf", "application/pdf", firstPdf.clone()))
                .param("documentType", "IDENTITY_EVIDENCE")
                .cookie(session, csrf.cookie())
                .header("X-XSRF-TOKEN", csrf.token())
                .header("Idempotency-Key", "initial-document-1"))
            .andExpect(status().isConflict());

        byte[] secondPdf = createPdf();
        uploadVersion(caseId, documentId, session, csrf, secondPdf);
        uploadVersion(caseId, documentId, session, csrf, secondPdf);
        mockMvc.perform(multipart("/api/v1/kyc/cases/{caseId}/documents/{documentId}/versions",
                    caseId, documentId)
                .file(new MockMultipartFile("file", "different-name.pdf", "application/pdf", secondPdf.clone()))
                .cookie(session, csrf.cookie())
                .header("X-XSRF-TOKEN", csrf.token())
                .header("Idempotency-Key", "document-version-2"))
            .andExpect(status().isConflict());

        JsonNode history = objectMapper.readTree(mockMvc.perform(
                get("/api/v1/kyc/cases/{caseId}/documents/{documentId}/versions", caseId, documentId)
                    .cookie(session))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray());
        assertEquals(2, history.size());
        assertEquals("PENDING_REVIEW", objectMapper.readTree(mockMvc.perform(
                get("/api/v1/kyc/cases/{caseId}/documents/{documentId}", caseId, documentId)
                    .cookie(session))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray())
            .get("status").asText());

        UserAccount unassignedAnalyst = createUser("KYC_ANALYST");
        Cookie unassignedSession = login(unassignedAnalyst.getEmail(), csrf);
        mockMvc.perform(get("/api/v1/kyc/cases/{caseId}/documents", caseId).cookie(unassignedSession))
            .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/kyc/cases/{caseId}/assignments", caseId).cookie(unassignedSession))
            .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/kyc/cases/{caseId}/documents/{documentId}/download",
                    caseId, documentId).cookie(unassignedSession))
            .andExpect(status().isNotFound());
        mockMvc.perform(multipart("/api/v1/kyc/cases/{caseId}/documents", caseId)
                .file(new MockMultipartFile("file", "synthetic-evidence.pdf", "application/pdf", createPdf()))
                .param("documentType", "IDENTITY_EVIDENCE")
                .cookie(unassignedSession, csrf.cookie())
                .header("X-XSRF-TOKEN", csrf.token()))
            .andExpect(status().isNotFound());

        mockMvc.perform(patch("/api/v1/kyc/cases/{caseId}/documents/{documentId}/status", caseId, documentId)
                .cookie(session, csrf.cookie())
                .header("X-XSRF-TOKEN", csrf.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"status":"ACCEPTED"}
                    """))
            .andExpect(status().isOk());
        mockMvc.perform(patch("/api/v1/kyc/cases/{caseId}/documents/{documentId}/status", caseId, documentId)
                .cookie(session, csrf.cookie())
                .header("X-XSRF-TOKEN", csrf.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"status":"REJECTED"}
                    """))
            .andExpect(status().isConflict());

        Cookie analystSession = login(analyst.getEmail(), csrf);
        mockMvc.perform(post("/api/v1/kyc/cases/{caseId}/verification-results", caseId)
                .cookie(analystSession, csrf.cookie())
                .header("X-XSRF-TOKEN", csrf.token())
                .header("Idempotency-Key", "premature-decision")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"outcome":"APPROVE","reasonCode":"CHECKS_COMPLETE"}
                    """))
            .andExpect(status().isConflict());

        for (String checkType : List.of("CUSTOMER_INFORMATION", "IDENTITY_DOCUMENT", "ADDRESS_DOCUMENT")) {
            mockMvc.perform(post("/api/v1/kyc/cases/{caseId}/verification-checks", caseId)
                    .cookie(session, csrf.cookie())
                    .header("X-XSRF-TOKEN", csrf.token())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsBytes(
                        new com.example.kyc.kyc.VerificationWorkflowService.CreateCheckRequest(
                            checkType, com.example.kyc.kyc.VerificationEnums.CheckResult.PASS,
                            "Synthetic test check", documentId))))
                .andExpect(status().isCreated());
        }
        assertEquals(3, verificationChecks.findAllByKycCase_IdOrderByCreatedAtAsc(caseId).size());
        mockMvc.perform(patch("/api/v1/kyc/cases/{caseId}", caseId)
                .cookie(session, csrf.cookie())
                .header("X-XSRF-TOKEN", csrf.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"status":"APPROVED"}
                    """))
            .andExpect(status().isBadRequest());
        mockMvc.perform(patch("/api/v1/kyc/cases/{caseId}", caseId)
                .cookie(session, csrf.cookie())
                .header("X-XSRF-TOKEN", csrf.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"riskLevel":"HIGH"}
                    """))
            .andExpect(status().isOk());
        MvcResult submitted = mockMvc.perform(post("/api/v1/kyc/cases/{caseId}/verification-results", caseId)
                .cookie(analystSession, csrf.cookie())
                .header("X-XSRF-TOKEN", csrf.token())
                .header("Idempotency-Key", "high-risk-decision")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"outcome":"APPROVE","reasonCode":"CHECKS_COMPLETE","rationale":"All required checks passed"}
                    """))
            .andExpect(status().isCreated()).andReturn();
        String decisionId = objectMapper.readTree(submitted.getResponse().getContentAsByteArray())
            .get("id").asText();
        JsonNode submittedDecision = objectMapper.readTree(submitted.getResponse().getContentAsByteArray());
        assertTrue(submittedDecision.get("approvalRequired").asBoolean());
        assertEquals(1, verificationDecisions.findAllByKycCase_IdOrderByCreatedAtDesc(caseId).size());

        JsonNode pendingStatus = objectMapper.readTree(mockMvc.perform(
                get("/api/v1/kyc/cases/{caseId}/status", caseId).cookie(session))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray());
        assertEquals("PENDING_SUPERVISOR_APPROVAL", pendingStatus.get("status").asText());
        mockMvc.perform(get("/api/v1/kyc/cases/{caseId}/approvals/pending", caseId).cookie(session))
            .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/kyc/cases/{caseId}/verification-decisions/{decisionId}/approval",
                    otherCaseId, decisionId)
                .cookie(session, csrf.cookie())
                .header("X-XSRF-TOKEN", csrf.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"outcome":"APPROVED","reason":"Wrong case"}
                    """))
            .andExpect(status().isNotFound());
        mockMvc.perform(post("/api/v1/kyc/cases/{caseId}/verification-decisions/{decisionId}/approval",
                    caseId, decisionId)
                .cookie(analystSession, csrf.cookie())
                .header("X-XSRF-TOKEN", csrf.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"outcome":"APPROVED","reason":"Self approval attempt"}
                    """))
            .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/kyc/cases/{caseId}/verification-decisions/{decisionId}/approval",
                    caseId, decisionId)
                .cookie(session, csrf.cookie())
                .header("X-XSRF-TOKEN", csrf.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"outcome":"REJECTED","reason":"Return for another analyst review"}
                    """))
            .andExpect(status().isOk());
        assertEquals(1, supervisorApprovals.findAllByDecision_KycCase_Id(caseId).size());
        mockMvc.perform(post("/api/v1/kyc/cases/{caseId}/verification-decisions/{decisionId}/approval",
                    caseId, decisionId)
                .cookie(session, csrf.cookie())
                .header("X-XSRF-TOKEN", csrf.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"outcome":"APPROVED","reason":"Conflicting retry"}
                    """))
            .andExpect(status().isConflict());
        MvcResult resubmitted = mockMvc.perform(post("/api/v1/kyc/cases/{caseId}/verification-results", caseId)
                .cookie(analystSession, csrf.cookie())
                .header("X-XSRF-TOKEN", csrf.token())
                .header("Idempotency-Key", "high-risk-decision-revision")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"outcome":"APPROVE","reasonCode":"CHECKS_COMPLETE","rationale":"Reassessed after return"}
                    """))
            .andExpect(status().isCreated()).andReturn();
        String revisedDecisionId = objectMapper.readTree(resubmitted.getResponse().getContentAsByteArray())
            .get("id").asText();
        mockMvc.perform(post("/api/v1/kyc/cases/{caseId}/verification-decisions/{decisionId}/approval",
                    caseId, revisedDecisionId)
                .cookie(session, csrf.cookie())
                .header("X-XSRF-TOKEN", csrf.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"outcome":"APPROVED","reason":"Approved after review"}
                    """))
            .andExpect(status().isOk());
        assertEquals(2, verificationDecisions.findAllByKycCase_IdOrderByCreatedAtDesc(caseId).size());
        assertEquals(2, supervisorApprovals.findAllByDecision_KycCase_Id(caseId).size());
        mockMvc.perform(post("/api/v1/kyc/cases/{caseId}/close", caseId)
                .cookie(session, csrf.cookie())
                .header("X-XSRF-TOKEN", csrf.token()))
            .andExpect(status().isOk());
        assertEquals(6, caseStatusHistory.findAllByKycCase_IdOrderByCreatedAtAsc(caseId).size());

        MvcResult download = mockMvc.perform(get(
                "/api/v1/kyc/cases/{caseId}/documents/{documentId}/download", caseId, documentId)
                .cookie(session))
            .andExpect(status().isOk())
            .andReturn();
        assertEquals(secondPdf.length, download.getResponse().getContentAsByteArray().length);
        assertEquals("no-store", download.getResponse().getHeader("Cache-Control"));
        assertEquals("nosniff", download.getResponse().getHeader("X-Content-Type-Options"));
        assertTrue(download.getResponse().getHeader("Content-Disposition").startsWith("attachment;"));
        assertEquals(2, documentVersions.findAllByDocument_IdOrderByVersionNumberDesc(documentId).size());
        assertTrue(auditEvents.count() > 0);
    }

    @Test
    void additionalInformationDecisionCanBeResumedAndIsIdempotent() throws Exception {
        Csrf csrf = fetchCsrf();
        Cookie supervisorSession = login(supervisor.getEmail(), csrf);
        String customerId = createCustomer(supervisorSession, csrf);
        String caseId = createCase(supervisorSession, csrf, customerId);
        mockMvc.perform(post("/api/v1/kyc/cases/{caseId}/assignments", caseId)
                .cookie(supervisorSession, csrf.cookie())
                .header("X-XSRF-TOKEN", csrf.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsBytes(new KycCaseService.AssignmentRequest(analyst.getId()))))
            .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/kyc/cases/{caseId}/review/start", caseId)
                .cookie(supervisorSession, csrf.cookie())
                .header("X-XSRF-TOKEN", csrf.token()))
            .andExpect(status().isOk());

        Cookie analystSession = login(analyst.getEmail(), csrf);
        MvcResult requestInformation = mockMvc.perform(post(
                    "/api/v1/kyc/cases/{caseId}/verification-results", caseId)
                .cookie(analystSession, csrf.cookie())
                .header("X-XSRF-TOKEN", csrf.token())
                .header("Idempotency-Key", "request-more-information")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"outcome":"NEEDS_INFORMATION","reasonCode":"MISSING_INFORMATION",
                     "rationale":"Please provide the missing supporting information"}
                    """))
            .andExpect(status().isCreated()).andReturn();
        String decisionId = objectMapper.readTree(requestInformation.getResponse().getContentAsByteArray())
            .get("id").asText();
        JsonNode pendingStatus = objectMapper.readTree(mockMvc.perform(
                get("/api/v1/kyc/cases/{caseId}/status", caseId).cookie(supervisorSession))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray());
        assertEquals("NEEDS_INFORMATION", pendingStatus.get("status").asText());

        mockMvc.perform(post("/api/v1/kyc/cases/{caseId}/review/start", caseId)
                .cookie(analystSession, csrf.cookie())
                .header("X-XSRF-TOKEN", csrf.token()))
            .andExpect(status().isOk());
        MvcResult retry = mockMvc.perform(post("/api/v1/kyc/cases/{caseId}/verification-results", caseId)
                .cookie(analystSession, csrf.cookie())
                .header("X-XSRF-TOKEN", csrf.token())
                .header("Idempotency-Key", "request-more-information")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"outcome":"NEEDS_INFORMATION","reasonCode":"MISSING_INFORMATION",
                     "rationale":"Please provide the missing supporting information"}
                    """))
            .andExpect(status().isCreated()).andReturn();
        assertEquals(decisionId, objectMapper.readTree(retry.getResponse().getContentAsByteArray())
            .get("id").asText());
        JsonNode activeStatus = objectMapper.readTree(mockMvc.perform(
                get("/api/v1/kyc/cases/{caseId}/status", caseId).cookie(analystSession))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray());
        assertEquals("IN_REVIEW", activeStatus.get("status").asText());
        assertEquals(1, verificationDecisions.findAllByKycCase_IdOrderByCreatedAtDesc(caseId).size());
        assertEquals(3, caseStatusHistory.findAllByKycCase_IdOrderByCreatedAtAsc(caseId).size());
    }

    @Test
    void customerCanReplyToInformationRequestWithOnlySameCaseDocuments() throws Exception {
        Csrf csrf = fetchCsrf();
        UserAccount customer = createUser("CUSTOMER");
        Cookie customerSession = login(customer.getEmail(), csrf);
        Cookie analystSession = login(analyst.getEmail(), csrf);
        String customerId = createCustomer(customerSession, csrf);
        String caseId = createCase(customerSession, csrf, customerId);
        String otherCaseId = createCase(customerSession, csrf, customerId);

        mockMvc.perform(post("/api/v1/kyc/cases/{caseId}/assignments", caseId)
                .cookie(analystSession, csrf.cookie())
                .header("X-XSRF-TOKEN", csrf.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsBytes(new KycCaseService.AssignmentRequest(analyst.getId()))))
            .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/kyc/cases/{caseId}/review/start", caseId)
                .cookie(analystSession, csrf.cookie())
                .header("X-XSRF-TOKEN", csrf.token()))
            .andExpect(status().isOk());

        MvcResult submitted = mockMvc.perform(post(
                    "/api/v1/kyc/cases/{caseId}/verification-results", caseId)
                .cookie(analystSession, csrf.cookie())
                .header("X-XSRF-TOKEN", csrf.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"outcome":"NEEDS_INFORMATION","reasonCode":"MISSING_INFORMATION",
                     "rationale":"Please upload the current proof of address"}
                    """))
            .andExpect(status().isCreated()).andReturn();
        String decisionId = objectMapper.readTree(submitted.getResponse().getContentAsByteArray())
            .get("id").asText();

        JsonNode requestHistory = objectMapper.readTree(mockMvc.perform(
                get("/api/v1/kyc/cases/{caseId}/communications", caseId).cookie(customerSession))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray());
        assertEquals(1, requestHistory.size());
        assertEquals("INFORMATION_REQUEST", requestHistory.get(0).get("type").asText());
        assertEquals(decisionId, requestHistory.get(0).get("sourceDecisionId").asText());

        String ownDocumentId = objectMapper.readTree(
            uploadFirstVersion(caseId, customerSession, csrf, createPdf())).get("id").asText();
        String foreignDocumentId = objectMapper.readTree(
            uploadFirstVersion(otherCaseId, customerSession, csrf, createPdf())).get("id").asText();
        String requestId = requestHistory.get(0).get("id").asText();

        mockMvc.perform(post("/api/v1/kyc/cases/{caseId}/communications/responses", caseId)
                .cookie(customerSession, csrf.cookie())
                .header("X-XSRF-TOKEN", csrf.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsBytes(new com.example.kyc.kyc.CaseCommunicationService
                    .CustomerResponseRequest(requestId, "I have uploaded the requested statement",
                        List.of(foreignDocumentId)))))
            .andExpect(status().isBadRequest());

        MvcResult response = mockMvc.perform(post(
                    "/api/v1/kyc/cases/{caseId}/communications/responses", caseId)
                .cookie(customerSession, csrf.cookie())
                .header("X-XSRF-TOKEN", csrf.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsBytes(new com.example.kyc.kyc.CaseCommunicationService
                    .CustomerResponseRequest(requestId, "I have uploaded the requested statement",
                        List.of(ownDocumentId)))))
            .andExpect(status().isCreated()).andReturn();
        JsonNode responseBody = objectMapper.readTree(response.getResponse().getContentAsByteArray());
        assertEquals("CUSTOMER_RESPONSE", responseBody.get("type").asText());
        assertEquals(requestId, responseBody.get("parentCommunicationId").asText());
        assertEquals(ownDocumentId, responseBody.get("documents").get(0).get("id").asText());

        mockMvc.perform(post("/api/v1/kyc/cases/{caseId}/communications/responses", caseId)
                .cookie(customerSession, csrf.cookie())
                .header("X-XSRF-TOKEN", csrf.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsBytes(new com.example.kyc.kyc.CaseCommunicationService
                    .CustomerResponseRequest(requestId, "Duplicate response", List.of()))))
            .andExpect(status().isConflict());
        mockMvc.perform(get("/api/v1/kyc/cases/{caseId}/communications", caseId).cookie(analystSession))
            .andExpect(status().isOk())
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.length()").value(2));
        JsonNode waitingStatus = objectMapper.readTree(mockMvc.perform(
                get("/api/v1/kyc/cases/{caseId}/status", caseId).cookie(customerSession))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray());
        assertEquals("NEEDS_INFORMATION", waitingStatus.get("status").asText());
        mockMvc.perform(post("/api/v1/kyc/cases/{caseId}/review/start", caseId)
                .cookie(analystSession, csrf.cookie())
                .header("X-XSRF-TOKEN", csrf.token()))
            .andExpect(status().isOk());
        assertTrue(auditEvents.findAll().stream()
            .anyMatch(event -> event.getEventType().equals("KYC_INFORMATION_REQUESTED")));
        assertTrue(auditEvents.findAll().stream()
            .anyMatch(event -> event.getEventType().equals("KYC_CUSTOMER_INFORMATION_PROVIDED")));
    }

    @Test
    void highRiskRejectionRequiresSupervisorApproval() throws Exception {
        Csrf csrf = fetchCsrf();
        Cookie supervisorSession = login(supervisor.getEmail(), csrf);
        String customerId = createCustomer(supervisorSession, csrf);
        String caseId = createCase(supervisorSession, csrf, customerId);

        mockMvc.perform(patch("/api/v1/kyc/cases/{caseId}", caseId)
                .cookie(supervisorSession, csrf.cookie())
                .header("X-XSRF-TOKEN", csrf.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"riskLevel":"HIGH"}
                    """))
            .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/kyc/cases/{caseId}/assignments", caseId)
                .cookie(supervisorSession, csrf.cookie())
                .header("X-XSRF-TOKEN", csrf.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsBytes(new KycCaseService.AssignmentRequest(analyst.getId()))))
            .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/kyc/cases/{caseId}/review/start", caseId)
                .cookie(supervisorSession, csrf.cookie())
                .header("X-XSRF-TOKEN", csrf.token()))
            .andExpect(status().isOk());

        JsonNode uploaded = objectMapper.readTree(
            uploadFirstVersion(caseId, supervisorSession, csrf, createPdf()));
        String documentId = uploaded.get("id").asText();
        mockMvc.perform(patch("/api/v1/kyc/cases/{caseId}/documents/{documentId}/status", caseId, documentId)
                .cookie(supervisorSession, csrf.cookie())
                .header("X-XSRF-TOKEN", csrf.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"status":"REJECTED"}
                    """))
            .andExpect(status().isOk());

        for (String checkType : List.of("CUSTOMER_INFORMATION", "IDENTITY_DOCUMENT", "ADDRESS_DOCUMENT")) {
            mockMvc.perform(post("/api/v1/kyc/cases/{caseId}/verification-checks", caseId)
                    .cookie(supervisorSession, csrf.cookie())
                    .header("X-XSRF-TOKEN", csrf.token())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsBytes(
                        new com.example.kyc.kyc.VerificationWorkflowService.CreateCheckRequest(
                            checkType, com.example.kyc.kyc.VerificationEnums.CheckResult.PASS,
                            "Synthetic test check", documentId))))
                .andExpect(status().isCreated());
        }

        Cookie analystSession = login(analyst.getEmail(), csrf);
        MvcResult submitted = mockMvc.perform(post(
                    "/api/v1/kyc/cases/{caseId}/verification-results", caseId)
                .cookie(analystSession, csrf.cookie())
                .header("X-XSRF-TOKEN", csrf.token())
                .header("Idempotency-Key", "high-risk-rejection")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"outcome":"REJECT","reasonCode":"EVIDENCE_FAILED"}
                    """))
            .andExpect(status().isCreated()).andReturn();

        JsonNode decision = objectMapper.readTree(submitted.getResponse().getContentAsByteArray());
        assertEquals("REJECT", decision.get("outcome").asText());
        assertTrue(decision.get("approvalRequired").asBoolean());
        JsonNode caseStatus = objectMapper.readTree(mockMvc.perform(
                get("/api/v1/kyc/cases/{caseId}/status", caseId).cookie(supervisorSession))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray());
        assertEquals("PENDING_SUPERVISOR_APPROVAL", caseStatus.get("status").asText());
        assertEquals(0, supervisorApprovals.findAllByDecision_KycCase_Id(caseId).size());
        assertEquals(2, caseStatusHistory.findAllByKycCase_IdOrderByCreatedAtAsc(caseId).size());
        JsonNode pendingApprovals = objectMapper.readTree(mockMvc.perform(
                get("/api/v1/kyc/cases/{caseId}/approvals/pending", caseId).cookie(supervisorSession))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray());
        assertEquals(1, pendingApprovals.size());
        mockMvc.perform(post("/api/v1/kyc/cases/{caseId}/verification-decisions/{decisionId}/approval",
                    caseId, decision.get("id").asText())
                .cookie(supervisorSession, csrf.cookie())
                .header("X-XSRF-TOKEN", csrf.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"outcome":"APPROVED","reason":"Supervisor confirmed rejection"}
                    """))
            .andExpect(status().isOk());
        JsonNode reviewedStatus = objectMapper.readTree(mockMvc.perform(
                get("/api/v1/kyc/cases/{caseId}/status", caseId).cookie(supervisorSession))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray());
        assertEquals("REJECTED", reviewedStatus.get("status").asText());
        assertEquals(1, supervisorApprovals.findAllByDecision_KycCase_Id(caseId).size());
        assertEquals(3, caseStatusHistory.findAllByKycCase_IdOrderByCreatedAtAsc(caseId).size());

        MvcResult retry = mockMvc.perform(post(
                    "/api/v1/kyc/cases/{caseId}/verification-results", caseId)
                .cookie(analystSession, csrf.cookie())
                .header("X-XSRF-TOKEN", csrf.token())
                .header("Idempotency-Key", "high-risk-rejection")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"outcome":"REJECT","reasonCode":"EVIDENCE_FAILED"}
                    """))
            .andExpect(status().isCreated()).andReturn();
        assertEquals(decision.get("id").asText(),
            objectMapper.readTree(retry.getResponse().getContentAsByteArray()).get("id").asText());
        mockMvc.perform(get("/api/v1/kyc/cases/{caseId}/approvals/pending", caseId)
                .cookie(supervisorSession))
            .andExpect(status().isConflict());
    }

    private UserAccount createUser(String roleCode) {
        Role role = roles.findByRoleCode(roleCode).orElseGet(() -> roles.save(new Role(roleCode)));
        String email = roleCode.toLowerCase() + "-" + UUID.randomUUID() + "@example.test";
        return users.save(new UserAccount(email, passwordEncoder.encode(PASSWORD),
            "Fictional " + roleCode, Set.of(role)));
    }

    private UserAccount createUserWithRoles(String... roleCodes) {
        Set<Role> userRoles = java.util.Arrays.stream(roleCodes)
            .map(roleCode -> roles.findByRoleCode(roleCode).orElseGet(() -> roles.save(new Role(roleCode))))
            .collect(java.util.stream.Collectors.toSet());
        String email = "dual-role-" + UUID.randomUUID() + "@example.test";
        return users.save(new UserAccount(email, passwordEncoder.encode(PASSWORD), "Fictional dual role", userRoles));
    }

    private String createCustomer(Cookie session, Csrf csrf) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/customers")
                .cookie(session, csrf.cookie())
                .header("X-XSRF-TOKEN", csrf.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsBytes(
                    new CustomerService.CreateCustomerRequest("Synthetic Customer",
                        "synthetic-" + UUID.randomUUID() + "@example.test"))))
            .andExpect(status().isCreated()).andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsByteArray()).get("id").asText();
    }

    private String createCase(Cookie session, Csrf csrf, String customerId) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/kyc/cases")
                .cookie(session, csrf.cookie())
                .header("X-XSRF-TOKEN", csrf.token())
                .header("Idempotency-Key", UUID.randomUUID().toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsBytes(new KycCaseService.CreateCaseRequest(customerId,
                    com.example.kyc.kyc.KycEnums.CaseType.INDIVIDUAL,
                    com.example.kyc.kyc.KycEnums.RiskLevel.LOW,
                    com.example.kyc.kyc.KycEnums.Priority.NORMAL))))
            .andExpect(status().isCreated()).andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsByteArray()).get("id").asText();
    }

    private String uploadFirstVersion(String caseId, Cookie session, Csrf csrf, byte[] pdf) throws Exception {
        return mockMvc.perform(multipart("/api/v1/kyc/cases/{caseId}/documents", caseId)
                .file(new MockMultipartFile("file", "synthetic-evidence.pdf", "application/pdf", pdf.clone()))
                .param("documentType", "IDENTITY_EVIDENCE")
                .cookie(session, csrf.cookie())
                .header("X-XSRF-TOKEN", csrf.token())
                .header("Idempotency-Key", "initial-document-1"))
            .andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsString();
    }

    private void uploadVersion(String caseId, String documentId, Cookie session, Csrf csrf, byte[] pdf)
        throws Exception {
        mockMvc.perform(multipart("/api/v1/kyc/cases/{caseId}/documents/{documentId}/versions",
                    caseId, documentId)
                .file(new MockMultipartFile("file", "synthetic-evidence-v2.pdf", "application/pdf", pdf.clone()))
                .cookie(session, csrf.cookie())
                .header("X-XSRF-TOKEN", csrf.token())
                .header("Idempotency-Key", "document-version-2"))
            .andExpect(status().isOk());
    }

    private Cookie login(String email, Csrf csrf) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                .with(request -> {
                    request.setRemoteAddr("198.51.100." + (LOGIN_SOURCE.incrementAndGet() % 254 + 1));
                    return request;
                })
                .cookie(csrf.cookie())
                .header("X-XSRF-TOKEN", csrf.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsBytes(new AuthController.LoginRequest(email, PASSWORD))))
            .andExpect(status().isOk()).andReturn();
        Cookie session = result.getResponse().getCookie(SessionAuthenticationFilter.COOKIE_NAME);
        assertNotNull(session);
        return session;
    }

    private Csrf fetchCsrf() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/auth/csrf"))
            .andExpect(status().isOk()).andReturn();
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsByteArray());
        Cookie cookie = result.getResponse().getCookie("XSRF-TOKEN");
        assertNotNull(cookie);
        return new Csrf(cookie, body.get("token").asText());
    }

    private byte[] createPdf() throws Exception {
        try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            document.addPage(new PDPage());
            document.save(output);
            return output.toByteArray();
        }
    }

    private record Csrf(Cookie cookie, String token) {
    }
}
