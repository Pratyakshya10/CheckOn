# CheckOn — final build spec

**First Commit / Bharat Builds Tour · Sept 17–20, 2026 · Ship It track · Team of 2**

> Name is a placeholder. Alternatives: **Noticeboard**, **Pending**, **Onlywhen**. Pick one by Thursday and don't revisit it.

---

## 0. Positioning — read this before anything else

**The category already exists.** Visualping (2M+ users), PageCrawl, changedetection.io and a dozen Apify actors all do AI-filtered change monitoring with plain-English conditions and consolidated digests. Do not claim novelty. A judge who knows this space will puncture it in ten seconds and you'll lose criterion one instead of merely not maxing it.

**What is actually absent.** Every one of those is a *private dashboard sold to a company*. Product marketers tracking competitor pricing, compliance teams tracking policy pages. Nobody has built the public, shared, free version — a page for "UPSC notifications" or "US visa slots, Mumbai" that two hundred strangers subscribe to, with visible history and no account.

That gap exists for a structural reason: there's no B2B revenue in it, so the incumbents can't go there. And it's only economically possible because one fetch serves every subscriber — which is an *architecture* decision, not a business one.

**Therefore the pitch is:**

> "This category is full of private dashboards sold to companies. We built the free public version. Here's the architecture that makes it possible to serve a page to two hundred people for the cost of serving it to one."

That sentence does two jobs at once: it pre-empts the "this exists" objection, and it converts your architecture into the reason the product exists. That is exactly what criterion two rewards.

**What the product is, in one line:** everything you're waiting on, in one place, and it only speaks when something actually matters.

---

## 1. Judge Q&A — rehearse these

| They'll ask | You say |
|---|---|
| "Visualping does this." | "For companies, privately, at $50/month. We're the free public layer. A student waiting on an exam result is not their customer and never will be." |
| "Isn't this just a Bedrock call?" | "Bedrock runs on roughly 1 in 20 checks. Three filters sit in front of it — hash, deterministic noise filter, and rules parsed once at subscribe time. Model calls scale with changes, not users." |
| "How does it scale?" | "Cost scales with unique pages watched, not users watching them. The 200th subscriber to a page costs effectively nothing." |
| "Why AWS specifically?" | "The problem is scheduled and event-driven. Scheduler, SQS, Step Functions and DynamoDB TTL are the shape of the problem. We didn't pick services, the problem did." |
| "Are you scraping responsibly?" | "robots.txt honoured and cached, 15-minute floor on intervals, identified user agent, no pages behind login or paywall, and reserved concurrency so we never burst a government site." |

---

## 2. AWS services and why each one is there

| Service | Role | Why it's not decorative |
|---|---|---|
| EventBridge Scheduler | Check ticks, digest windows | The product is scheduled by nature |
| SQS | Queue of due watches | Throttling, retries, DLQ, politeness to targets |
| Lambda | Dispatcher, fetch, diff, classify, notify | Scales to zero between ticks |
| Step Functions | Change pipeline | Real branching, retries, Map over subscribers |
| DynamoDB | Watches, subscriptions, changes, digest queue | TTL does expiry with no cron |
| S3 | Snapshots + generated public pages | Lifecycle rules age out snapshots |
| CloudFront | Serves public watch pages | Reads cost near zero at any traffic |
| Bedrock | Condition parsing + change summarisation | Two call sites, both deliberately rationed |
| SES / SNS | Email + SMS delivery | — |
| Cognito | Dashboard auth | — |
| Amplify Hosting | Dashboard frontend | — |

---

## 3. Data model

Four tables. The load-bearing decision: **a watch belongs to a URL, not to a user.** Public watches, shared-fetch economics and the growth loop all fall out of this. If it's built per-user, all three are lost.

### `Watches`
- **PK** `watchId` — stable hash of normalised URL
- `url`, `normalizedUrl`, `title`, `slug`
- `isPublic`, `subscriberCount`
- `checkIntervalMinutes`, `nextCheckAt`, `lastCheckedAt`
- `lastContentHash`, `lastSnapshotKey`
- `fetchMode` — `static` | `rendered`
- `robotsAllowed`, `status` — `active` | `failing` | `blocked`
- **GSI1**: PK `shardId` (0–9), SK `nextCheckAt` — dispatcher scans only what's due

### `Subscriptions`
- **PK** `userId`, **SK** `watchId`
- `conditionText` — what they typed
- `conditionRule` — structured JSON, parsed once at subscribe time
- `deliveryMode` — `instant` | `digest`
- `language`, `sensitivity`, `muted`, `createdAt`, `lastNotifiedAt`
- **GSI1**: PK `watchId`, SK `userId` — fan out from change to subscribers

