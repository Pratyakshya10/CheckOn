# CheckOn backend

AWS CDK app. See `../checkon-build-spec.md` for the architecture this implements.

## Stack layout

- `CheckOnData` — DynamoDB tables (Users, Watches, Subscriptions, Changes, DigestQueue) + the snapshots S3 bucket
- `CheckOnPublicSite` — CloudFront distribution in front of the public-site S3 bucket
- `CheckOnPipeline` — EventBridge Scheduler ticks, SQS fetch queue, dispatcher/fetch Lambdas, the Step Functions change pipeline, digest tick, public-page regeneration
- `CheckOnApi` — HTTP API, session-cookie auth (no Cognito — verifies the `checkon_session` cookie `frontend/apps/api`'s Google sign-in already issues), the handlers the frontend calls directly

## Performance/cost decisions baked into this scaffold

- All Lambdas run on ARM64 (Graviton) with esbuild-bundled, minified code — see [lib/lambda-defaults.ts](lib/lambda-defaults.ts).
- DynamoDB tables are PAY_PER_REQUEST — fan-out to subscribers is bursty and we don't want to hand-tune capacity mid-hackathon.
- The change pipeline is an EXPRESS Step Functions workflow, not STANDARD — short executions, high frequency, no need for the execution-history/long-duration features STANDARD charges more for.
- Bedrock calls use Haiku (`BEDROCK_MODEL_ID` env var to override), not Sonnet/Opus — both call sites are short structured-output tasks on the latency-sensitive path.
- Fetch concurrency currently uses the account's unreserved pool because new AWS accounts require ten unreserved executions. Add a reserved ceiling after the account quota is raised.
- Public page regeneration is decoupled via a DynamoDB Stream on the Changes table, so a slow S3 write never adds latency to notification delivery.

## Local dev

```bash
npm install
npm run typecheck
npx cdk synth        # requires esbuild locally installed (it's in devDependencies) to bundle without Docker
```

## Deploy

Requires an AWS account bootstrapped for CDK (`npx cdk bootstrap`) and credentials with permission to create the resources above.

```bash
npm run deploy        # cdk deploy --all
```

## Seed data (run Thursday, first thing — §9 of the spec)

```bash
npm run seed
```

## Headless fetch (`fetchMode: "rendered"`)

Uses `@sparticuz/chromium` + `puppeteer-core`, bundled as external Lambda dependencies (see `bundling.nodeModules` on `FetchFn` in [lib/pipeline-stack.ts](lib/pipeline-stack.ts)). Per the spec: decide by Thursday noon whether any seed page actually needs this — default everything to `static` and only flip a watch's `fetchMode` if the page genuinely requires JS to render its content. If this bundle turns out to be too slow/heavy to build day-of, cut it and restrict to static fetch, stated as a constraint in the writeup.
