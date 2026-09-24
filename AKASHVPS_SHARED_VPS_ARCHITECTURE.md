# AkashVPS Shared VPS Master Architecture

## Owner-created VPS, two roles, limited packages এবং central HopX key rotation

**প্রকল্প:** `shopnex41-ai/akashvps-worker-source`  
**Worker:** `akashvps-admin-bot`  
**Architecture version:** 1.0  
**তারিখ:** ২৪ সেপ্টেম্বর ২০২৬

---

## ১. চূড়ান্ত সিদ্ধান্ত

এই version-এ system-এ শুধু দুইটি role থাকবে:

1. **Owner:** আপনি। VPS তৈরি, API key, user, package, access, limit এবং emergency control আপনার হাতে থাকবে।
2. **User:** আপনার অনুমোদিত বন্ধুরা। তারা নিজে VPS তৈরি করবে না। Owner যে shared VPS তৈরি করবেন, তারা assigned package অনুযায়ী সেই VPS ব্যবহার করবে।

প্রস্তাবিত model হলো:

> **One owner-controlled HopX VPS or sandbox + multiple approved users + package-based access control.**

User-এর জন্য আলাদা HopX API key থাকবে না। User সরাসরি HopX-এর control plane-এ যাবে না। Bot হবে একমাত্র control layer। Owner-এর HopX API key Worker-এর secure secret store-এ থাকবে এবং user কখনো key দেখতে পাবে না।

---

## ২. গুরুত্বপূর্ণ বাস্তব সীমা

একটি shared VPS-এ একাধিক user access দিলে package limit মূলত bot-এর access policy হবে। এটি নিজে থেকে operating-system level isolation তৈরি করে না। যদি সব user-কে unrestricted root terminal দেওয়া হয়, তাহলে একজন user অন্য user-এর file, process বা environment দেখতে বা পরিবর্তন করতে পারে।

তাই দুইটি access mode আলাদা করতে হবে:

### Managed shared mode — recommended

প্রত্যেক user নিজের workspace, command quota এবং assigned feature ব্যবহার করবে। Bot command proxy বা restricted terminal দেবে। User root shell পাবে না।

### Owner root mode

শুধু Owner full terminal বা root-level command access পাবে। Owner চাইলে কোনো trusted user-কে temporary elevated access দিতে পারবেন, কিন্তু সেটি default হবে না।

এই distinction না রাখলে package system শুধু menu-level restriction হবে; বাস্তব resource বা data isolation হবে না।

---

## ৩. High-level Architecture

```text
                         ┌──────────────────────────┐
                         │       Telegram Users      │
                         │   Owner + Approved Users  │
                         └─────────────┬────────────┘
                                       │
                                       ▼
                         ┌──────────────────────────┐
                         │   Telegram Bot Interface  │
                         │ menus, buttons, messages  │
                         └─────────────┬────────────┘
                                       │ webhook
                                       ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Cloudflare Worker                             │
│                                                                  │
│  Auth/RBAC │ Package Policy │ VPS Controller │ Key Rotation      │
│  Terminal Gateway │ Deploy Controller │ Alerts │ Audit           │
└───────────────┬───────────────────────┬──────────────────────────┘
                │                       │
                ▼                       ▼
      ┌─────────────────┐      ┌────────────────────────┐
      │ Cloudflare D1   │      │ Cloudflare Secrets      │
      │ users           │      │ BOT_TOKEN              │
      │ packages        │      │ WEBHOOK_SECRET         │
      │ vps             │      │ HOPX_API_KEY           │
      │ grants          │      │ HOPX_API_KEY_VERSION   │
      │ usage           │      │ optional encryption key │
      │ audit_logs      │      └──────────────┬─────────┘
      └─────────────────┘                     │
                                              ▼
                                  ┌────────────────────────┐
                                  │       HopX API          │
                                  │ one owner credential    │
                                  │ one or more sandboxes   │
                                  └────────────────────────┘
```