### `Changes`
- **PK** `watchId`, **SK** `detectedAt`
- `changeFacts` — structured summary, computed once per change
- `beforeSnapshotKey`, `afterSnapshotKey`, `diffKey`
- `isCosmetic` — kept for the public timeline even when nobody was told
- This table **is** the public change history

### `DigestQueue`
- **PK** `userId`, **SK** `${detectedAt}#${watchId}`
- `oneLineSummary`, `watchTitle`, `changeId`
- `ttl` — auto-expires after send, no cleanup job

---

## 4. The check pipeline

```
EventBridge Scheduler (every 5 min)
  → Dispatcher Lambda
      query Watches GSI1 where nextCheckAt <= now
      enqueue one SQS message per due watch
  → SQS
  → Fetch Lambda (reserved concurrency — be polite)
      cached robots.txt check
      fetch (static or headless)
      normalise: strip scripts, nav, ads, timestamps, counters
      hash normalised text
      ├─ hash unchanged → update lastCheckedAt, STOP    ◄── ~95% exit, zero model cost
      └─ hash differs   → snapshot to S3, start Step Functions
```

---

## 5. Step Functions — the change pipeline

```
ComputeDiff (Lambda)
  before vs after → added / removed / modified blocks
      ↓
NoiseFilter (Lambda, NO model)
  drop timestamps, view counts, session ids, CSRF tokens, rotating banners
      ↓
Choice: diff empty after filtering?
  ├─ yes → RecordCosmetic → End        ◄── cost layer two, still no model
  └─ no  ↓
SummariseChange (Lambda → Bedrock)   ◄── ONE call per change, regardless of subscriber count
  diff → structured facts:
    [{ type:"date_change", field:"application deadline",
       from:"2026-03-12", to:"2026-03-20" },
     { type:"row_added", table:"centres", value:"Bangalore" }]
  write to Changes.changeFacts
      ↓
GetSubscribers (Lambda) — Subscriptions GSI1
      ↓
Map over subscribers (maxConcurrency ~10)
  ├─ MatchCondition (Lambda, deterministic)   ◄── cost layer three
  │     match changeFacts against conditionRule
  │     small Bedrock call ONLY for rule type "fuzzy"
  └─ Choice
       ├─ no match        → RecordSkipped → End
       ├─ match + instant → SendNow (SES / SNS)
       └─ match + digest  → PutDigestItem (DynamoDB + TTL)
```

**Resilience:** exponential backoff on Bedrock throttling, DLQ on the fetch queue, `Catch` on every task writing a failure record; `status` flips to `failing` after N consecutive errors and the dashboard shows it honestly.

### Condition parsing — once, at subscribe time

```
"tell me when a Bangalore slot opens"
  → { type:"appearance", target:"Bangalore", scope:"slots|centres" }
"when it drops below 28000"
  → { type:"threshold", field:"price", operator:"<", value:28000 }
"if the deadline moves"
  → { type:"date_change", field:"deadline" }
(blank)
  → { type:"any_meaningful" }
```

This is why matching is cheap at change time.

---

## 6. The digest

```
EventBridge Scheduler (hourly tick)
  → find users whose digestHour == current hour in their timezone
  → Digest Lambda per user
       query DigestQueue
       ├─ empty → send NOTHING                 ◄── silence is a feature
       └─ items → one email:
            • what moved, one line each, with why it matched
            • "No change on: X, Y, Z" collapsed to one line
            • rendered in subscription.language
       delete items (or let TTL handle it)
```

---

## 7. Public watch pages — the growth loop

On every recorded change, regenerate that watch's static page to S3, served via CloudFront. Readable slugs: `/w/upsc-notifications`.

Page shows: the URL watched, watcher count, change timeline from `Changes`, one-click subscribe.

This is simultaneously distribution and cost story. **One fetch serves every subscriber.**

### Seed these before launch — have real history by Saturday morning

Start them **Thursday** so the timelines aren't empty on camera.

- UPSC / SSC / state PSC notification pages
- CBSE, university and board result pages
- IBPS / bank recruitment notifications
- US and Schengen visa appointment availability
- NEET / JEE admit card and counselling pages
- National scholarship portal deadlines
- Railway and PSU recruitment boards
- One or two GitHub release or status pages for the Discord crowd

**Rule: nothing behind a login or paywall. Nothing you'd be embarrassed to show a judge.**

---

## 8. Frontend surfaces (your half)

