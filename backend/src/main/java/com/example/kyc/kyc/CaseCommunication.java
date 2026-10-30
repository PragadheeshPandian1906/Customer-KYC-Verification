package com.example.kyc.kyc;

import com.example.kyc.common.PersistentEntity;
import com.example.kyc.document.KycDocument;
import com.example.kyc.user.UserAccount;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(name = "case_communications")
public class CaseCommunication extends PersistentEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "case_id", nullable = false, updatable = false)
    private KycCase kycCase;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sender_user_id", nullable = false, updatable = false)
    private UserAccount sender;

    @Column(name = "sender_role", nullable = false, length = 40, updatable = false)
    private String senderRole;

    @Enumerated(EnumType.STRING)
    @Column(name = "communication_type", nullable = false, length = 32, updatable = false)
    private CommunicationType type;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_communication_id", updatable = false)
    private CaseCommunication parent;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_decision_id", updatable = false)
    private VerificationDecision sourceDecision;

    @Column(nullable = false, length = 2000, updatable = false)
    private String message;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "case_communication_documents",
        joinColumns = @JoinColumn(name = "communication_id"),
        inverseJoinColumns = @JoinColumn(name = "document_id"))
    private Set<KycDocument> documents = new LinkedHashSet<>();

    protected CaseCommunication() {
    }

    private CaseCommunication(KycCase kycCase, UserAccount sender, String senderRole,
                              CommunicationType type, CaseCommunication parent,
                              VerificationDecision sourceDecision, String message,
                              Set<KycDocument> documents) {
        this.kycCase = kycCase;
        this.sender = sender;
        this.senderRole = senderRole;
        this.type = type;
        this.parent = parent;
        this.sourceDecision = sourceDecision;
        this.message = message;
        this.documents = new LinkedHashSet<>(documents);
    }

    public static CaseCommunication informationRequest(KycCase kycCase, UserAccount sender,
                                                       VerificationDecision decision, String message) {
        return new CaseCommunication(kycCase, sender, "KYC_ANALYST",
            CommunicationType.INFORMATION_REQUEST, null, decision, message, Set.of());
    }

    public static CaseCommunication customerResponse(KycCase kycCase, UserAccount sender,
                                                     CaseCommunication request, String message,
                                                     Set<KycDocument> documents) {
        return new CaseCommunication(kycCase, sender, "CUSTOMER",
            CommunicationType.CUSTOMER_RESPONSE, request, null, message, documents);
    }

    public KycCase getKycCase() {
        return kycCase;
    }

    public UserAccount getSender() {
        return sender;
    }

    public String getSenderRole() {
        return senderRole;
    }

    public CommunicationType getType() {
        return type;
    }

    public CaseCommunication getParent() {
        return parent;
    }

    public VerificationDecision getSourceDecision() {
        return sourceDecision;
    }

    public String getMessage() {
        return message;
    }

    public Set<KycDocument> getDocuments() {
        return Set.copyOf(documents);
    }

    public enum CommunicationType {
        INFORMATION_REQUEST,
        CUSTOMER_RESPONSE
    }
}
