# ai-service

**Phase 2 (implemented)** · Port `8007` · No database

Generates a syllabus / lesson plan from a list of topics with Google Gemini.

## Route
`POST /api/ai/generate-lesson-plan` (needs a login token). Request and response are unchanged, so the frontend is untouched.

## How it differs from the backend version
- **No database.** The course name is read through the courses API (`GET {COURSES_URL}/api/courses/:id`) using the
  caller's own token, so the same access rules apply. If the course cannot be found, the plan is still generated from the topics.
- **Only this service holds `GEMINI_API_KEY`.** Remove it from `backend/.env`.
- The token is checked here too, otherwise anyone who reached the service could use your Gemini quota.
- The model name can be changed with `GEMINI_MODEL` (default `gemini-2.0-flash-lite`, as before).

## Run
```bash
cd services/ai-service
cp .env.example .env     # put GEMINI_API_KEY and JWT_SECRET in it
npm install
npm run dev
```

## Env
```env
PORT=8007
JWT_SECRET=<same as everywhere>
GEMINI_API_KEY=
COURSES_URL=http://localhost:9000     # the backend now, academic-service after Phase 4
```
