---
mapped: 2026-08-13
focus: concerns
---

# Technical Concerns

> Generated from codebase analysis on 2026-08-13

## Technical Debt

- **Hardcoded configuration dependencies:** Various services rely on environment variables (`process.env.PORT`, `process.env.GO2RTC_URL`) that lack robust validation schemas, increasing the risk of runtime failure during misconfiguration.
- **WebSocket proxy complexity:** The `server/src/index.ts` manually handles WebSocket upgrades for `/go2rtc`, which is highly fragile and bypasses standard middleware, making it difficult to maintain and secure.
- **Fragmented routing:** `server/src/routes/index.ts` requires manual registration of numerous controller-based routes; this does not scale well and creates potential for circular dependencies if not managed carefully.
- **Service bootstrap:** `server/src/bootstrap.ts` is a monolithic file for service initialization, which makes it harder to test individual services or introduce new ones without affecting the whole boot sequence.

## Known Issues

- **Port in use:** `server/src/index.ts` explicitly handles `EADDRINUSE` but relies on user manual intervention (`fuser -k`), which is not suitable for containerized or automated deployment environments.
- **In-memory cache reliance:** While `server/src/services/cacheService.ts` supports Redis, the default fallback is in-memory, which may lead to consistency issues in multi-node deployments of the backend service.

## Security Concerns

- **`unsafe-inline` CSP:** `server/src/index.ts` includes `'unsafe-inline'` and `'unsafe-eval'` in the Content Security Policy, which is necessary for some Vite/SPA features but significantly weakens the security posture against XSS attacks.
- **Proxy security:** The proxy for `/go2rtc` in `server/src/index.ts` blindly forwards request headers, potentially exposing internal services to header-based attacks.

## Performance Concerns

- **SPA Fallback:** `server/src/index.ts` catches all routes `/*` to serve the SPA `index.html`. This can mask misconfigured API routes, leading to `200 OK` responses for non-existent API endpoints (returning the frontend HTML instead of 404).
- **Service initialization:** All services are initialized at boot in `server/src/bootstrap.ts`, causing a long startup time that might hit timeout limits in resource-constrained environments.

## Fragile Areas

- **`server/src/routes/staticRoutes.ts`:** Reliance on static files being served via `express.static` alongside SPA routing fallback in `index.ts` can lead to confusing behavior regarding file resolution precedence.
- **Python-Node communication:** Communication with the OpenCV microservice depends on WebSocket stability. The code in `server/src/services/opencvMicroserviceClient.ts` does not explicitly implement circuit breakers, making it susceptible to cascading failures.

## Dependency Risks

- **TypeORM:** While powerful, the heavy usage of TypeORM with 26 migrations suggests a complex and potentially fragile database schema where schema changes could easily break existing detection pipelines.
- **`http-proxy-middleware`:** Used for routing to go2rtc; while standard, proxying binary/WebSocket streams requires careful handling that the current code does not robustly test.

## Missing Features / Gaps

- **Automated health checks:** No comprehensive automated health check strategy that includes the Python OpenCV microservice, leading to "zombie" states where the backend is up but detection is down.
- **Structured logging:** While a logger exists, logs are not consistently leveled or structured (e.g., JSON), making it difficult to ingest them into modern observability platforms (ELK/Datadog/etc.).

## Code Quality Issues

- **Service dependency injection:** `initializeServices(io)` passes the `io` instance directly, which is a tight coupling pattern. A proper dependency injection container or clearer service registration would decouple services from the socket server instance.
- **Lack of unit tests:** The codebase lacks a comprehensive unit test suite in the `server/` directory, meaning changes to business logic (e.g., `server/src/services/nvidiaAnalysisService.ts`) are difficult to verify without E2E tests.
