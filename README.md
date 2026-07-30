# Nipun Gujarat Backend

Express + TypeScript + Sequelize (PostgreSQL / Neon) API for the Nipun Gujarat Student Observation & Review Portal.

Teachers, schools, and students come from the external **Registry API**. This service stores auth sessions and student reviews only.

## Quick start

```bash
cp .env.example .env   # fill Neon + Registry + JWT values
npm install
npm run db:migrate
npm run build
npm run dev            # http://localhost:8000
```

Health check: `GET /api/ping`

## Main endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/auth/login` | no | Body `{ userName }` — 8-digit teacher code, passwordless |
| POST | `/api/v1/auth/logout` | yes | Invalidate session |
| POST | `/api/v1/teacher/profile` | yes | Teacher + school from Registry |
| GET | `/api/v1/teacher/students?grade=B\|1\|2\|3\|4\|5` | yes | Students from Registry + local review status |
| GET | `/api/v1/reviews/:studentId` | yes | Local review |
| PUT | `/api/v1/reviews/:studentId` | yes | Upsert review `{ review, remarks }` |

Auth headers (after login): `Authorization: Bearer <token>`, `userid`, `roleid`.

## Env

See `.env.example`. Required for Registry calls: `REGISTRY_API_URL`, `REGISTRY_API_AUTHORIZATION`, `REGISTRY_API_CLIENT_ID`, `REGISTRY_API_ACADEMIC_YEAR`.