Cloudflare D1-তে user, package, VPS, permission এবং usage metadata থাকবে। HopX API key কখনো D1 plain-text data হিসেবে রাখা হবে না।

---

## ৪. System-এর মূল object model

### Owner

Owner record একটিই থাকবে। Owner ID Worker configuration-এ থাকবে এবং D1-তে role `owner` ও `active = 1` হিসেবে থাকবে। Owner ছাড়া আর কোনো user VPS create করতে পারবে না।

### User

Approved user-রা শুধু shared VPS-এর assigned workspace এবং package capability ব্যবহার করবে। User-এর identity হবে Telegram ID। Username পরিবর্তন হলেও account একই থাকবে।

### Package

Package হলো access policy। এটি VPS নয় এবং আলাদা API key নয়। Package নির্ধারণ করবে user কী করতে পারবে এবং কতক্ষণ/কতবার করতে পারবে।

### VPS

VPS record Owner-created HopX sandbox-এর metadata রাখবে। একই VPS-এর সঙ্গে একাধিক user grant যুক্ত হতে পারে।

### Grant

Grant নির্ধারণ করবে কোন user কোন VPS-এ কোন permission নিয়ে access পাবে।

### Provider credential

HopX API key-এর বর্তমান version এবং rotation history-এর metadata রাখা হবে। আসল secret Worker secret store-এ থাকবে।

---

## ৫. Two-role permission matrix

| Capability | Owner | User |
|---|---:|---:|
| VPS create | Yes | No |
| VPS stop/restart | Yes | Policy অনুযায়ী request বা limited stop |
| VPS delete | Yes | No |
| Full VPS status | Yes | নিজের access-এর status |
| User approve/suspend | Yes | No |
| Package create/edit/archive | Yes | No |
| Package assign/change | Yes | No |
| HopX API key add/change/revoke | Yes | No |
| Root terminal | Yes | No, defaultভাবে |
| Managed terminal | Yes | Package অনুযায়ী |
| Project deploy | Yes | Package অনুযায়ী |
| User notification | Yes | No |
| Usage overview | All users | নিজের usage |
| Audit log | Full | নিজের relevant activity |
| Emergency stop | Yes | No |
| Maintenance mode | Yes | No |

---

## ৬. Owner-created shared VPS lifecycle

### Stage 1: Create

Owner `Create VPS` button চাপবেন। Bot HopX API key-এর validity check করবে এবং selected template ও timeout দিয়ে sandbox create করবে। Response validate করার পরে D1-তে VPS record save হবে।

### Stage 2: Configure

Owner basic setup চালাবেন:

- workspace directory তৈরি
- per-user workspace তৈরি
- approved runtime/package install
- access policy initialize
- health endpoint বা service start
- disk এবং resource baseline record

### Stage 3: Assign

Owner approved user-এর জন্য package এবং VPS access grant assign করবেন। User শুধু assigned workspace বা allowed service route দেখতে পারবে।

### Stage 4: Operate

Owner সব VPS action চালাতে পারবেন। User package অনুযায়ী terminal, deployment, file বা service feature ব্যবহার করবে।

### Stage 5: Rotate or recover

Current HopX key invalid, exhausted বা revoked হলে Owner নতুন key submit করবেন। Bot validation pass করলে নতুন key active হবে। Existing D1 user, package, grant, VPS এবং deployment metadata অপরিবর্তিত থাকবে।

### Stage 6: Stop or delete

VPS বন্ধ বা delete করার আগে Owner-কে active users, deployment এবং data export warning দেখাতে হবে। Delete operation destructive হওয়ায় double confirmation এবং optional backup/export দরকার।

---

## ৭. Package design: দুই বা তিনটি সীমিত package

প্রথম release-এ তিনটির বেশি package প্রয়োজন নেই। Recommended packages:

### Package 1: Basic

- Shared VPS access
- Managed terminal
- নির্দিষ্ট workspace
- সীমিত command count
- সীমিত daily runtime
- ছোট upload limit
- No root access
- No system package installation

