package com.example.kyc.role;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "roles")
public class Role {
    @Id
    @Column(length = 36, columnDefinition = "CHAR(36)")
    private String id;

    @Column(name = "role_code", nullable = false, unique = true, length = 40)
    private String roleCode;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected Role() {
    }

    public Role(String roleCode) {
        this.id = UUID.randomUUID().toString();
        this.roleCode = roleCode;
        this.createdAt = Instant.now();
    }

    public String getRoleCode() {
        return roleCode;
    }
}
