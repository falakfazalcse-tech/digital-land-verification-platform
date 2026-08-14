CREATE DATABASE IF NOT EXISTS landdeal_db;
USE landdeal_db;

-- Properties Table
CREATE TABLE IF NOT EXISTS properties (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    location VARCHAR(255) NOT NULL,
    plot_id VARCHAR(50) NOT NULL,
    land_price DECIMAL(12,2) NOT NULL,
    service_fee DECIMAL(12,2) NOT NULL,
    verification_fee DECIMAL(12,2) NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Initial Mock Data
INSERT INTO properties (id, title, location, plot_id, land_price, service_fee, verification_fee, total_amount)
VALUES (1, '12.5 katha Residential Plot', 'Bashundhara, Dhaka', '#LD-882049', 2800000.00, 20000.00, 5000.00, 2825000.00)
ON DUPLICATE KEY UPDATE id=id;

-- Payments/Transactions Table
CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    transaction_id VARCHAR(100) UNIQUE NOT NULL,
    property_id INT NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    account_number VARCHAR(100) DEFAULT NULL,
    amount DECIMAL(12,2) NOT NULL,
    otp VARCHAR(10) DEFAULT NULL,
    terms_accepted BOOLEAN DEFAULT TRUE,
    status ENUM('initiated', 'details_submitted', 'completed', 'failed') DEFAULT 'initiated',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
);