### Package 2: Developer

- Basic-এর সব সুবিধা
- বড় command quota
- বড় upload limit
- approved project deployment
- package preset installation
- logs এবং service restart
- No root access

### Package 3: Premium/Owner-assigned

- Developer-এর সব সুবিধা
- বেশি runtime
- বেশি storage quota
- additional service access
- temporary elevated task approval, যদি Owner অনুমোদন করেন
- Full root access নয়; root access শুধু Owner-এর জন্য রাখা নিরাপদ

Package field-এর প্রস্তাব:

```text
id
name
status
max_vps_access
max_daily_runtime_minutes
max_commands_per_day
max_upload_bytes
max_deployments_per_day
max_terminal_minutes_per_session
max_concurrent_sessions
allowed_templates
allowed_actions
workspace_limit_bytes
auto_suspend_on_limit
created_at
updated_at
```

Package delete না করে archive করা উচিত। Active user-এর package সরাসরি delete করলে permission state অস্পষ্ট হতে পারে।

---

## ৮. User onboarding ও access assignment

1. User `/start` চাপবে।
2. Bot Telegram ID এবং profile metadata save করবে।
3. User role `user`, status `pending` হবে।
4. Owner-এর কাছে approval notification যাবে।
5. Owner user approve করবেন।
6. Owner Basic বা Developer package নির্বাচন করবেন।
7. Owner shared VPS নির্বাচন করবেন।
8. Grant record তৈরি হবে।
9. User welcome message এবং permitted menu পাবে।

User নিজে VPS create button দেখবে না। User menu হবে:

```text
🖥 My Shared VPS
⌨️ Open Workspace Terminal
📦 Deploy Project
📊 My Usage
📜 My Logs
⏱ Access Expiry
🆘 Request Owner Help
```

Owner menu হবে:

```text
🚀 Create VPS
🖥 VPS Control
👥 Manage Users
📦 Manage Packages
🔑 HopX API Key
📊 Usage & Limits
📜 Audit Logs
🔔 Notifications
🛑 Emergency Control
⚙️ Settings
```

---

## ৯. Shared VPS isolation model

এখানে data protection সবচেয়ে গুরুত্বপূর্ণ। Recommended model হলো:

```text
/shared-vps
├── /workspaces
│   ├── /user_<telegram_id_1>
│   ├── /user_<telegram_id_2>
│   └── /user_<telegram_id_3>
├── /deployments
├── /logs
└── /owner
```

Bot user command receive করে অনুমোদিত workspace path-এর মধ্যে command চালাবে। User input-এর মধ্যে `cd`, path traversal, privileged shell, process kill বা service-wide action থাকলে policy check করতে হবে।

একটি সাধারণ restricted terminal user-কে true Linux isolation দেবে না। শক্ত isolation দরকার হলে HopX-এর template বা runtime-এ আলাদা Linux user/container/sandbox ব্যবহার করতে হবে। Provider-এর actual isolation capability যাচাই না করে user-কে “private VPS” প্রতিশ্রুতি দেওয়া যাবে না।

---

## ১০. Central HopX API key architecture

### Secret storage

Worker secret store-এ থাকবে:

```text
HOPX_API_KEY_ACTIVE
HOPX_API_KEY_VERSION
```

যদি deployment environment-এ secret versioning সুবিধা না থাকে, তাহলে `HOPX_API_KEY` secret replace করা হবে এবং D1-তে শুধু version, fingerprint এবং status রাখা হবে। আসল key কখনো D1 বা Telegram message-এ রাখা যাবে না।

### Key fingerprint

Bot Owner-কে পুরো key না দেখিয়ে masked identity দেখাবে:

```text
Active key: hopx_live_••••••••9caA
Fingerprint: 7f42…a91c
Status: Healthy
Last checked: 2026-09-24 10:00
```

Fingerprint locally calculated বা provider-returned identifier থেকে নেওয়া যেতে পারে। Secret নিজে log করা যাবে না।

---

