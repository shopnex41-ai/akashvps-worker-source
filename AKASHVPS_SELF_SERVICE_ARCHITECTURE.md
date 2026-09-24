# AkashVPS Self-Service User Architecture

## Owner onboarding approval, তারপর সম্পূর্ণ user self-service

**Supersedes:** `AKASHVPS_RESTORED_ARCHITECTURE.md`-এর per-action approval অংশ  
**Roles:** শুধু Owner এবং User  
**Provider model:** প্রত্যেক User নিজের HopX API key ব্যবহার করবে

---

## ১. Final policy

আপনার final user experience হবে:

> **Owner শুধু নতুন user গ্রহণ করবেন এবং package/purchase activate করবেন। Active user হওয়ার পরে user নিজের VPS, terminal, file upload, deployment, restart, logs এবং project management নিজেই করবে।**

প্রত্যেক deployment বা routine operation-এর জন্য Owner approval লাগবে না। এতে user স্বাধীনভাবে কাজ করতে পারবে এবং bot একটি real self-service VPS platform হিসেবে ব্যবহার করা যাবে।

Owner-এর control থাকবে, কিন্তু সেটি হবে **administrative override**, routine workflow-এর বাধা নয়।

---

## ২. Approval কোথায় লাগবে এবং কোথায় লাগবে না

| Action | Owner approval প্রয়োজন? |
|---|---:|
| New user request গ্রহণ | Yes |
| User-কে package/purchase offer দেওয়া | Owner-defined flow |
| Purchase বা package activation | Yes / payment verification |
| User account active করা | Yes বা verified payment-এর পরে automatic |
| User নিজের HopX API key connect করা | Initial validation এবং policy অনুযায়ী |
| User নিজের VPS create করা | No, active package ও quota থাকলে |
| User file upload করা | No, active package ও limit থাকলে |
| Project deploy করা | No |
| Dependency install করা | No, approved command policy-এর মধ্যে |
| Terminal খোলা | No, active user এবং package allowed হলে |
| Project restart/stop করা | No, নিজের project হলে |
| নিজের logs দেখা | No |
| Package upgrade | Purchase/activation flow |
| User suspend/revoke করা | Owner only |
| Global emergency stop | Owner only |
| অন্য user-এর resource দেখা | No |
| Root/global server action | Owner only |

---

## ৩. User lifecycle states

```text
requested
   ↓ Owner accepts
accepted
   ↓ package offer / purchase
awaiting_activation
   ↓ verified purchase or owner activation
active
   ↓ expiry, non-payment, policy violation
expired / suspended
```

### `requested`

নতুন user bot-এ আসবে। সে শুধু request submit করতে পারবে। VPS, terminal বা deployment menu দেখতে পারবে না।

### `accepted`

Owner user request গ্রহণ করেছেন। Bot package list, rules এবং purchase/activation instruction দেখাবে। এখনো full access থাকবে না।

### `awaiting_activation`

User package নির্বাচন করেছে এবং purchase/activation verification-এর অপেক্ষায় আছে।

### `active`

User package অনুযায়ী self-service ব্যবহার করতে পারবে। Owner-এর routine approval লাগবে না।

### `expired`

Package expiry বা subscription period শেষ হয়েছে। Data preserve থাকবে, কিন্তু new action pause হবে।

### `suspended`

Owner abuse, security issue বা policy violation-এর কারণে access বন্ধ করেছেন।

---

## ৪. New user onboarding flow

1. User `/start` চাপবে।
2. Bot user profile এবং Telegram ID save করবে।
3. Bot বলবে: access পেতে request পাঠাতে হবে।
4. Owner-এর কাছে request notification যাবে।
5. Owner `Accept User` চাপবেন।
6. Bot user-কে available package দেখাবে।
7. User package নির্বাচন করবে।
8. Bot purchase/activation instruction দেখাবে।
9. Purchase verified হলে account active হবে।
10. User নিজের HopX key connect করবে।
11. Key validation pass হলে user VPS create এবং deploy শুরু করতে পারবে।

Owner notification:

```text
🔔 NEW USER REQUEST

👤 Name: {name}
🆔 Telegram ID: {telegram_id}
🔗 Username: @{username}

This user is requesting access.

[✅ Accept User] [❌ Reject]
```

User acceptance message:

```text
✅ ACCESS ACCEPTED

You may now choose a package.
After activation, VPS creation and deployment will be self-service.

[📦 View Packages] [🔑 Connect HopX]
```

---

## ৫. Package activation/purchase flow

প্রথম version-এ purchase verification manual হতে পারে। পরে payment provider বা external verification webhook যুক্ত করা যাবে। Bot-এর core state একই থাকবে।

### Manual activation

1. User package নির্বাচন করবে।
2. Bot package price/rule দেখাবে।
3. User payment reference বা activation request পাঠাবে।
4. Owner যাচাই করবেন।
5. Owner `Activate Package` চাপবেন।
6. User `active` হবে।

