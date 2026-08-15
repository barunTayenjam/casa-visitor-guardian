# Conventions

> Generated: 2026-08-15 | Focus: Quality | Scope: full repo

## Coding Standards

- **TypeScript**: Strict mode enabled (`noImplicitAny`).
- **Imports**: External → Internal → Types.
- **Naming**: PascalCase for components (`CameraGrid.tsx`), camelCase for utils (`apiService.ts`).
- **File Structure**: MVC pattern in backend (controller logic, separate routes).
- **Tooling**:
    - Linting: ESLint (with `@eslint/js`, `typescript-eslint`).
    - Formatting: Prettier (enforced via `npm run format:check`).
- **Validation**: Zod schemas in `server/src/middleware/validation.ts`.

## Backend Logic

- Controller handles business logic, route files only wire paths.
- Services reside in `server/src/services/`.
- Entities re-exported in `server/src/models/index.ts`.
- TypeORM for DB, migrations in `database/migrations/`.
- Logging: Use `server/src/utils/logger.ts`.

## Frontend UI

- shadcn/ui library pattern (Radix UI primitives).
- Components in `frontend/src/components/`.
- Shared utility `cn()` in `frontend/lib/utils.ts`.
- Adaptive UI based on stream availability.
