# CheckOn

Everything you're waiting on, in one place — it only speaks when something actually matters.

Public, shared, free change monitoring. Watch a page, describe what you care about in plain English, get told only when it matters. One fetch serves every subscriber.

## Structure

- `frontend/` — Next.js dashboard, trial flow, diff viewer, public watch pages, email templates
- `backend/` — AWS CDK (Scheduler, SQS, Step Functions, Lambda, DynamoDB, S3, CloudFront, Bedrock, SES/SNS, Cognito)

## Local dev

Frontend runs standalone against mocked data (`lib/mocks/`) via the `MOCK` flag in `lib/api.ts`, so it works before the backend is deployed.

```bash
cd frontend
npm install
npm run dev
```

See `checkon-build-spec.md` for full architecture, data model, pipeline, and the four-day plan.