## ১১. API key change, revoke এবং rotation flow

### New key add

1. Owner `HopX API Key` menu খুলবেন।
2. `Add New Key` নির্বাচন করবেন।
3. Bot secure one-time input চাইবে।
4. Key format locally validate হবে।
5. Bot provider API-তে harmless validation request করবে।
6. Account/organization identity এবং quota response record করবে।
7. Existing active sandbox-এর সঙ্গে compatibility check করবে।
8. সব check pass করলে new key `candidate` থেকে `active` হবে।
9. Old key `previous` হিসেবে short grace period-এ থাকবে অথবা revoke করা হবে।
10. Owner confirmation notification পাবেন।

### Revoke old key

Owner `Revoke Previous Key` চাপবেন। Revoke করার আগে bot দেখাবে:

```text
⚠️ OLD KEY REVOCATION

Current active sandboxes: 1
Users with access: 3
Key fingerprint: 7f42…a91c

If the new key belongs to another HopX account, existing sandbox
management may stop working. Continue only after compatibility check.

[Confirm Revoke] [Cancel]
```

### Key exhausted বা invalid হলে

যে কোনো HopX request-এ `401`, quota exhausted, billing limit বা provider limit error এলে bot:

1. Error category detect করবে।
2. User-কে generic status দেখাবে।
3. Owner-কে immediate alert পাঠাবে।
4. New VPS creation temporarily pause করবে।
5. Existing D1 data পরিবর্তন করবে না।
6. Existing sandbox delete করার চেষ্টা করবে না।
7. Owner নতুন key submit করার option পাবে।

User-facing message:

```text
⏸ VPS SERVICE PAUSED

The shared provider limit is currently unavailable.
Your user data, package and access records are safe.
The owner has been notified.
```

### অত্যন্ত গুরুত্বপূর্ণ compatibility rule

নতুন key একই HopX organization/account-এর হলে existing sandbox management চালু থাকার সম্ভাবনা বেশি। কিন্তু নতুন key অন্য account বা organization-এর হলে পুরোনো sandbox-এর ownership স্বয়ংক্রিয়ভাবে স্থানান্তর হবে না। সে ক্ষেত্রে:

- পুরোনো sandbox metadata D1-তে থাকবে।
- পুরোনো sandbox-এর access token/operation provider অনুযায়ী expire হতে পারে।
- New key দিয়ে পুরোনো sandbox manage করা নাও যেতে পারে।
- Bot নতুন sandbox create করতে পারবে, কিন্তু পুরোনো sandbox migrate করতে হলে explicit provider-supported migration বা data export/import লাগবে।

তাই **key replace করা এবং VPS migrate করা একই operation নয়**। Zero-data-loss design-এর জন্য আগে backup/export এবং compatibility check বাধ্যতামূলক।

---

## ১২. Zero-data-loss strategy

User data এবং access metadata হারাবে না—এটি নিশ্চিত করতে তিনটি layer দরকার।

### Layer 1: D1 metadata persistence

নিচের data key rotation-এ কখনো delete করা যাবে না:

- Telegram user ID
- role
- package assignment
- access grant
- VPS logical ID
- workspace mapping
- deployment records
- usage records
- audit logs

### Layer 2: VPS data export

Key change-এর আগে Owner চাইলে bot:

- workspace list তৈরি করবে
- file manifest তৈরি করবে
- গুরুত্বপূর্ণ project archive করবে
- configuration export করবে
- deployment metadata save করবে
- backup checksum record করবে

### Layer 3: Reconciliation

New key active করার পরে bot verify করবে:

- expected sandbox ID provider list-এ আছে কি না
- status query কাজ করছে কি না
- service health check pass করছে কি না
- workspace marker file আছে কি না
- user grant mapping ঠিক আছে কি না

Reconciliation fail করলে key `active` হবে না; `candidate_failed` হিসেবে থাকবে এবং old key retained থাকবে, যতক্ষণ না Owner সিদ্ধান্ত নেন।

---

