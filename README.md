# PLUGIN - EV Charging Station Management System

A complete, production-style web application for managing electric vehicle charging stations with role-based access control, booking management, session tracking, billing, analytics, and more.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 (Vite), React Router 6, Framer Motion, Axios |
| Backend | Java 17, Spring Boot 3.2, Spring Security, Spring Data JPA |
| Database | MySQL 8+ |
| Auth | JWT (JSON Web Tokens) with BCrypt password hashing |
| Styling | Custom CSS (Tesla-inspired white theme), CSS Variables |

---

## How to Run

### Prerequisites

- **Java 17+** (JDK)
- **Maven 3.8+** (or use the Maven wrapper)
- **MySQL 8+** running locally
- **Node.js 18+** and **npm 9+**

### Step 1: Set Up MySQL Database

```sql
CREATE DATABASE IF NOT EXISTS plugin_db;
```

Ensure MySQL is running with:
- **Username:** `root`
- **Password:** `45srt`
- **Port:** `3306`

### Step 2: Start the Backend

```bash
cd plugin-backend

# On Windows (PowerShell):
$env:DB_URL="jdbc:mysql://localhost:3306/plugin_db?createDatabaseIfNotExist=true&useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true"
$env:DB_USER="root"
$env:DB_PASSWORD="45srt"
$env:JWT_SECRET="mySecretKeyForJwtTokenGenerationMustBe256BitsLongAtLeast2024Plugin"

# Build and run
mvn clean install -DskipTests
mvn spring-boot:run
```

Or on Linux/Mac:
```bash
export DB_URL="jdbc:mysql://localhost:3306/plugin_db?createDatabaseIfNotExist=true&useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true"
export DB_USER="root"
export DB_PASSWORD="45srt"
export JWT_SECRET="mySecretKeyForJwtTokenGenerationMustBe256BitsLongAtLeast2024Plugin"

mvn clean install -DskipTests && mvn spring-boot:run
```

The backend will start on **http://localhost:8080**.  
On first run, it automatically creates all tables and seeds initial data.

### Step 3: Start the Frontend

```bash
cd plugin-frontend
npm install
npm run dev
```

The frontend will start on **http://localhost:5173**.

### Step 4: Open the App

Navigate to **http://localhost:5173** in your browser.

---

## Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@plugin.com` | `Admin@123` |
| Customer | `user@plugin.com` | `User@123` |

---

## Database Schema

### Tables

| Table | Description |
|-------|-------------|
| `users` | User accounts with roles (ADMIN, STATION_OPERATOR, CUSTOMER) |
| `stations` | Charging stations with address, hours, coordinates |
| `charging_points` | Individual charging points per station (FAST/SLOW, status) |
| `pricing` | Pricing models per station + point type (per kWh) |
| `bookings` | Customer bookings with overlap prevention |
| `charging_sessions` | Active/completed charging sessions with energy tracking |
| `bills` | Invoices generated per completed session |
| `notifications` | In-app notifications per user |
| `audit_logs` | System audit trail for critical actions |

### Key Constraints

- **Booking Overlap Prevention**: DB index + service-layer check ensures `(newStart < existingEnd) AND (newEnd > existingStart)` is never true for the same charging point
- **Foreign Keys** with cascading deletes where appropriate
- **Unique Constraints**: user email, charging point identifier, booking reference, invoice number
- **Indexes** on frequently queried columns (city, pincode, status, timestamps)

### Entity Relationship

```
User (1) ----< (N) Booking
Station (1) ----< (N) ChargingPoint
Station (1) ----< (N) Pricing
Station (1) ----< (N) Booking
ChargingPoint (1) ----< (N) Booking
Booking (1) ---- (1) ChargingSession
ChargingSession (1) ---- (1) Bill
User (1) ----< (N) Notification
```

---

## API Documentation

### Authentication

#### POST `/api/auth/register`
Register a new customer.
```json
{
  "fullName": "Jane Doe",
  "email": "jane@example.com",
  "password": "SecurePass@123",
  "phone": "9876543210"
}
```
Response: `201 Created`
```json
{
  "token": "eyJhbGciOi...",
  "email": "jane@example.com",
  "fullName": "Jane Doe",
  "role": "CUSTOMER",
  "userId": 3
}
```

#### POST `/api/auth/login`
```json
{
  "email": "user@plugin.com",
  "password": "User@123"
}
```
Response: `200 OK` (same structure as register)

### Stations (Public)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stations?page=0&size=20` | List active stations (paginated) |
| GET | `/api/stations/search?q=mumbai` | Search stations |
| GET | `/api/stations/{id}` | Station details |
| GET | `/api/stations/{id}/charging-points` | Charging points for station |
| GET | `/api/stations/{id}/pricing` | Pricing for station |

### Bookings (Customer - JWT Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/bookings` | Create booking |
| PUT | `/api/bookings/{id}` | Modify booking |
| DELETE | `/api/bookings/{id}` | Cancel booking |
| GET | `/api/bookings/my?page=0&size=10` | My bookings |
| GET | `/api/bookings/{id}` | Booking details |
| GET | `/api/bookings/available-slots?stationId=1&pointId=1&date=2026-03-01` | Available time slots |

