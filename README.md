# [SEC-405] Hotfix: Fallo en autenticación Bearer y vulnerabilidad de autorización en el Panel de Cumplimiento

| Metadata | Detalle |
| :--- | :--- |
| **Ticket ID** | SEC-405 |
| **Tipo de Incidencia** | Bug / Vulnerabilidad de Seguridad (Hotfix) |
| **Prioridad** | 🔴 Blocker / Alta |
| **Componente Afectado** | API Backend (`AuditModule`, `AuthModule`) |
| **Tiempo Estimado de Resolución** | 45 Minutos |
| **Modalidad** | Prueba Técnica Práctica Individual |

---

## 📋 Resumen del Incidente

El equipo de QA y los auditores de seguridad han levantado dos alertas críticas en el entorno previo a producción:

> *1. "Al intentar consultar el endpoint de auditoría (`GET /audit/summary`) enviando la cabecera estándar de autorización (`Authorization: Bearer <TOKEN>`) con el usuario administrador (`admin@enterprise.com`), la API responde inmediatamente con código `401 Unauthorized`, bloqueando el acceso al Compliance Dashboard."*  
> *2. "Adicionalmente, el equipo de seguridad advierte que las directivas de control de acceso por rol (`@Roles`) no están bloqueando a usuarios con privilegios insuficientes, existiendo un riesgo crítico de acceso no autorizado a información confidencial por parte de operadores estándar."*

El análisis preliminar confirma fallas en la configuración de la estrategia de extracción de tokens y en la resolución de metadatos del sistema de autorización de NestJS.

---

## 🎯 Criterios de Aceptación (Definition of Done - DoD)

Para que el Pull Request sea aprobado por el Tech Lead, la solución debe cumplir estrictamente con los siguientes criterios:

1. **Autenticación Estándar RFC 6750:**
   * La API debe procesar correctamente el token JWT transmitido en la cabecera estándar `Authorization: Bearer <TOKEN>`.
2. **Acceso Autorizado (Admin):**
   * Petición a `GET /audit/summary` con un Bearer Token emitido para `admin@enterprise.com` debe responder con código **`200 OK`**.
   * La respuesta debe retornar los datos del administrador extraídos limpiamente mediante el decorador `@GetUser()`, incluyendo sus roles (`ADMIN`) y el timestamp de generación.
3. **Acceso Denegado por Rol Insuficiente (User estándar):**
   * Petición a `GET /audit/summary` con un Bearer Token emitido para un usuario sin rol de administrador (ej. `operador@enterprise.com`) debe responder con código **`403 Forbidden`**.
4. **Acceso Denegado por Falta de Autenticación:**
   * Petición a `GET /audit/summary` sin cabecera `Authorization` o con un token inválido/expirado debe responder con código **`401 Unauthorized`**.
5. **Arquitectura y Buenas Prácticas NestJS:**
   * La autorización por roles debe vincularse de forma íntegra entre el decorador de metadatos (`@Roles`) y el `RolesGuard`.
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
* Con token de Admin vía `Authorization: Bearer ...`: Responde inesperadamente con `401 Unauthorized`.
* Sin token: Responde `401 Unauthorized`.
* Si se procesara el rol sin validar metadatos: Riesgo de permitir acceso indebido a usuarios sin permisos (`200 OK` para Operador en lugar de `403 Forbidden`).

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
      "timestamp": "2026-10-24T17:00:00.000Z"
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
