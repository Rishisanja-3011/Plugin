# PLUGIN - EV Charging Station Management System

PLUGIN is a full-stack EV charging management application with customer booking, station management, charging sessions, billing, notifications, and admin analytics.

The project has been migrated from MySQL/JPA to MongoDB Atlas. The backend now uses Spring Data MongoDB documents, repositories, and Atlas connection settings.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, Vite, React Router, Framer Motion, Axios |
| Backend | Java 17, Spring Boot 3.2, Spring Security, Spring Data MongoDB |
| Database | MongoDB Atlas, or local MongoDB for development |
| Auth | JWT with BCrypt password hashing |
| Styling | Custom responsive CSS |

## MongoDB Atlas Migration

The backend no longer uses MySQL, JDBC, Hibernate, JPA, `schema.sql`, or `data.sql`.

MongoDB changes included in this project:

- Replaced SQL entities with MongoDB documents using `@Document`.
- Replaced JPA repositories with Spring Data MongoDB repositories.
- Added custom Mongo repository helpers for legacy numeric-id lookups.
- Added `database_sequences` to keep numeric IDs compatible with existing API routes and migrated records.
- Added canonical collections such as `users`, `stations`, `chargingPoints`, `bookings`, `chargingSessions`, `bills`, `userVehicles`, `stationManagers`, and `stationManagerApplications`.
- Kept Atlas credentials outside Git through environment variables or ignored local config.

## Prerequisites

- Java 17+
- Maven 3.8+
- Node.js 18+
- npm 9+
- MongoDB Atlas connection string, or local MongoDB

## Configuration

The backend reads MongoDB settings from environment variables:

| Variable | Purpose | Example |
| --- | --- | --- |
| `MONGODB_URI` | MongoDB connection URI | `mongodb+srv://<username>:<password>@<cluster-host>/?appName=plugindb` |
| `MONGODB_DATABASE` | Database name | `plugindb` |
| `JWT_SECRET` | JWT signing secret | Use a long private value |
| `SERVER_PORT` | Backend port | `8081` |

For local development, you can also create `plugin-backend/application-local.yml`. This file is ignored by Git.

```yaml
spring:
  data:
    mongodb:
      uri: "mongodb+srv://<username>:<password>@<cluster-host>/?appName=plugindb"
      database: "plugindb"
```

Do not commit real Atlas usernames, passwords, app passwords, or JWT secrets.

## Run Backend

```powershell
cd plugin-backend

$env:MONGODB_URI="mongodb+srv://<username>:<password>@<cluster-host>/?appName=plugindb"
$env:MONGODB_DATABASE="plugindb"
$env:JWT_SECRET="replace-with-a-long-private-secret"

mvn clean install -DskipTests
mvn spring-boot:run
```

Backend URL:

```text
http://localhost:8081
```

If port `8081` is already in use, stop the existing Java process or run with a different port:

```powershell
$env:SERVER_PORT="8091"
mvn spring-boot:run
```

## Run Frontend

```powershell
cd plugin-frontend
npm install
npm run dev
```

Frontend URL:

```text
http://localhost:5173
```

## Test Accounts

| Role | Email | Password |
| --- | --- | --- |
| Admin | `plugin.bymain@gmail.com` | `Admin@123` |
| Customer | `user@plugin.com` | `User@123` |

Use the users stored in your Atlas database if you migrated existing production data.

## Main Collections

| Collection | Purpose |
| --- | --- |
| `users` | Admin, customer, and station-operator accounts |
| `userVehicles` | Customer vehicles |
| `stations` | Charging stations |
| `chargingPoints` | Individual charging points for stations |
| `pricing` | Station and charging-point pricing |
| `bookings` | Customer charging bookings |
| `chargingSessions` | Active and completed charging sessions |
| `bills` | Generated invoices and payment status |
| `notifications` | User notifications |
| `stationManagers` | Approved station manager directory |
| `stationManagerApplications` | Station manager KYC/application records |
| `stationManagerApplicationDocuments` | Uploaded application document metadata |
| `stationManagerApplicationFiles` | Stored uploaded file payloads |
| `passwordResetOtps` | Password reset OTP records |
| `pendingRegistrations` | Pending signup verification records |
| `database_sequences` | Numeric ID counters for migrated API compatibility |

## API Overview

### Authentication

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Register customer |
| `POST` | `/api/auth/login` | Login and receive JWT |
| `POST` | `/api/auth/forgot-password` | Request password reset OTP |
| `POST` | `/api/auth/reset-password` | Reset password |

### Public Stations

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/stations` | List stations |
| `GET` | `/api/stations/search?q=city` | Search stations |
| `GET` | `/api/stations/{id}` | Station details |
| `GET` | `/api/stations/{id}/charging-points` | Station charging points |
| `GET` | `/api/stations/{id}/pricing` | Station pricing |

### Customer

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/customer/dashboard` | Customer dashboard summary |
| `GET` | `/api/profile` | Customer profile |
| `PUT` | `/api/profile` | Update profile |
| `GET` | `/api/bookings/my` | Customer bookings |
| `POST` | `/api/bookings` | Create booking |
| `PUT` | `/api/bookings/{id}` | Update booking |
| `DELETE` | `/api/bookings/{id}` | Cancel booking |
| `GET` | `/api/sessions/my` | Customer sessions |
| `POST` | `/api/sessions/start/{bookingId}` | Start session |
| `POST` | `/api/sessions/end/{sessionId}` | End session |
| `GET` | `/api/bills/my` | Customer bills |
| `POST` | `/api/bills/{id}/pay` | Mark bill paid |

### Admin

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/admin/dashboard` | Admin dashboard stats |
| `GET` | `/api/admin/stations` | Manage stations |
| `GET` | `/api/admin/charging-points` | Manage charging points |
| `GET` | `/api/admin/pricing` | Manage pricing |
| `GET` | `/api/admin/bookings` | View bookings |
| `GET` | `/api/admin/sessions` | View sessions |
| `GET` | `/api/admin/bills` | View billing |
| `GET` | `/api/admin/revenue` | Revenue reports |
| `GET` | `/api/admin/station-manager-applications` | Review station manager applications |

## Useful Commands

Backend compile:

```powershell
cd plugin-backend
mvn -DskipTests compile
```

Backend tests:

```powershell
cd plugin-backend
mvn test
```

Frontend build:

```powershell
cd plugin-frontend
npm run build
```

## Project Structure

```text
plugin-backend/
|-- pom.xml
|-- src/main/java/com/plugin/
|   |-- PluginApplication.java
|   |-- config/
|   |-- controller/
|   |-- dto/
|   |-- entity/
|   |-- enums/
|   |-- exception/
|   |-- repository/
|   `-- service/
|-- src/main/resources/
|   `-- application.yml
`-- src/test/

plugin-frontend/
|-- package.json
|-- vite.config.js
|-- index.html
`-- src/
    |-- api/
    |-- components/
    |-- context/
    |-- pages/
    `-- styles/
```

## Notes for Deployment

- Configure Atlas network access for the deployment server IP.
- Store `MONGODB_URI`, `MONGODB_DATABASE`, and `JWT_SECRET` as environment variables.
- Keep `plugin-backend/application-local.yml` only on local machines.
- Confirm collection names match the migrated Atlas data before deploying.
- Run backend compile/tests and frontend build before pushing release changes.

## License

MIT
