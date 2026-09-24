# AkashVPS Restored Architecture

## Per-user HopX API key, Owner approval, two roles এবং limited packages

**Project:** `shopnex41-ai/akashvps-worker-source`  
**Worker:** `akashvps-admin-bot`  
**Architecture:** Owner-approved multi-user HopX VPS/sandbox management

---

## ১. Final architecture decision

আপনার আগের plan-টাই final করা হলো:

- Role শুধু দুইটি: **Owner** এবং **User**।
- প্রত্যেক User নিজের HopX API key connect করতে পারবে।
- User-এর API key অন্য User দেখতে বা ব্যবহার করতে পারবে না।
- প্রত্যেক User নিজের HopX account-এর credit এবং sandbox ব্যবহার করবে।
- কোনো User নিজে থেকে privileged action চালাতে পারবে না।
- Owner approval ছাড়া user onboarding, VPS creation, deployment, terminal বা package-sensitive action চলবে না।
- Bot প্রত্যেক User-এর key আলাদা credential হিসেবে handle করবে।
- User data, package assignment, VPS metadata এবং audit log key change-এর কারণে মুছে যাবে না।

এই model-এ Owner platform-এর administrator, কিন্তু প্রতিটি User-এর HopX resource ownership আলাদা থাকে। তাই একজন User-এর API limit শেষ হলেও অন্য User-এর resource স্বাভাবিকভাবে চালু থাকতে পারে।

---

## ২. High-level system architecture

```text
┌──────────────────────┐
│ Telegram Owner/User  │
└──────────┬───────────┘
           │ Bot buttons, commands, WebApp
           ▼
┌──────────────────────────────────────────┐
│          Cloudflare Worker               │
│                                          │
│ Telegram Webhook                         │
│ Owner/User Authorization                  │
│ Package Policy                            │
│ User Approval                             │
│ HopX Provider Adapter                     │
│ Key Validation and Rotation               │
│ VPS Lifecycle                             │
│ Terminal Session Gateway                  │
│ Deployment Controller                     │
│ Alerts and Audit                          │
└──────────┬──────────────┬────────────────┘
           │              │
           ▼              ▼
┌────────────────┐  ┌──────────────────────┐
│ Cloudflare D1  │  │ Secret/Credential     │
│ users          │  │ storage               │
│ packages       │  │ per-user HopX keys    │
│ requests       │  │ BOT_TOKEN             │
│ credentials    │  │ WEBHOOK_SECRET        │
│ sandboxes      │  └──────────┬───────────┘
│ grants         │             │
│ usage          │             ▼
│ deployments    │   ┌────────────────────┐
│ audit_logs     │   │ HopX API            │
└────────────────┘   │ per-user account    │
                     └────────────────────┘
```

Cloudflare Worker orchestration করবে। D1 metadata, permission এবং usage রাখবে। HopX secret storage-এ key থাকবে; key-এর raw value D1, GitHub বা Telegram message-এ রাখা যাবে না।

---

## ৩. Roles

### Owner

Owner একমাত্র administrator এবং approval authority। Owner পারবেন:

- User approve, reject, suspend ও reactivate করতে
- User-এর HopX key validate, change ও revoke করতে
- User package assign, edit ও reset করতে
- VPS creation approve করতে
- User-এর VPS status দেখতে
- Terminal access approve বা revoke করতে
- Deployment approve বা stop করতে
- Usage ও limit দেখতে
- Provider error-এর পরে user-কে notify করতে
- Audit log দেখতে
- Emergency stop এবং maintenance mode চালু করতে

### User

User নিজের HopX API key connect করবে এবং Owner-এর approval-এর পরে assigned package অনুযায়ী নিজের VPS/sandbox manage করবে। User পারবেন:

- HopX key add বা replace request করতে
- Owner approval-এর পরে VPS create করতে
- নিজের VPS status দেখতে
- অনুমোদিত terminal খুলতে
- নিজের project deploy করতে
- নিজের package quota দেখতে
- নিজের VPS stop করতে, যদি package policy অনুমতি দেয়
- Owner-এর কাছে access বা quota request পাঠাতে

User কখনো অন্য User-এর key, VPS, workspace, deployment বা usage দেখতে পারবে না।