### Automated activation

Payment provider থাকলে:

1. User package নির্বাচন করবে।
2. Bot checkout বা payment instruction দেবে।
3. Payment provider success callback পাঠাবে।
4. Backend payment reference verify করবে।
5. User package automatic active হবে।
6. Owner শুধু notification পাবেন।

Payment data বা secret bot source code-এ রাখা যাবে না। Payment integration চালু করার আগে provider-specific verification দরকার হবে।

Package activation message:

```text
📦 PACKAGE ACTIVATION

Package: Developer
Runtime limit: {runtime}
Daily commands: {commands}
Deployment: Enabled
Terminal: Enabled
Expiry: {expiry}

[✅ Activate Package] [↩️ Change Package]
```

---

## ৬. Active user self-service menu

Active user-এর menu Owner approval ছাড়া routine কাজ সম্পন্ন করবে:

```text
✦ AKASHVPS USER PANEL ✦

🔑 HopX Account
🚀 Create VPS
🖥 My VPS
⌨️ Open Terminal
📦 Upload Project
🚀 Deploy Project
📜 Logs
🔄 Restart Project
🛑 Stop Project
📊 Usage & Limits
📦 My Package
🆘 Contact Owner
```

Active user করতে পারবে:

- নিজের HopX key connect/replace request
- নিজের package quota-এর মধ্যে VPS create
- নিজের VPS-এ ZIP/file upload
- dependency install
- approved runtime দিয়ে project run
- Telegram bot run
- web app deploy
- terminal open
- logs দেখা
- process restart/stop
- project update/redeploy
- নিজের workspace manage

প্রতিটি action-এর আগে Owner approval নয়, বরং automated policy check হবে।

---

## ৭. Automated policy checks

Owner approval বাদ গেলেও security এবং package enforcement থাকবে। প্রতিটি operation-এর আগে bot নিজে যাচাই করবে:

```text
User active?
→ Package active?
→ Owns this VPS/project?
→ HopX key valid?
→ Quota available?
→ File/command policy valid?
→ Resource limit available?
→ Execute action
→ Write audit log
```

কোনো check fail হলে user-কে কারণ দেখানো হবে। Owner-এর কাছে শুধু alert যাবে, routine approval request নয়।

Example:

```text
⏸ ACTION PAUSED

Your daily deployment limit has been reached.
Your project and user data are preserved.
Try again after quota reset or upgrade your package.
```

---

## ৮. Self-service file upload ও deployment

Active user-এর deployment flow হবে:

```text
Upload ZIP/file
      ↓
Validate size, archive and path
      ↓
Check package quota
      ↓
Upload to user's HopX sandbox
      ↓
Extract to user's workspace
      ↓
Detect Node/Python/PHP/static project
      ↓
Install dependencies
      ↓
Start process
      ↓
Health check
      ↓
Show URL, terminal and logs
```

এই process-এ Owner approval লাগবে না, যদি:

- User active থাকে
- Package deployment allow করে
- User নিজের VPS ব্যবহার করে
- File size limit-এর মধ্যে থাকে
- Command policy pass করে
- Runtime ও quota available থাকে

Custom unrestricted shell command বা global server action package policy-তে বন্ধ থাকবে। এটি Owner-only control হিসেবে থাকবে।

Deployment success:

```text
✅ PROJECT DEPLOYED

📦 Project: {project_name}
🖥 VPS: {sandbox_id}
🟢 Status: Online
🌐 URL: {public_url}
⏱ Runtime: {runtime}

[⌨️ Terminal] [📜 Logs]
[🔄 Restart] [🛑 Stop]
```

---

## ৯. Per-user HopX key model

প্রত্যেক User নিজের provider credential ব্যবহার করবে। Active user নিজের key connect করার পরে bot:

- key format validate করবে
- provider API call করে key test করবে
- account/organization reference capture করবে
- masked fingerprint দেখাবে
- raw key secret storage-এ রাখবে
- D1-তে শুধু metadata রাখবে

User key limit শেষ হলে:

1. User-এর new VPS/deployment operation pause হবে।
2. Owner automatic alert পাবেন।
3. User নতুন key submit করতে পারবে।
4. New key validation pass হলে active হবে।
5. User/package/VPS metadata preserve থাকবে।
6. New key অন্য provider account হলে existing sandbox migration warning দেখাবে।

User-facing message:

```text
⚠️ PROVIDER LIMIT REACHED

Your HopX account is currently unavailable or exhausted.
Your files, projects, package and history are safe.

[🔑 Replace HopX Key] [📩 Contact Owner]
```

---

## ১০. Owner controls after activation

Owner routine deployment আটকাবেন না। Owner-এর controls হবে administrative ও emergency nature-এর:

```text
👥 User Management
📦 Package Management
🔑 Provider Credential Overview
📊 User Usage Overview
🛑 Suspend User
🔒 Revoke Access
🚨 Emergency Stop
🧾 Audit Logs
⚙️ Global Policy
```

