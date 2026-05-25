package com.plugin.repository;

import com.plugin.entity.User;
import com.plugin.enums.Role;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;
import java.util.Optional;

public interface UserRepository extends MongoRepository<User, String> {
    Optional<User> findById(Long id);
    List<User> findByIdIn(List<Long> ids);
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);
    long countByRole(Role role);
    List<User> findByRole(Role role);
    Page<User> findByRole(Role role, Pageable pageable);
    Page<User> findByRoleAndActive(Role role, Boolean active, Pageable pageable);
    Page<User> findByRoleAndFullNameContainingIgnoreCase(Role role, String fullName, Pageable pageable);
    Page<User> findByRoleAndActiveAndFullNameContainingIgnoreCase(Role role, Boolean active, String fullName, Pageable pageable);
}