---

## ৪. Owner approval principle

Owner approval ছাড়া কোনো sensitive operation সরাসরি execute হবে না। Approval দুইভাবে হতে পারে:

### Immediate owner policy

Owner আগে package policy-তে action অনুমোদন করে রাখবেন। যেমন User-এর Basic package-এ create VPS allowed। তবুও প্রথম key connect এবং প্রথম VPS creation Owner approval চাইতে পারে।

### Per-action approval

নিচের operation-এর ক্ষেত্রে প্রত্যেকবার Owner confirmation দরকার হতে পারে:

- New HopX API key connect
- Key revoke বা rotate
- First VPS create
- Package upgrade
- Resource limit increase
- Project deployment with custom command
- Elevated terminal action
- VPS delete
- Data export

এই policy `requires_owner_approval` flag দিয়ে package এবং action level-এ control করা যাবে।

---

## ৫. User onboarding flow

1. User `/start` চাপবে।
2. Bot Telegram ID, username এবং name save করবে।
3. User status `pending` হবে।
4. Owner-এর কাছে approval notification যাবে।
5. Owner user approve করবেন।
6. Owner Basic, Developer বা Premium package assign করবেন।
7. User নিজের HopX API key connect করার option পাবে।
8. Key validation successful হলে credential status `validated` হবে।
9. User VPS create request পাঠাবে।
10. Owner approval pass হলে HopX sandbox create হবে।

Owner notification:

```text
🔔 NEW USER REQUEST

👤 Name: {name}
🆔 Telegram ID: {telegram_id}
🔗 Username: @{username}
📦 Suggested package: Basic

[✅ Approve] [❌ Reject]
```

---

## ৬. Per-user HopX credential model

প্রত্যেক User-এর credential আলাদা logical record হবে:

```text
credential_id
user_id
provider = hopx
key_version
key_fingerprint
organization_ref
status
last_validated_at
last_error_code
created_at
updated_at
```

Raw API key secret store-এ থাকবে। D1-তে থাকবে শুধু metadata:

- key fingerprint
- version
- provider account/organization reference
- status
- validation time
- last error category

Recommended credential status:

```text
pending
validating
validated
active
invalid
exhausted
revoked
rotation_pending
```

একজন User-এর একটি active key থাকবে। Key rotate করার সময় নতুন key আগে candidate হিসেবে validate হবে। Validation fail হলে পুরোনো active key untouched থাকবে।

---

## ৭. User API key connect flow

User `Connect HopX` button চাপলে:

1. Bot secure input flow খুলবে।
2. User নিজের HopX key submit করবে।
3. Bot key format validate করবে।
4. Provider validation endpoint call করবে।
5. Account/organization identity record করবে।
6. Key fingerprint তৈরি করবে।
7. Owner approval request তৈরি করবে।
8. Owner approve করলে key active হবে।
9. User package অনুযায়ী VPS create option পাবে।

User-facing message:

```text
🔑 CONNECT YOUR HOPX ACCOUNT

Your API key will be used only for your own VPS operations.
It will not be shown to other users.

Status: Waiting for secure submission
```

Success:

```text
✅ HOPX KEY VERIFIED

Account: {masked_account}
Key: hopx_live_••••{suffix}
Status: Waiting for owner approval
```

API key সাধারণ chat message হিসেবে নেওয়া technically সম্ভব হলেও recommended নয়। Secure one-time WebApp input ব্যবহার করা উচিত। যদি Telegram message input ব্যবহার করা হয়, bot message content immediately delete করার চেষ্টা করবে এবং raw key log করবে না।

---

## ৮. Per-user key rotation, change এবং revoke

### Key change

1. User `Change HopX Key` request করবে।
2. New key `candidate` status-এ save হবে।
3. Provider validation হবে।
4. New key-এর organization/account identity record হবে।
5. Existing sandbox compatibility check হবে।
6. Owner approval চাইবে।
7. Owner approve করলে new key active হবে।
8. Old key `previous` হিসেবে grace period-এ থাকবে বা revoke হবে।
9. D1 user, package, VPS, deployment ও usage data অপরিবর্তিত থাকবে।

### Key revoke