Owner চাইলে:

- user suspend করতে পারবেন
- package বদলাতে পারবেন
- quota reset করতে পারবেন
- access expiry extend করতে পারবেন
- user-এর VPS stop করতে পারবেন
- abusive process kill করতে পারবেন
- global deployment freeze করতে পারবেন
- user notification পাঠাতে পারবেন

কিন্তু active user-এর normal `Deploy`, `Restart`, `Upload` এবং `Terminal` action-এর জন্য Owner-এর chat approval লাগবে না।

---

## ১১. Package examples

### Basic

- ১টি active VPS
- limited runtime
- limited daily commands
- ZIP upload
- managed terminal
- predefined start command
- limited deployments

### Developer

- ১–২টি active VPS
- বেশি runtime
- বড় upload limit
- Node/Python deployment
- GitHub/ZIP support
- restart/logs
- custom project start command within policy

### Premium

- বেশি runtime ও storage
- multiple project deployment
- বেশি terminal minutes
- higher daily quota
- approved runtime presets
- automated restart
- higher concurrency

Package active থাকা অবস্থায় user নিজে সব allowed feature ব্যবহার করবে। Package শেষ হলে automated quota enforcement হবে, Owner per-action approval নয়।

---

## ১২. Data model update

User lifecycle এবং package activation track করার জন্য D1-তে এই fields/table দরকার:

```sql
ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE users ADD COLUMN accepted_at TEXT;
ALTER TABLE users ADD COLUMN activated_at TEXT;
ALTER TABLE users ADD COLUMN suspended_at TEXT;

CREATE TABLE IF NOT EXISTS package_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  package_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'awaiting_activation',
  payment_reference TEXT,
  amount TEXT,
  currency TEXT,
  requested_at TEXT NOT NULL,
  activated_at TEXT,
  expires_at TEXT,
  reviewed_by TEXT
);

CREATE TABLE IF NOT EXISTS user_policy_state (
  user_id TEXT PRIMARY KEY,
  deployment_locked INTEGER NOT NULL DEFAULT 0,
  provider_locked INTEGER NOT NULL DEFAULT 0,
  lock_reason TEXT,
  updated_at TEXT NOT NULL
);
```

`users.status` এবং `package_orders.status` আলাদা রাখা উচিত। User accepted হলেও package active না হওয়া পর্যন্ত full access দেওয়া যাবে না।

---

## ১৩. Security model without per-action approval

Self-service মানে unrestricted execution নয়। Security enforcement automated হবে:

- Telegram ID ownership check
- User-to-VPS ownership check
- Package quota check
- File size check
- ZIP path traversal protection
- Command timeout
- Output size limit
- Workspace isolation
- Process limit
- Deployment concurrency limit
- API key secret isolation
- Audit logs
- Automatic expiry
- Abuse detection
- Owner emergency revoke

User নিজের workspace-এর বাইরে command চালাতে পারবে না। Root/global system actions Owner-only থাকবে।

---

## ১৪. Revised implementation order

### Phase 1: Onboarding gate

- New user request
- Owner accept/reject
- Package selection
- Manual activation state

### Phase 2: Per-user credential

- Secure HopX key connect
- Provider validation
- Owner overview
- Key replace/revoke
- Limit alerts

### Phase 3: Self-service VPS

- Active user create VPS
- Own-key provider adapter
- VPS status/list/stop
- D1 persistence

### Phase 4: Self-service deployment

- ZIP upload
- R2 temporary storage
- Extract and validate
- Node/Python/static detection
- Dependency install
- Start/restart/stop
- Logs and health checks

### Phase 5: Self-service terminal

- Short-lived terminal session
- User-owned sandbox check
- Managed workspace terminal
- Session expiry and revoke

### Phase 6: Owner administration

- Package CRUD
- Quota reset
- User suspension
- Global emergency stop
- Audit and usage dashboard

---

## ১৫. Final behavior summary

```text
New User
   ↓
Owner Accepts
   ↓
User Selects Package / Completes Purchase
   ↓
Package Activated
   ↓
User Connects Own HopX Key
   ↓
User Creates Own VPS
   ↓
User Uploads Files
   ↓
User Deploys Project
   ↓
User Opens Terminal and Manages Project
   ↓
Automated limits and security checks
   ↓
Owner receives alerts only when needed
```

Final rule:

> **Owner approval is required for entering the platform and activating a package. After activation, the User operates independently within the package and security limits.**

এই policy অনুযায়ী active user-এর প্রতিটি deployment, restart বা upload-এর জন্য Owner notification বা manual approval থাকবে না। Owner শুধু limit, abuse, expiry, provider error এবং emergency condition-এ intervene করবেন।

বর্তমান project-এ এই revised model বসাতে হলে আগের per-user HopX architecture রাখা হবে, শুধু per-action approval layer বাদ দিয়ে onboarding/purchase activation gate করা হবে।