#### Create Booking Request
```json
{
  "stationId": 1,
  "chargingPointId": 1,
  "startTime": "2026-03-01T10:00:00",
  "durationMinutes": 60,
  "pointTypePreference": "FAST"
}
```

### Sessions (Customer - JWT Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/sessions/start/{bookingId}` | Start charging session |
| POST | `/api/sessions/end/{sessionId}` | End charging session |
| GET | `/api/sessions/my` | My sessions |
| GET | `/api/sessions/my/active` | My active sessions |

### Bills (Customer - JWT Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/bills/my` | My bills |
| GET | `/api/bills/{id}` | Bill details |
| POST | `/api/bills/{id}/pay` | Mark bill as paid |

### Notifications (Authenticated)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications` | My notifications |
| GET | `/api/notifications/unread-count` | Unread count |
| PATCH | `/api/notifications/{id}/read` | Mark as read |
| PATCH | `/api/notifications/read-all` | Mark all as read |

### Profile (Authenticated)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/profile` | Get profile |
| PUT | `/api/profile` | Update profile |

### Admin Endpoints (ADMIN/STATION_OPERATOR role required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/dashboard` | Dashboard stats |
| GET/POST | `/api/admin/stations` | List / Create stations |
| PUT | `/api/admin/stations/{id}` | Update station |
| PATCH | `/api/admin/stations/{id}/toggle` | Toggle active status |
| DELETE | `/api/admin/stations/{id}` | Delete station |
| GET/POST | `/api/admin/charging-points` | Manage charging points |
| PATCH | `/api/admin/charging-points/{id}/status?status=AVAILABLE` | Update point status |
| GET/POST | `/api/admin/pricing` | Manage pricing |
| GET | `/api/admin/bookings` | All bookings |
| GET | `/api/admin/sessions` | All sessions |
| GET | `/api/admin/bills` | All bills |
| GET | `/api/admin/revenue` | Revenue reports |
| GET | `/api/admin/audit-logs` | Audit logs |

---

## cURL Examples

### Login
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@plugin.com","password":"User@123"}'
```

### Search Stations
```bash
curl http://localhost:8080/api/stations/search?q=mumbai
```

### Create Booking (with JWT)
```bash
curl -X POST http://localhost:8080/api/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "stationId": 1,
    "chargingPointId": 1,
    "startTime": "2026-03-01T10:00:00",
    "durationMinutes": 60
  }'
```

### Start Session
```bash
curl -X POST http://localhost:8080/api/sessions/start/1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### End Session
```bash
curl -X POST http://localhost:8080/api/sessions/end/1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Admin Dashboard
```bash
curl http://localhost:8080/api/admin/dashboard \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN"
```

---

## Features Implemented

- [x] JWT Authentication with role-based access control
- [x] Customer registration and login
- [x] Station CRUD with activate/deactivate
- [x] Charging points management (FAST/SLOW, status tracking)
- [x] Pricing models (per kWh)
- [x] Booking system with overlap prevention
- [x] Available time slot calculation
- [x] Charging session simulation (start/end with energy calculation)
- [x] Automatic bill generation
- [x] In-app notifications
- [x] Audit logging
- [x] Admin dashboard with analytics
- [x] Revenue reporting
- [x] BCrypt password hashing
- [x] Input validation (Jakarta Validation)
- [x] CORS configuration
- [x] Proper error handling with meaningful messages
- [x] Pagination on all list endpoints
- [x] Responsive UI (mobile/tablet/desktop)
- [x] Tesla-inspired white theme
- [x] Animated page transitions (Framer Motion)
- [x] Skeleton loading states
- [x] Toast notifications
- [x] Unit tests for booking overlap logic

---

## Project Structure

```
plugin-backend/
├── pom.xml
├── src/main/java/com/plugin/
│   ├── PluginApplication.java
│   ├── config/          (Security, JWT, CORS, DataSeeder)
│   ├── controller/      (REST Controllers)
│   ├── dto/             (Request/Response DTOs)
│   ├── entity/          (JPA Entities)
│   ├── enums/           (Role, Status enums)
│   ├── exception/       (Custom exceptions + handler)
│   ├── repository/      (Spring Data repositories)
│   └── service/         (Business logic)
├── src/main/resources/
│   ├── application.yml
│   ├── schema.sql
│   └── data.sql
└── src/test/java/com/plugin/service/
    └── BookingOverlapTest.java

plugin-frontend/
├── package.json
├── vite.config.js
├── .env
├── index.html
├── public/
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── api/             (Axios instance + API modules)
    ├── context/         (AuthContext)
    ├── components/      (Navbar, Footer, ProtectedRoute, Toast, Skeleton)
    ├── styles/          (Global CSS + Variables)
    └── pages/
        ├── Landing/
        ├── Login/
        ├── Register/
        ├── Search/
        ├── StationDetails/
        ├── NotFound/
        ├── customer/    (Dashboard, BookingFlow, MyBookings, Sessions, Billing, Profile)
        └── admin/       (Dashboard, Stations, ChargingPoints, Pricing, Bookings, Sessions, Revenue, Analytics, AuditLogs, Notifications)
```

---

## License

MIT