1. **Zero-signup trial.** Paste URL + sentence → runs one check immediately → shows current state against the condition. Email only requested when they want it to *keep* watching. Do not gate this behind auth.
2. **Dashboard.** Everything they're waiting on, status, what moved, what didn't. The thing they open instead of their inbox. This is your Best UI entry.
3. **Diff viewer.** Before/after with the significant region highlighted and the trivial region greyed out. **Showing what you ignored is as persuasive as showing what you caught** — build this deliberately, it's the single most convincing screen in the demo.
4. **Public watch page + timeline.**
5. **Email templates.** Alert and digest. These get screenshotted; treat them as design surfaces.

---

## 9. Four days

**Split:** partner owns dispatcher, fetch, diff, Step Functions, Bedrock, notifications. You own dashboard, trial flow, diff viewer, public pages, email templates, video.

### Thursday — risk day
Partner, before anything else: take the five ugliest pages from the seed list and try to fetch them. **Decide `static` vs headless by noon.** If headless eats the day, restrict to static and state it in the writeup. Then get one watch running end-to-end on a schedule with a dummy always-significant classifier.
You: dashboard shell + trial flow against mocked data.
**End of day: seeded watches running so history accumulates for three days.**

### Friday
Condition parsing, change summarisation, matching, instant notifications. You: diff viewer + real data wired in.
**Deployed and publicly usable by Friday night. Non-negotiable.**

### Saturday
Digest flow, public pages live. Launch: hackathon Discord, X, relevant subreddits, exam and visa WhatsApp groups. Watch it while continuing to build.

### Sunday
Polish, Builder Center blog post, record video. **Reserve the last six hours for the video.**

**Cut list, in order:** multilingual → SMS → public pages → digest.
**Never cut:** hash filter, classifier, dashboard, diff viewer.

---

## 10. The cost story

Three independent decisions, all pointing the same way. Verify with the pricing calculator before putting numbers on screen.

1. **Hash comparison first** — ~95% of checks exit after one cheap fetch.
2. **Deterministic noise filter before the model** — cosmetic diffs never reach Bedrock.
3. **Rules parsed once, matched in code** — one model call per *change*, not per *subscriber*.

The line: **"Cost scales with the number of unique pages watched, not the number of users watching them."**

Screenshot CloudWatch. Criterion two names cost decisions explicitly and almost nobody will have this slide.

---

## 11. Demo video — 3 minutes

- **0:00–0:15** The collective problem. Screenshots of WhatsApp groups and forums asking "any update on the result?" — hundreds of people refreshing the same page.
- **0:15–0:35** A public watch page that already has history and subscribers. One click to subscribe. No account.
- **0:35–1:05** Create your own: paste a URL, type a sentence, no signup, first check runs on camera.
- **1:05–1:45** A real change fires. Diff viewer: significant region highlighted, cosmetic region greyed out and explicitly ignored.
- **1:45–2:10** The digest. One email, several watches, "no change on" collapsed.
- **2:10–2:40** Architecture diagram, the three cost layers, the scaling line, CloudWatch graph.
- **2:40–3:00** Positioning: the category is private B2B dashboards; this is the free public layer; the architecture is what makes that possible. Live URL on screen.

**Record it twice.** The second take is always better and you'll have time if you start at the six-hour mark.

---

## 12. Risks and fallbacks

| Risk | Mitigation |
|---|---|
| **Fetching fails** — JS rendering, bot blocks | Decide by Thursday noon. Static-only is an acceptable stated constraint. |
| **Classifier wrong** | Tune against genuinely noisy pages, not clean ones. Bias toward *instant* when ambiguous — burying something urgent is worse than the noise you're replacing. |
| **Nothing changes during demo** | Seed Thursday. Keep a control page you can edit yourself as backup. |
| **Bedrock throttling** | Backoff + DLQ; cache the summary on the Change record so retries don't re-call. |
| **"This already exists"** | Answer from §1 — never deny it, reframe to the public layer. |
| **Government site complains** | robots.txt, 15-min interval floor, identified UA, reserved concurrency, no login/paywall pages. One honest paragraph in the writeup. |

---

## 13. Submission checklist

- [ ] Public repo
- [ ] Live URL — Ship It requires it
- [ ] 3-minute video
- [ ] Writeup: architecture, cost decisions, scraping etiquette, honest positioning
- [ ] Blog post on AWS Builder Center, linked in submission
- [ ] Check in on the First Commit page before the clock starts

**Rules:** project work starts when the clock does on the 17th. Practise Step Functions, EventBridge Scheduler, Bedrock and headless fetch on throwaway repos this week. No code carried in.

---

## 14. What this spec cannot do

It removes the failure modes that eliminate good projects. It does not guarantee a prize — there are hundreds of teams and judging has taste in it. Two things decide your outcome and neither is written here: whether the fetch layer works on Thursday, and whether the video is good on Sunday. Protect both.
