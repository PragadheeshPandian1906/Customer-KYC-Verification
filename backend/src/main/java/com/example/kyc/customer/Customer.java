package com.example.kyc.customer;

import com.example.kyc.common.PersistentEntity;
import com.example.kyc.user.UserAccount;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import jakarta.persistence.OneToMany;

import java.util.ArrayList;
import java.util.List;
@Entity
@Table(name = "customers")
public class Customer extends PersistentEntity {
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_user_id", unique = true)
    private UserAccount owner;

    @Column(name = "display_name", nullable = false, length = 160)
    private String displayName;

    @Column(nullable = false, length = 254)
    private String email;

    @OneToMany(mappedBy = "customer", fetch = FetchType.LAZY)
    private List<com.example.kyc.kyc.KycCase> kycCases = new ArrayList<>();

    protected Customer() {
    }

    public Customer(UserAccount owner, String displayName, String email) {
        this.owner = owner;
        this.displayName = displayName;
        this.email = email.toLowerCase();
    }

    public UserAccount getOwner() {
        return owner;
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getEmail() {
        return email;
    }

    public void update(String displayName, String email) {
        if (displayName != null) {
            this.displayName = displayName;
        }
        if (email != null) {
            this.email = email.toLowerCase();
        }
    }
}