Owner বা policy অনুমতি দিলে User নিজের key revoke request করতে পারবে। Owner confirm করলে:

- Provider key revoke করা হবে, যদি API support করে
- Local credential status `revoked` হবে
- New VPS creation বন্ধ হবে
- Existing metadata preserved থাকবে
- Existing sandbox provider access-এর জন্য compatibility warning যাবে

### Other account warning

নতুন key অন্য HopX account বা organization-এর হলে পুরোনো sandbox automatic transfer হবে না। তাই bot আগে দেখাবে:

```text
⚠️ ACCOUNT CHANGE DETECTED

The new key belongs to a different provider account.
Existing sandboxes may not be controllable with this key.
Your user/package/database data will remain safe.

[Export Data] [Continue with New VPS]
```

Key change এবং sandbox migration একই জিনিস নয়। Existing sandbox provider ownership বদলানোর নিশ্চয়তা না থাকলে bot নতুন sandbox create করার route দেখাবে এবং পুরোনো record archive করবে না যতক্ষণ না Owner সিদ্ধান্ত নেন।

---

## ৯. VPS creation flow

User VPS create request করতে পারবে, কিন্তু Owner approval policy অনুযায়ী execution হবে। Recommended default হলো প্রথম VPS এবং custom template-এর জন্য Owner approval রাখা।

Flow:

1. User package ও key status check হবে।
2. Active credential থাকতে হবে।
3. User quota check হবে।
4. Template selection হবে।
5. Timeout selection package limit-এর মধ্যে থাকবে।
6. Owner approval লাগলে request তৈরি হবে।
7. Owner approve করলে HopX API call হবে।
8. Response validate হবে।
9. D1 `sandboxes` table-এ record হবে।
10. User-কে secure status message যাবে।

Success message:

```text
✅ YOUR VPS IS READY

👤 User: @{username}
🆔 Sandbox: {short_id}
📊 Status: Running
💻 Template: {template}
⏱ Expires: {expiry}

[⌨️ Open Terminal]
[📊 Live Status]
[📦 Deploy Project]
[🛑 Stop VPS]
```

Owner কখনো চাইলে User-এর হয়ে VPS create করতে পারবেন, কিন্তু provider credential হবে সংশ্লিষ্ট User-এর active key।

---

## ১০. Package model

শুধু দুই বা তিনটি package রাখা হবে। Recommended:

### Basic

- ১টি active sandbox
- সীমিত runtime
- সীমিত command count
- managed terminal
- ছোট upload limit
- approved templates
- custom deployment সীমিত

### Developer

- ১ বা ২টি active sandbox
- বেশি runtime
- বেশি command count
- GitHub/ZIP deployment
- package preset installation
- logs এবং service restart request

### Premium

- বেশি runtime ও quota
- বড় upload limit
- multiple approved deployments
- higher concurrency
- Owner-approved advanced actions

Package controls:

```text
max_active_sandboxes
max_daily_runtime_minutes
max_commands_per_day
max_terminal_minutes_per_session
max_upload_bytes
max_deployments_per_day
max_concurrent_sessions
allowed_templates
allowed_actions
requires_owner_approval
```

Package delete না করে archive করা উচিত। Active user-এর package archive হলে Owner নতুন package assign করবেন; user data delete হবে না।

---

## ১১. Owner permission gates

প্রতিটি sensitive action-এর আগে authorization middleware চলবে:

```text
authenticate Telegram user
→ load role and status
→ load active package
→ load active HopX credential
→ check resource ownership
→ check package quota
→ check owner approval policy
→ create audit event
→ execute provider action
→ record result
```

Owner approval request-এর state:

```text
pending
approved
rejected
expired
cancelled
executed
failed
```

কোনো approval request-এর মেয়াদ শেষ হলে provider action চালানো যাবে না।

---

## ১২. Terminal access

User নিজের VPS-এর terminal পাবে, অন্য User-এর VPS নয়। Full root terminal defaultভাবে User-এর জন্য বন্ধ থাকবে।

Recommended flow:

