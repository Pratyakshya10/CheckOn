# CheckOn

Everything you're waiting on, in one place — it only speaks when something actually matters.

Public, shared, free change monitoring. Watch a page, describe what you care about in plain English, get told only when it matters. One fetch serves every subscriber.

## Structure

- `frontend/` — Vite + React landing, Google auth, and dashboard (TypeScript)
- `backend/` — AWS CDK (Scheduler, SQS, Step Functions, Lambda, DynamoDB, S3, CloudFront, Bedrock, SES/SNS, Cognito)

## Local dev

```bash
cd frontend
npm install
npm run dev
```

Web: http://localhost:5173  
API: http://localhost:8000

See `docs/checkon-build-spec.md` for architecture, data model, pipeline, and the four-day plan.
