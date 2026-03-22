-- ============================================
-- PLUGIN DB SCHEMA
-- ============================================

CREATE TABLE IF NOT EXISTS users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(20) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    vehicle_make VARCHAR(50),
    vehicle_model VARCHAR(50),
    vehicle_registration VARCHAR(20),
    created_at DATETIME NOT NULL,
    updated_at DATETIME,
    INDEX idx_users_email (email),
    INDEX idx_users_role (role),
    INDEX idx_users_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_vehicles (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    vehicle_make VARCHAR(50) NOT NULL,
    vehicle_model VARCHAR(50) NOT NULL,
    vehicle_registration VARCHAR(20) NOT NULL,
    vehicle_nickname VARCHAR(50),
    active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL,
    updated_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uq_user_vehicle_registration (user_id, vehicle_registration),
    INDEX idx_vehicle_user (user_id),
    INDEX idx_vehicle_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS stations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    address VARCHAR(300) NOT NULL,
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(10),
    contact_phone VARCHAR(20),
    contact_email VARCHAR(150),
    manager_id BIGINT,
    latitude DOUBLE,
    longitude DOUBLE,
    opening_time TIME NOT NULL,
    closing_time TIME NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL,
    updated_at DATETIME,
    FOREIGN KEY (manager_id) REFERENCES users(id),
    INDEX idx_stations_city (city),
    INDEX idx_stations_pincode (pincode),
    INDEX idx_stations_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS charging_points (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    identifier VARCHAR(50) NOT NULL UNIQUE,
    station_id BIGINT NOT NULL,
    point_type VARCHAR(10) NOT NULL,
    max_power_kw DOUBLE NOT NULL,
    connector_type VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
    created_at DATETIME NOT NULL,
    updated_at DATETIME,
    FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE CASCADE,
    INDEX idx_cp_station (station_id),
    INDEX idx_cp_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pricing (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    station_id BIGINT NOT NULL,
    point_type VARCHAR(10) NOT NULL,
    pricing_model VARCHAR(15) NOT NULL,
    rate_per_unit DECIMAL(10,2) NOT NULL,
    description VARCHAR(200),
    created_at DATETIME NOT NULL,
    updated_at DATETIME,
    FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE CASCADE,
    UNIQUE KEY uq_pricing_station_type (station_id, point_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS bookings (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    reference_id VARCHAR(20) NOT NULL UNIQUE,
    customer_id BIGINT NOT NULL,
    station_id BIGINT NOT NULL,
    charging_point_id BIGINT NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    locked_rate_per_unit DECIMAL(10,2),
    locked_rate_type VARCHAR(15),
    status VARCHAR(15) NOT NULL DEFAULT 'CONFIRMED',
    cancellation_reason VARCHAR(500),
    reschedule_request_status VARCHAR(20) NOT NULL DEFAULT 'NONE',
    reschedule_requested_start_time DATETIME,
    reschedule_requested_end_time DATETIME,
    reschedule_request_reason VARCHAR(500),
    reschedule_requested_at DATETIME,
    reschedule_reviewed_at DATETIME,
    reschedule_reviewed_by VARCHAR(150),
    created_at DATETIME NOT NULL,
    updated_at DATETIME,
    FOREIGN KEY (customer_id) REFERENCES users(id),
    FOREIGN KEY (station_id) REFERENCES stations(id),
    FOREIGN KEY (charging_point_id) REFERENCES charging_points(id),
    INDEX idx_booking_customer (customer_id),
    INDEX idx_booking_point_time (charging_point_id, start_time, end_time),
    INDEX idx_booking_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS charging_sessions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    booking_id BIGINT NOT NULL UNIQUE,
    charging_point_id BIGINT NOT NULL,
    customer_id BIGINT NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME,
    energy_delivered_kwh DECIMAL(10,2),
    status VARCHAR(15) NOT NULL DEFAULT 'IN_PROGRESS',
    created_at DATETIME NOT NULL,
    FOREIGN KEY (booking_id) REFERENCES bookings(id),
    FOREIGN KEY (charging_point_id) REFERENCES charging_points(id),
    FOREIGN KEY (customer_id) REFERENCES users(id),
    INDEX idx_session_customer (customer_id),
    INDEX idx_session_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS bills (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    invoice_number VARCHAR(20) NOT NULL UNIQUE,
    session_id BIGINT NOT NULL UNIQUE,
    customer_id BIGINT NOT NULL,
    station_id BIGINT NOT NULL,
    energy_kwh DECIMAL(10,2),
    duration_minutes BIGINT,
    rate_applied DECIMAL(10,2) NOT NULL,
    rate_type VARCHAR(15),
    total_amount DECIMAL(10,2) NOT NULL,
    payment_status VARCHAR(10) NOT NULL DEFAULT 'UNPAID',
    created_at DATETIME NOT NULL,
    paid_at DATETIME,
    FOREIGN KEY (session_id) REFERENCES charging_sessions(id),
    FOREIGN KEY (customer_id) REFERENCES users(id),
    FOREIGN KEY (station_id) REFERENCES stations(id),
    INDEX idx_bill_customer (customer_id),
    INDEX idx_bill_station (station_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notifications (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    title VARCHAR(100) NOT NULL,
    message VARCHAR(500) NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_notif_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS password_reset_otps (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(150) NOT NULL,
    otp VARCHAR(6) NOT NULL,
    delivery_method VARCHAR(10) NOT NULL,
    expires_at DATETIME NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL,
    INDEX idx_otp_email (email),
    INDEX idx_otp_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pending_registrations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    token VARCHAR(100) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL,
    INDEX idx_pending_email (email),
    INDEX idx_pending_token (token),
    INDEX idx_pending_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS station_manager_applications (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNIQUE,
    approved_station_id BIGINT,
    status VARCHAR(20) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    application_reference_id VARCHAR(11) UNIQUE,
    phone VARCHAR(20) NOT NULL,
    date_of_birth DATE,
    residential_address VARCHAR(300) NOT NULL,
    government_id_type VARCHAR(50) NOT NULL,
    government_id_number VARCHAR(100) NOT NULL,
    government_id_document_reference VARCHAR(500) NOT NULL,
    selfie_document_reference VARCHAR(500) NOT NULL,
    business_type VARCHAR(30) NOT NULL,
    business_name VARCHAR(150) NOT NULL,
    legal_business_name VARCHAR(150) NOT NULL,
    pan_number VARCHAR(20) NOT NULL,
    gst_number VARCHAR(20),
    business_registration_number VARCHAR(100),
    business_address VARCHAR(300) NOT NULL,
    authorized_signatory_name VARCHAR(100) NOT NULL,
    authorized_signatory_designation VARCHAR(100) NOT NULL,
    registration_proof_reference VARCHAR(500) NOT NULL,
    authorization_proof_reference VARCHAR(500) NOT NULL,
    station_name VARCHAR(150) NOT NULL,
    station_address VARCHAR(300) NOT NULL,
    station_city VARCHAR(100) NOT NULL,
    station_state VARCHAR(100) NOT NULL,
    station_pincode VARCHAR(10) NOT NULL,
    station_latitude DOUBLE NOT NULL,
    station_longitude DOUBLE NOT NULL,
    property_occupancy_type VARCHAR(20) NOT NULL,
    property_document_reference VARCHAR(500) NOT NULL,
    electricity_consumer_number VARCHAR(100) NOT NULL,
    electricity_bill_reference VARCHAR(500) NOT NULL,
    opening_time TIME NOT NULL,
    closing_time TIME NOT NULL,
    emergency_contact_number VARCHAR(20) NOT NULL,
    bank_account_holder_name VARCHAR(100) NOT NULL,
    bank_name VARCHAR(100) NOT NULL,
    bank_account_number VARCHAR(30) NOT NULL,
    bank_ifsc_code VARCHAR(20) NOT NULL,
    bank_proof_reference VARCHAR(500) NOT NULL,
    number_of_chargers INT NOT NULL,
    charger_types_summary VARCHAR(500) NOT NULL,
    connector_types_summary VARCHAR(500) NOT NULL,
    total_capacity_kw DOUBLE NOT NULL,
    charger_manufacturer_names VARCHAR(500) NOT NULL,
    installation_photo_reference VARCHAR(500) NOT NULL,
    site_photo_reference VARCHAR(500) NOT NULL,
    submitted_at DATETIME NOT NULL,
    reviewed_at DATETIME,
    reviewed_by VARCHAR(150),
    review_notes VARCHAR(500),
    credentials_issued_at DATETIME,
    credentials_issued_by VARCHAR(150),
    created_at DATETIME NOT NULL,
    updated_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_station_id) REFERENCES stations(id),
    INDEX idx_station_manager_status (status),
    INDEX idx_station_manager_submitted (submitted_at),
    INDEX idx_station_manager_business_type (business_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS station_manager_application_documents (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    application_id BIGINT NOT NULL,
    document_type VARCHAR(50) NOT NULL,
    reference_number VARCHAR(100),
    document_reference VARCHAR(500) NOT NULL,
    notes VARCHAR(300),
    FOREIGN KEY (application_id) REFERENCES station_manager_applications(id) ON DELETE CASCADE,
    INDEX idx_station_manager_docs_application (application_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS station_manager_application_files (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    application_id BIGINT NOT NULL,
    slot_type VARCHAR(40) NOT NULL,
    business_document_type VARCHAR(50),
    original_file_name VARCHAR(255) NOT NULL,
    content_type VARCHAR(100),
    file_size BIGINT NOT NULL,
    file_data LONGBLOB NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME,
    FOREIGN KEY (application_id) REFERENCES station_manager_applications(id) ON DELETE CASCADE,
    INDEX idx_station_manager_files_application (application_id),
    INDEX idx_station_manager_files_slot (slot_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id BIGINT,
    performed_by VARCHAR(150),
    details VARCHAR(1000),
    created_at DATETIME NOT NULL,
    INDEX idx_audit_entity (entity_type, entity_id),
    INDEX idx_audit_time (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE bookings
    ADD COLUMN locked_rate_per_unit DECIMAL(10,2);

ALTER TABLE bookings
    ADD COLUMN locked_rate_type VARCHAR(15);

ALTER TABLE users
    ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE bookings
    ADD COLUMN vehicle_id BIGINT;

ALTER TABLE bookings
    ADD COLUMN cancellation_reason VARCHAR(500);

ALTER TABLE bookings
    ADD COLUMN reschedule_request_status VARCHAR(20) NOT NULL DEFAULT 'NONE';

ALTER TABLE bookings
    ADD COLUMN reschedule_requested_start_time DATETIME;

ALTER TABLE bookings
    ADD COLUMN reschedule_requested_end_time DATETIME;

ALTER TABLE bookings
    ADD COLUMN reschedule_request_reason VARCHAR(500);

ALTER TABLE bookings
    ADD COLUMN reschedule_requested_at DATETIME;

ALTER TABLE bookings
    ADD COLUMN reschedule_reviewed_at DATETIME;

ALTER TABLE bookings
    ADD COLUMN reschedule_reviewed_by VARCHAR(150);

ALTER TABLE bookings
    ADD CONSTRAINT fk_booking_vehicle FOREIGN KEY (vehicle_id) REFERENCES user_vehicles(id);

CREATE INDEX idx_booking_vehicle ON bookings(vehicle_id);

ALTER TABLE user_vehicles
    ADD COLUMN vehicle_nickname VARCHAR(50);

INSERT INTO user_vehicles (user_id, vehicle_make, vehicle_model, vehicle_registration, active, created_at, updated_at)
SELECT u.id,
       u.vehicle_make,
       u.vehicle_model,
       UPPER(REPLACE(REPLACE(u.vehicle_registration, ' ', ''), '-', '')),
       TRUE,
       COALESCE(u.created_at, NOW()),
       u.updated_at
FROM users u
WHERE u.vehicle_make IS NOT NULL
  AND u.vehicle_model IS NOT NULL
  AND u.vehicle_registration IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM user_vehicles uv
      WHERE uv.user_id = u.id
        AND uv.vehicle_registration = UPPER(REPLACE(REPLACE(u.vehicle_registration, ' ', ''), '-', ''))
  );

UPDATE bookings b
SET b.vehicle_id = (
    SELECT uv.id
    FROM user_vehicles uv
    WHERE uv.user_id = b.customer_id
    ORDER BY uv.created_at ASC, uv.id ASC
    LIMIT 1
)
WHERE b.vehicle_id IS NULL
  AND EXISTS (
      SELECT 1
      FROM user_vehicles uv
      WHERE uv.user_id = b.customer_id
  );

UPDATE pricing
SET pricing_model = 'PER_KWH'
WHERE pricing_model <> 'PER_KWH';

UPDATE bookings
SET locked_rate_type = 'PER_KWH'
WHERE locked_rate_type IS NOT NULL
  AND locked_rate_type <> 'PER_KWH';

UPDATE bills
SET rate_type = 'PER_KWH'
WHERE rate_type IS NOT NULL
  AND rate_type <> 'PER_KWH';

ALTER TABLE stations
    ADD COLUMN manager_id BIGINT;

ALTER TABLE stations
    ADD CONSTRAINT fk_station_manager FOREIGN KEY (manager_id) REFERENCES users(id);

ALTER TABLE station_manager_applications
    ADD COLUMN approved_station_id BIGINT;

ALTER TABLE station_manager_applications
    ADD CONSTRAINT fk_station_manager_approved_station FOREIGN KEY (approved_station_id) REFERENCES stations(id);

ALTER TABLE station_manager_applications
    MODIFY COLUMN user_id BIGINT NULL;

ALTER TABLE station_manager_applications
    ADD CONSTRAINT uq_station_manager_application_email UNIQUE (email);

ALTER TABLE station_manager_applications
    ADD COLUMN credentials_issued_at DATETIME;

ALTER TABLE station_manager_applications
    ADD COLUMN credentials_issued_by VARCHAR(150);

ALTER TABLE station_manager_applications
    ADD COLUMN application_reference_id VARCHAR(11);

ALTER TABLE station_manager_applications
    ADD CONSTRAINT uq_station_manager_application_reference_id UNIQUE (application_reference_id);
