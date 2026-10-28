package com.example.kyc.customer;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CustomerRepository extends JpaRepository<Customer, String> {
    Page<Customer> findAllByOwner_Id(String ownerId, Pageable pageable);

    @Query(value = "select distinct customer from Customer customer join KycCase kycCase "
        + "on kycCase.customer = customer where kycCase.assignedTo.id = :analystId",
        countQuery = "select count(distinct customer.id) from Customer customer join KycCase kycCase "
            + "on kycCase.customer = customer where kycCase.assignedTo.id = :analystId")
    Page<Customer> findAllAssignedToAnalyst(@Param("analystId") String analystId, Pageable pageable);

    boolean existsByIdAndKycCases_AssignedTo_Id(String id, String analystId);
}
