package com.example.kyc.user;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface UserRepository extends JpaRepository<UserAccount, String> {
    Optional<UserAccount> findByEmailIgnoreCase(String email);

    @Query(value = """
        select distinct user from UserAccount user join user.roles role
        where user.enabled = true and role.roleCode = 'KYC_ANALYST'
          and (:search is null or lower(user.displayName) like lower(concat('%', :search, '%')))
        """,
        countQuery = """
        select count(distinct user) from UserAccount user join user.roles role
        where user.enabled = true and role.roleCode = 'KYC_ANALYST'
          and (:search is null or lower(user.displayName) like lower(concat('%', :search, '%')))
        """)
    Page<UserAccount> findActiveAnalysts(@Param("search") String search, Pageable pageable);
}
