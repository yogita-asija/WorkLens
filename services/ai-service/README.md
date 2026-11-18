# ai-service

**Phase 2** · Port `8007` · No database

Wraps the Google Gemini API for lesson-plan generation.

## Public routes
- `POST /api/ai/generate-lesson-plan`

## Moves here from the monolith
- Controller: `portals/teaching/controller/aiController.js`
- Route: `portals/teaching/routes/aiRoutes.js`
- Dependency: `@google/generative-ai`

## Notes
- `aiController` currently reads `Course` from the DB. In this service the course details should be
  **sent in the request body** by the frontend, or fetched from academic-service via
  `GET /internal/courses/:id`, so ai-service needs no database.
- Only this service holds `GEMINI_API_KEY`.

## Env
```env
PORT=8007
GEMINI_API_KEY=
```