1. User `Open Terminal` চাপবে।
2. Worker user এবং sandbox ownership যাচাই করবে।
3. Package terminal limit check করবে।
4. Short-lived terminal session তৈরি হবে।
5. Owner approval policy অনুযায়ী immediate approval বা pre-approved access হবে।
6. Signed terminal URL বা WebSocket session তৈরি হবে।
7. Session timeout, revoke এবং audit থাকবে।

Terminal session record:

```text
session_id
user_id
sandbox_id
credential_id
expires_at
revoked_at
created_at
```

Raw HopX token user-কে পাঠানো যাবে না। Terminal gateway provider token server-side handle করবে।

---

## ১৩. Project deployment

User নিজের sandbox-এ project deploy করতে পারবে, কিন্তু package ও approval policy অনুযায়ী:

- GitHub repository URL
- ZIP upload
- Telegram file upload
- approved starter template
- owner-approved build command

Deployment flow:

1. User source submit করবে।
2. Worker ownership এবং package check করবে।
3. Custom command হলে Owner approval চাইবে।
4. Sandbox-এ source upload হবে।
5. Dependencies install হবে।
6. Build command timeout-এর মধ্যে চলবে।
7. Port detect ও health check হবে।
8. Deployment record save হবে।
9. User live URL ও logs পাবে।

Arbitrary repository ও unrestricted shell execution-এর জন্য resource limits, timeout এবং abuse policy লাগবে।

---

## ১৪. Limit detection ও notifications

প্রত্যেক User-এর HopX account আলাদা হওয়ায় limit state per-user হবে।

### Provider limit states

```text
healthy
degraded
rate_limited
credit_exhausted
invalid_key
revoked
unreachable
```

HopX API response-এ limit বা authentication error এলে bot:

1. Error classify করবে।
2. User-এর নতুন operation pause করবে।
3. Owner-কে alert করবে।
4. User data ও VPS metadata untouched রাখবে।
5. User-কে key change option দেখাবে।
6. Old key revoke না করে new key validation-এর সুযোগ দেবে।

User message:

```text
⏸ HOPX ACCESS PAUSED

Your provider account is currently unavailable or out of limit.
Your user data and package are safe.
Please connect a new HopX key or contact the owner.
```

Owner alert:

```text
🚨 USER PROVIDER ALERT

User: @{username}
Account: {masked_account}
Status: Credit exhausted / Invalid key
Active sandboxes: {count}
Action: New operations paused

[🔑 Review Key] [📩 Notify User]
```

Repeated same error-এ alert spam বন্ধ করতে D1-তে alert fingerprint ও last alert time রাখতে হবে।

---

## ১৫. Data preservation rule

Key change, quota exhaustion, user suspension বা provider outage-এর কারণে নিচের data delete হবে না:

- Telegram user identity
- package assignment
- access request
- HopX credential history metadata
- sandbox logical record
- deployment history
- usage events
- audit logs
- approval history

Provider-side sandbox data-এর guarantee provider API ও account ownership-এর ওপর নির্ভর করবে। Key change-এর আগে bot optional export/backup চালাবে। New key অন্য account-এর হলে bot automatic migration claim করবে না।

---

## ১৬. Database additions for existing project

বর্তমান D1-এর সঙ্গে নিচের table যুক্ত করা উচিত:

```sql
CREATE TABLE IF NOT EXISTS packages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  limits_json TEXT NOT NULL,
  approval_policy_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_packages (
  user_id TEXT PRIMARY KEY,
  package_id INTEGER NOT NULL,
  assigned_by TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  expires_at TEXT,
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS provider_credentials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'hopx',
  key_version INTEGER NOT NULL DEFAULT 1,
  key_fingerprint TEXT,
  organization_ref TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  last_validated_at TEXT,
  last_error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS approval_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_at TEXT NOT NULL,
  reviewed_at TEXT,
  reviewed_by TEXT
);

CREATE TABLE IF NOT EXISTS usage_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  credential_id INTEGER,
  sandbox_id TEXT,
  action TEXT NOT NULL,
  units INTEGER DEFAULT 1,
  result TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

`provider_credentials` table-এ raw secret রাখা যাবে না। Secret storage-এর reference বা fingerprint রাখা যাবে।

---

## ১৭. Owner menu

```text
✦ AKASHVPS OWNER CONTROL ✦