## ১৩. Automatic limit detection এবং owner alert

System দুইভাবে limit detect করবে:

### Synchronous detection

যখন কোনো create, execute, deploy বা status request করা হবে, তখন provider response থেকে limit error detect হবে। এটি সবচেয়ে নির্ভরযোগ্য immediate detection।

### Low-frequency health check

Provider যদি usage বা billing webhook না দেয়, Worker-এ low-frequency scheduled health check রাখা যেতে পারে। এই check:

- active key validation করবে
- provider list/status endpoint call করবে
- repeated failure count করবে
- owner alert deduplicate করবে
- new VPS creation lock করবে

এই check minute-by-minute polling হওয়া উচিত নয়। Provider-এর official webhook বা usage endpoint থাকলে সেটি ব্যবহার করা ভালো। না থাকলে user action-এর সময় check এবং সীমিত periodic check যথেষ্ট।

### Alert deduplication

একই error-এ প্রতি request-এ spam না করে D1-তে alert state রাখা হবে:

```text
provider_status = healthy | degraded | exhausted | invalid | revoked
last_alert_type
last_alert_at
alert_count
```

Owner alert:

```text
🚨 HOPX PROVIDER ALERT

Status: Credit/Limit unavailable
Action: New VPS creation paused
Active VPS metadata: Preserved
Users affected: 3

Please add a new HopX API key from:
🔑 HopX API Key → Add New Key
```

---

## ১৪. User package limit শেষ হলে আচরণ

Package limit শেষ হলে user-এর data delete করা যাবে না। State transition হবে:

```text
active → quota_reached → cooldown বা owner_review
```

User message:

```text
⏱ PACKAGE LIMIT REACHED

Your current package limit has been reached.
Your workspace and data remain preserved.
Please wait for reset or contact the owner.
```

Owner options:

- Quota reset
- Package upgrade
- Temporary extension
- User suspend
- Access expiry extend
- Workspace export

Package limit এবং HopX provider limit আলাদা state হিসেবে রাখতে হবে। একজন user-এর package limit শেষ হলে provider key rotate করার প্রয়োজন নেই। Provider limit শেষ হলে সব user-এর create/execute operation প্রভাবিত হতে পারে।

---

## ১৫. VPS control এবং user access model

Owner একটি shared VPS create করবেন। User-দের access grant হবে। Recommended grant fields:

```text
id
user_id
vps_id
package_id
workspace_path
permission_level
status
starts_at
expires_at
created_at
updated_at
```

Permission level:

- `workspace_only`
- `workspace_deploy`
- `service_view`
- `service_restart_request`
- `temporary_owner_approved`

`root` permission database-এ রাখা উচিত নয় বা default role হিসেবে দেওয়া উচিত নয়। Owner-এর root action আলাদা owner-only handler দিয়ে চালানো নিরাপদ।

---

## ১৬. Database schema update

বর্তমান `users`, `sandboxes`, `grants`, `access_requests` এবং `audit_logs` table-এর সঙ্গে package এবং provider state যোগ করতে হবে। Suggested schema:

```sql
CREATE TABLE IF NOT EXISTS packages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  max_daily_runtime_minutes INTEGER NOT NULL,
  max_commands_per_day INTEGER NOT NULL,
  max_upload_bytes INTEGER NOT NULL,
  max_deployments_per_day INTEGER NOT NULL,
  max_terminal_minutes_per_session INTEGER NOT NULL,
  max_concurrent_sessions INTEGER NOT NULL DEFAULT 1,
  allowed_actions TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_packages (
  user_id TEXT PRIMARY KEY,
  package_id INTEGER NOT NULL,
  assigned_by TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  expires_at TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  FOREIGN KEY(package_id) REFERENCES packages(id)
);

CREATE TABLE IF NOT EXISTS provider_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  provider TEXT NOT NULL,
  key_version INTEGER NOT NULL DEFAULT 1,
  key_fingerprint TEXT,
  status TEXT NOT NULL DEFAULT 'unknown',
  organization_ref TEXT,
  last_checked_at TEXT,
  last_error_code TEXT,
  last_error_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS usage_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  vps_id TEXT,
  action TEXT NOT NULL,
  units INTEGER DEFAULT 1,
  result TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS key_rotation_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  old_version INTEGER,
  new_version INTEGER,
  old_fingerprint TEXT,
  new_fingerprint TEXT,
  validation_status TEXT NOT NULL,
  compatibility_status TEXT,
  actor_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

`provider_state`-এ secret নয়, status ও non-sensitive fingerprint থাকবে।

---

## ১৭. API key management menu

```text
🔑 HOPX API CONTROL

