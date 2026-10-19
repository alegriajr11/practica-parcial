# [SEC-402] Hotfix: Bloqueo en entrega de métricas para el Panel de Cumplimiento (Compliance Dashboard)

| Metadata | Detalle |
| :--- | :--- |
| **Ticket ID** | SEC-402 |
| **Tipo de Incidencia** | Bug / Hotfix |
| **Prioridad** | 🔴 Blocker / Alta |
| **Componente Afectado** | API Backend (`AuditModule`, `AuthModule`) |
| **Tiempo Estimado de Resolución** | 45 Minutos |
| **Modalidad** | Prueba Técnica Práctica Individual |

---

## 📋 Resumen del Incidente

El equipo de Frontend y el área de QA reportan un bloqueo crítico en la versión candidata a producción:

> *"Al intentar consultar el endpoint de métricas de cumplimiento (`GET /audit/summary`) utilizando el Bearer Token del usuario administrador (`admin@enterprise.com`), la API responde persistentemente con un código de estado `403 Forbidden` o errores internos de servidor, impidiendo la visualización del Compliance Dashboard."*

El análisis preliminar sugiere fallas en el flujo de seguridad (autenticación y autorización) del backend, provocando que peticiones de usuarios legítimos sean rechazadas antes de procesar la lógica de negocio.

---

## 🎯 Criterios de Aceptación (Definition of Done - DoD)

Para que el Pull Request sea aprobado por el Code Reviewer, la solución debe cumplir estrictamente con los siguientes criterios:

1. **Acceso Autorizado (Admin):**
   * Petición a `GET /audit/summary` con un Bearer Token emitido para `admin@enterprise.com` debe responder con código **`200 OK`**.
   * La respuesta debe retornar los datos del administrador extraídos limpiamente mediante el decorador `@GetUser()`, incluyendo sus roles (`ADMIN`) y el timestamp de generación.
2. **Acceso Denegado por Rol Insuficiente (User estándar):**
   * Petición a `GET /audit/summary` con un Bearer Token emitido para un usuario sin rol de administrador (ej. `operador@enterprise.com`) debe responder con código **`403 Forbidden`**.
3. **Acceso Denegado por Falta de Autenticación:**
   * Petición a `GET /audit/summary` sin cabecera `Authorization` o con un token inválido/expirado debe responder con código **`401 Unauthorized`**.
4. **Validación de Integridad y Estado de Usuario:**
   * Toda petición autenticada debe validar contra la base de datos que el usuario exista y mantenga su estado activo (`isActive: true`). Si el usuario no existe o fue desactivado, la petición debe ser rechazada con **`401 Unauthorized`**.
5. **Arquitectura y Buenas Prácticas NestJS:**
   * El endpoint debe estar debidamente protegido mediante el sistema modular de Guards (`JwtAuthGuard`, `RolesGuard`) y metadatos de roles (`@Roles(Role.ADMIN)`).
   * En los controladores, la extracción del usuario autenticado debe realizarse obligatoriamente mediante el decorador `@GetUser()`. Queda terminantemente **prohibido** inyectar el objeto nativo `@Req() req` de Express.

---

## ⚙️ Configuración y Puesta en Marcha

### 1. Requisitos Previos
* Node.js v18+ o v20+
* Servidor MySQL en ejecución (local, XAMPP, Docker, etc.)

### 2. Variables de Entorno
Crea un archivo `.env` en la raíz del proyecto a partir de `.env.example`:

```bash
cp .env.example .env
```

Asegúrate de que la base de datos MySQL exista o ajústala a tus credenciales locales:
```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=
DB_DATABASE=db_sec_eval
JWT_SECRET=super_secret_jwt_key_2026
JWT_EXPIRES_IN=1h
```

> **Nota:** La base de datos `db_sec_eval` debe estar creada en tu servidor MySQL:
> ```sql
> CREATE DATABASE IF NOT EXISTS db_sec_eval;
> ```

### 3. Instalación de Dependencias
```bash
npm install
```

### 4. Ejecución del Servidor
Inicia la aplicación en modo desarrollo:
```bash
npm run start:dev
```

Al iniciar por primera vez, el servicio `SeedService` insertará automáticamente los usuarios de prueba en la base de datos si la tabla se encuentra vacía.

---

## 👥 Credenciales de Prueba Precargadas (Seed)

| Usuario | Correo Electrónico | Contraseña | Roles Asignados |
| :--- | :--- | :--- | :--- |
| **Administrador** | `admin@enterprise.com` | `AdminPassword123*` | `['ADMIN']` |
| **Operador Estándar** | `operador@enterprise.com` | `UserPassword123*` | `['USER']` |

---

## 📡 Guía de Pruebas de Endpoints

### 1. Iniciar Sesión como Administrador
* **Método:** `POST`
* **URL:** `http://localhost:3000/auth/login`
* **Headers:** `Content-Type: application/json`
* **Body (JSON):**
  ```json
  {
    "email": "admin@enterprise.com",
    "password": "AdminPassword123*"
  }
  ```
* **Respuesta Esperada (`200 OK`):**
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1Ni...",
    "user": {
      "id": "...",
      "email": "admin@enterprise.com",
      "roles": ["ADMIN"]
    }
  }
  ```

---

### 2. Iniciar Sesión como Operador (Usuario Estándar)
* **Método:** `POST`
* **URL:** `http://localhost:3000/auth/login`
* **Headers:** `Content-Type: application/json`
* **Body (JSON):**
  ```json
  {
    "email": "operador@enterprise.com",
    "password": "UserPassword123*"
  }
  ```
* **Respuesta Esperada (`200 OK`):**
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1Ni...",
    "user": {
      "id": "...",
      "email": "operador@enterprise.com",
      "roles": ["USER"]
    }
  }
  ```

---

### 3. Consultar Métricas de Cumplimiento
* **Método:** `GET`
* **URL:** `http://localhost:3000/audit/summary`
* **Headers:**
  * `Authorization: Bearer <TOKEN_OBTENIDO>`

#### Comportamiento Reportado por QA (Estado Inicial con Incidencia):
* Con token de Admin: Responde inesperadamente con `403 Forbidden` o error interno impidiendo el acceso.
* Con token de Operador: Responde `403 Forbidden`.
* Sin token: Responde de forma anómala en lugar de un `401 Unauthorized` estandarizado.

#### Comportamiento Esperado tras Aplicar la Solución:
* **Con Token de Admin:** `200 OK`
  ```json
  {
    "status": "success",
    "message": "Métricas de auditoría y cumplimiento recuperadas satisfactoriamente",
    "data": {
      "adminUser": {
        "id": "...",
        "email": "admin@enterprise.com",
        "roles": ["ADMIN"]
      },
      "systemStatus": "COMPLIANT_ACTIVE",
      "totalAuditedEvents": 1420,
      "riskScore": "LOW",
      "complianceHealthPercent": 99.8,
      "timestamp": "2026-10-18T20:30:00.000Z"
    }
  }
  ```
* **Con Token de Operador:** `403 Forbidden`
  ```json
  {
    "message": "Acceso denegado: se requiere uno de los siguientes roles: [ADMIN]",
    "error": "Forbidden",
    "statusCode": 403
  }
  ```
* **Sin Token:** `401 Unauthorized`
  ```json
  {
    "message": "Unauthorized",
    "statusCode": 401
  }
  ```