👥 User Requests
🔑 User HopX Keys
📦 Manage Packages
🖥 All VPS
✅ Pending Approvals
📊 Provider Health
📈 Usage Reports
📜 Audit Logs
📩 Message User
🛑 Emergency Controls
⚙️ Bot Settings
```

## User menu

```text
✦ AKASHVPS USER PANEL ✦

🔑 Connect HopX
🚀 Request VPS
🖥 My VPS
⌨️ Open Terminal
📦 Deploy Project
📊 My Usage
📜 My Logs
⏱ Package Status
🆘 Contact Owner
```

User menu-তে `Manage Users`, `Package Management`, `API revoke all`, অন্য user-এর VPS এবং global emergency action থাকবে না।

---

## ১৮. Existing project-এ ব্যবহার করার process

বর্তমান Worker এবং D1 foundation reuse করা হবে। সম্পূর্ণ project নতুন করে বানাতে হবে না। Implementation order:

### Phase 1: Two-role authorization

- Developer/Admin role বাদ
- শুধু owner/user enforce
- pending/active/suspended status
- Owner-only handlers

### Phase 2: User approval

- D1 registration
- access request persistence
- approve/reject button
- suspend/reactivate
- default package assignment

### Phase 3: Per-user credentials

- secure key input
- provider validation
- key fingerprint
- owner approval
- key change/revoke

### Phase 4: Packages and quotas

- package CRUD
- assignment
- quota calculation
- reset/extend
- user-specific limit alerts

### Phase 5: HopX lifecycle

- create/list/status/execute/delete
- per-user credential selection
- D1 sandbox record
- owner approval gate

### Phase 6: Terminal and deployments

- per-user terminal session
- signed short-lived access
- logs
- file upload
- project deployment

### Phase 7: Monitoring and polish

- provider health
- error deduplication
- expiry warnings
- audit dashboard
- premium Telegram UI

---

## ১৯. Selected approach and lighter alternative

| Approach | Tradeoffs | Cost | Setup Complexity |
|---|---|---|---|
| **Per-user HopX key + Cloudflare Worker/D1 + Owner approval** | User credit আলাদা থাকে, key ownership পরিষ্কার থাকে, existing project reuse করা যায়। তবে per-user secret management এবং key rotation বেশি complex। | Cloudflare/HopX plan অনুযায়ী; user নিজ নিজ provider account ব্যবহার করবে | Medium–High |
| **Per-user key + bot-mediated commands only** | Full WebSocket terminal না থাকায় নিরাপত্তা ও implementation সহজ। তবে interactive terminal experience সীমিত হবে। | তুলনামূলক কম infrastructure | Medium |

**Selected design:** প্রথম option। Initial release-এ terminal-কে managed বা bot-mediated রাখা যেতে পারে; stable user approval, credentials, packages এবং VPS lifecycle হওয়ার পরে full WebSocket terminal যোগ করা ভালো।

---

## ২০. Final result

এখন final architecture হবে:

```text
Owner + Users
↓
প্রত্যেক User নিজের HopX key connect করবে
↓
Owner key validate/approve করবে
↓
User package assign হবে
↓
User VPS request করবে
↓
Owner permission gate pass হলে নিজের key দিয়ে sandbox create হবে
↓
User নিজের VPS/terminal/deployment manage করবে
↓
Limit শেষ হলে শুধু ওই User-এর operation pause হবে
↓
Owner alert পাবেন
↓
User নতুন key submit করবে
↓
Validation pass হলে data রেখে নতুন key active হবে
```

এই model আপনার আগের plan-এর সঙ্গে সামঞ্জস্যপূর্ণ এবং central shared VPS-এর চেয়ে provider ownership, credit attribution ও data separation বেশি পরিষ্কার রাখে।

সবচেয়ে গুরুত্বপূর্ণ rule:

> **User নিজের HopX key ব্যবহার করবে, কিন্তু bot-এর privileged operation Owner approval ছাড়া execute হবে না।**

বর্তমান project-এ এখনো কোনো code বা Cloudflare configuration পরিবর্তন করা হয়নি। এই document implementation-এর জন্য canonical architecture হিসেবে ব্যবহার করা যাবে।