Active key: hopx_live_••••9caA
Status: Healthy
Organization: verified
Last check: 2 minutes ago

[➕ Add New Key]
[🔄 Validate Current Key]
[♻️ Rotate Key]
[🚫 Revoke Previous Key]
[📜 Rotation History]
```

Secure input process:

1. Owner button চাপবেন।
2. Bot one-time private prompt দেবে।
3. Key message গ্রহণ করে immediately delete করার চেষ্টা করবে।
4. Key memory-এর বাইরে persist করা হবে না।
5. Provider validation হবে।
6. Success হলে Cloudflare secret update হবে।
7. Message content log করা হবে না।
8. Owner-কে শুধু fingerprint/status দেখানো হবে।

API key Telegram chat-এ পাঠানোর design পুরোপুরি নিরাপদ নয়। সম্ভব হলে secure web form বা Telegram WebApp-এর encrypted input ব্যবহার করা উচিত।

---

## ১৮. Owner control menu

```text
✦ AKASHVPS MASTER CONTROL ✦

🚀 Create Shared VPS
🖥 VPS Status
👥 Manage Users
📦 Manage Packages
🔑 HopX API Key
📊 Provider Usage
📈 User Usage
⌨️ Owner Terminal
📦 Deploy Project
🔔 Notifications
🧾 Audit Logs
🛑 Emergency Stop
⚙️ System Settings
```

Owner user actions:

- Approve user
- Assign package
- Change package
- Extend access
- Reset quota
- Suspend user
- Revoke user VPS access
- Send private message
- Export workspace
- View user activity

---

## ১৯. Failure state design

| Failure | User experience | Owner action |
|---|---|---|
| HopX key invalid | Operations paused | Add new key |
| HopX credit exhausted | New operations paused | Rotate/upgrade provider credential |
| Existing sandbox inaccessible after key rotation | Data preserved in metadata; migration warning | Restore compatible key or export/import |
| Package quota reached | User blocked from limited action | Reset/upgrade package |
| VPS expired | Access paused | Extend/recreate according to provider policy |
| Terminal session expired | Reconnect button | Revoke all sessions if needed |
| Deployment failed | Logs and retry | Inspect audit/logs |
| Provider outage | Maintenance message | Wait/retry; no data deletion |
| User suspended | Access removed | Reactivate or revoke |

Error state কখনো existing user record বা package assignment delete করবে না।

---

## ২০. Implementation phases for the existing project

### Phase 1: Simplify roles

- Developer/Admin role বাদ
- `owner` এবং `user` role enforce
- Owner ID single source of truth
- Pending, active এবং suspended status রাখা

### Phase 2: Add packages

- `packages` table
- `user_packages` table
- Owner CRUD
- User package enforcement
- Limit reset এবং expiry

### Phase 3: Owner-only VPS

- User menu থেকে create action বাদ
- Owner-only create handler
- Single active shared VPS policy
- Multiple VPS থাকলে owner labels ও grants

### Phase 4: Shared access

- `grants` table active করা
- Per-user workspace mapping
- Managed terminal policy
- User-specific usage events

### Phase 5: Central key management

- `HOPX_API_KEY` secret binding
- Validate, add, rotate, revoke flow
- Key fingerprint
- Candidate/active/previous state
- Compatibility check

### Phase 6: Monitoring and alerts

- Synchronous provider error detection
- Owner notification
- Provider state table
- Deduplicated alerts
- Low-frequency health check, যদি প্রয়োজন হয়

### Phase 7: Data protection

- Workspace export
- File manifest
- Backup metadata
- Reconciliation after key rotation
- Delete confirmation

### Phase 8: Premium interface

- Two-role menus
- Package badges
- Provider health badge
- Usage progress bars as text
- Owner alerts
- Clean Telegram formatting

---

## ২১. Two viable implementation options

| Approach | Tradeoffs | Cost | Setup Complexity |
|---|---|---|---|
| **Cloudflare Worker + D1 + HopX API + managed terminal** | Existing project reuse হবে, Telegram integration দ্রুত হবে, central key rotation ও package policy সহজে করা যাবে। তবে full terminal isolation এবং WebSocket gateway আলাদা করে carefully তৈরি করতে হবে। | Existing Cloudflare/HopX plan অনুযায়ী; extra managed service প্রয়োজন নাও হতে পারে | Medium |
| **Cloudflare Worker + D1 control plane + separate always-on terminal gateway** | Interactive terminal, session control এবং realtime logs বেশি নির্ভরযোগ্য হবে। তবে দ্বিতীয় runtime, deployment, secret sync এবং operational maintenance যোগ হবে। | Separate hosting/runtime-এর সম্ভাব্য recurring cost; provider plan অনুযায়ী | High |

**Lighter-weight alternative:** প্রথম release-এ full terminal না দিয়ে bot-mediated commands, logs, file upload এবং deployment actions চালু করা। এতে shared VPS access শুরু করা যাবে, কিন্তু interactive shell পরে যোগ করতে হবে। এটি নিরাপদ এবং দ্রুত validation-এর জন্য ভালো।

---

## ২২. Recommended final design

আপনার plan-এর জন্য recommended design হলো:

- Role: শুধু `owner` এবং `user`
- VPS creation: শুধু Owner
- HopX API: একটি central Owner-managed credential
- User access: shared VPS-এর assigned workspace
- Package: Basic, Developer, Owner-assigned Premium
- Root access: শুধু Owner
- User terminal: managed/restricted
- Key rotation: candidate → validate → compatibility check → active
- Existing metadata: কখনো delete নয়
- Different HopX account key: automatic migration নয়
- Provider limit: new operations pause + owner alert
- User package limit: শুধু ওই user-এর action pause
- Monitoring: action-based detection + limited health checks
- Data protection: export, manifest, reconciliation, audit

---

## ২৩. Final assessment

এই architecture বাস্তবে বানানো যাবে এবং আপনার বর্তমান Cloudflare Worker/D1 project-এর ওপর বসানো যাবে। বর্তমান project সম্পূর্ণ নতুন করে ফেলার প্রয়োজন নেই; existing webhook, Worker, D1 database এবং owner record reuse করা যাবে। তবে Worker code refactor, package tables, grant enforcement, HopX adapter, key rotation এবং shared workspace security যোগ করতে হবে।

সবচেয়ে গুরুত্বপূর্ণ operational truth হলো:

> **API key বদলালে bot-এর user/package metadata অক্ষুণ্ণ রাখা যায়; কিন্তু নতুন key অন্য HopX account-এর হলে পুরোনো sandbox-এর provider ownership অটোমেটিক বদলায় না।**

তাই bot কখনো key replace-কে “automatic VPS migration” হিসেবে দেখাবে না। একই account compatibility pass হলে existing VPS continue করবে। Compatibility fail হলে old state preserve করে Owner-কে restore বা export/import plan দেখাবে।

এই design-এ প্রথম production milestone হওয়া উচিত:

1. Owner-only shared VPS create
2. Two-role authorization
3. Basic/Developer package assignment
4. User workspace grant
5. Central HopX key validation and rotation
6. Provider-limit alert
7. Existing data preservation

এরপর managed terminal, deployment, file transfer এবং advanced package controls যুক্ত করা হবে।
