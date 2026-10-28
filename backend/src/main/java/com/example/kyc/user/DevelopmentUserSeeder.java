package com.example.kyc.user;

import com.example.kyc.role.RoleRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;

@Component
@Profile("local")
public class DevelopmentUserSeeder implements ApplicationRunner {
    private final UserRepository users;
    private final RoleRepository roles;
    private final PasswordEncoder passwordEncoder;
    private final String customerPassword;
    private final String analystPassword;
    private final String supervisorPassword;
    private final String adminPassword;

    public DevelopmentUserSeeder(UserRepository users, RoleRepository roles, PasswordEncoder passwordEncoder,
                                 @Value("${demo-users.customer-password}") String customerPassword,
                                 @Value("${demo-users.analyst-password}") String analystPassword,
                                 @Value("${demo-users.supervisor-password}") String supervisorPassword,
                                 @Value("${demo-users.admin-password}") String adminPassword) {
        this.users = users;
        this.roles = roles;
        this.passwordEncoder = passwordEncoder;
        this.customerPassword = customerPassword;
        this.analystPassword = analystPassword;
        this.supervisorPassword = supervisorPassword;
        this.adminPassword = adminPassword;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        seed("customer@example.test", "Fictional Customer", "CUSTOMER", customerPassword);
        seed("analyst@example.test", "Fictional Analyst", "KYC_ANALYST", analystPassword);
        seed("supervisor@example.test", "Fictional Supervisor", "COMPLIANCE_SUPERVISOR", supervisorPassword);
        seed("admin@example.test", "Fictional API Administrator", "API_CLIENT_ADMIN", adminPassword);
    }

    private void seed(String email, String name, String roleCode, String password) {
        if (password == null || password.length() < 12) {
            throw new IllegalStateException("Each local demo-user password must contain at least 12 characters");
        }
        if (users.findByEmailIgnoreCase(email).isEmpty()) {
            var role = roles.findByRoleCode(roleCode)
                .orElseThrow(() -> new IllegalStateException("Missing role seed: " + roleCode));
            users.save(new UserAccount(email, passwordEncoder.encode(password), name, Set.of(role)));
        }
    }
}
