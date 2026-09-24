# AkashVPS Premium Telegram UI Specification

## Table-style layout, official formatting, keyboards এবং terminal link design

**Project:** AkashVPS Master Bot  
**Roles:** Owner এবং User  
**UI goal:** compact, readable, premium এবং self-service friendly Telegram interface

---

## ১. UI design principle

AkashVPS bot-এর UI হবে **dashboard-style Telegram interface**। Telegram message-এ সব client-এর জন্য true HTML/CSS table layout নিশ্চিত নয়। তাই table-style content-এর জন্য aligned monospace block এবং Unicode box-drawing characters ব্যবহার করা হবে।

Telegram officially HTML বা MarkdownV2 formatting, inline links, inline keyboard এবং reply keyboard support করে। Inline keyboard-এর URL button ব্যবহার করলে link-এর raw URL message body-তে দেখানোর প্রয়োজন হয় না। [Telegram Bot API](https://core.telegram.org/bots/api)

### UI hierarchy

```text
Header
  ↓
Status card বা table-style summary
  ↓
Primary action buttons
  ↓
Secondary navigation
  ↓
Footer: last update, help, support
```

সব message-এ একসঙ্গে অতিরিক্ত emoji, বড় paragraph এবং raw URL ব্যবহার করা হবে না। Important information আগে দেখানো হবে, actions নিচে থাকবে।

---

## ২. Formatting modes

### Regular text

Short explanation, onboarding instruction এবং error message-এর জন্য ব্যবহার হবে।

### Bold text

Section title, status label এবং action heading-এর জন্য ব্যবহার হবে।

### Italic text

Helper text, warning note এবং expiry description-এর জন্য ব্যবহার হবে।

### Inline code

ছোট command, file name, package name, sandbox ID এবং environment variable-এর জন্য:

```text
`npm install`
`requirements.txt`
`sandbox_abc123`
```

### Monospace block

Table, command output, logs এবং machine-readable status-এর জন্য ব্যবহার হবে:

```text
┌────────────────────────────┐
│ VPS STATUS                 │
├────────────────────────────┤
│ Status  : RUNNING          │
│ Region  : us-east          │
│ Expires : 01:42:18         │
└────────────────────────────┘
```

### Inline URL button

Terminal, live app, documentation, deployment preview এবং external dashboard-এর link message text-এ rawভাবে না দেখিয়ে inline URL button-এ রাখা হবে।

---

## ৩. Reply keyboard বনাম inline keyboard

### Reply keyboard কোথায় থাকবে

Reply keyboard হবে persistent main navigation। User সাধারণত নিচের menu দেখতে পাবে:

```text
🚀 Create VPS       🖥 My VPS
📦 Deploy Project   ⌨️ Terminal
📊 Usage            ⚙️ Settings
```

Owner-এর reply keyboard:

```text
👥 Users            📦 Packages
🖥 All VPS          🔑 HopX Keys
📊 Usage            📜 Audit Logs
🚨 Emergency        ⚙️ Settings
```

Reply keyboard মূল navigation-এর জন্য ব্যবহার হবে। এর button সাধারণত text পাঠাবে এবং Worker সেই text route করবে।

### Inline keyboard কোথায় থাকবে

Inline keyboard হবে context-sensitive action panel। এটি message-এর সঙ্গে attach হবে এবং callback query বা URL action চালাবে।

ব্যবহার:

- Approve/Reject
- Create/Cancel
- Start/Stop/Restart
- Select package
- Select VPS
- Open terminal
- Open live URL
- View logs
- Confirm destructive action
- Pagination
- Refresh status

### Rule

- Main menu = reply keyboard
- Current object action = inline keyboard
- External URL = inline URL button
- Destructive action = inline confirmation
- Long-form text = message body
- Status/metrics = monospace table

---

## ৪. Owner dashboard template

```text
✦ AKASHVPS OWNER CONTROL ✦

┌────────────────────────────┐
│ PLATFORM STATUS            │
├────────────────────────────┤
│ Users       : 04 active    │
│ VPS         : 03 running   │
│ Deployments : 02 online    │
│ Alerts      : 01 pending   │
│ Provider    : HEALTHY      │
└────────────────────────────┘

Choose an administrative action below.
```

Inline keyboard:

```text
[👥 Users] [📦 Packages]
[🖥 VPS] [🔑 HopX Keys]
[📊 Usage] [📜 Audit Logs]
[🚨 Emergency]
```

Reply keyboard থাকবে persistent navigation হিসেবে। Dashboard message-এর inline keyboard object-specific navigation করবে।

---

## ৫. User dashboard template

```text
✦ AKASHVPS USER PANEL ✦

┌────────────────────────────┐
│ ACCOUNT                    │
├────────────────────────────┤
│ User    : @{username}      │
│ Package : Developer        │
│ Status  : ACTIVE           │
│ Expires : 12 Oct 2026      │
└────────────────────────────┘

┌────────────────────────────┐
│ RESOURCE USAGE             │
├────────────────────────────┤
│ VPS       : 01 / 01        │
│ Runtime   : 02h / 06h      │
│ Commands  : 084 / 500      │
│ Deploy    : 02 / 05        │
└────────────────────────────┘
```

Inline keyboard:

```text
[🚀 Create VPS] [🖥 My VPS]
[📦 Deploy] [⌨️ Terminal]
[📊 Usage] [📜 Logs]
```

---

## ৬. New user onboarding UI

### User request

```text
✦ WELCOME TO AKASHVPS ✦

A premium Telegram-based VPS and deployment workspace.

To continue, submit an access request to the Owner.
```

Inline keyboard:

```text
[📩 Request Access]
[📖 How It Works] [🆘 Help]
```

### Owner request card

```text
🔔 NEW USER REQUEST

┌────────────────────────────┐
│ USER PROFILE               │
├────────────────────────────┤
│ Name     : {first_name}    │
│ Username : @{username}     │
│ Telegram : {telegram_id}   │
│ Requested: {timestamp}     │
└────────────────────────────┘
```

Inline keyboard:

```text
[✅ Accept User] [❌ Reject]
[👤 View Profile] [📩 Message]
```

### Accepted but inactive

```text
✅ ACCESS ACCEPTED

Choose a package to activate your workspace.
After activation, VPS creation and deployment are self-service.
```

Inline keyboard:

```text
[📦 Basic] [📦 Developer]
[📦 Premium] [📖 Compare Packages]
```

---

## ৭. Package comparison template

```text
✦ PACKAGE COMPARISON ✦

┌────────────┬────────┬───────────┬───────────┐
│ Feature    │ Basic  │ Developer │ Premium   │
├────────────┼────────┼───────────┼───────────┤
│ VPS        │ 1      │ 1–2       │ 2+        │
│ Runtime    │ 2h     │ 6h        │ 12h       │
│ Deploy/day │ 1      │ 5         │ 10        │
│ Terminal   │ Yes    │ Yes       │ Yes       │
│ GitHub     │ No     │ Yes       │ Yes       │
│ Upload     │ 25 MB  │ 100 MB    │ 250 MB    │
└────────────┴────────┴───────────┴───────────┘
```

Numbers configuration থেকে dynamic হবে; message code-এ hardcode করা উচিত নয়।

---

## ৮. HopX key UI

User key panel:

```text
🔑 YOUR HOPX ACCOUNT

┌────────────────────────────┐
│ Provider : HopX            │
│ Key      : ••••••••9caA    │
│ Status   : VERIFIED         │
│ Checked  : 2 min ago       │
└────────────────────────────┘

Your key is private and is never shown to other users.
```

Inline keyboard:

```text
[➕ Connect Key] [🔄 Replace Key]
[✅ Validate] [🚫 Revoke]
[📜 Key History]
```

Owner key overview:

```text
🔑 USER PROVIDER OVERVIEW

┌────────────────────────────┐
│ User       : @{username}   │
│ Key        : ••••••••9caA  │
│ Status     : HEALTHY       │
│ Sandboxes  : 01            │
│ Last check : 10:08 UTC     │
└────────────────────────────┘
```

Raw API key কখনো status table বা audit log-এ দেখানো যাবে না।

---

## ৯. VPS card template

```text
🖥 VPS DETAILS

┌────────────────────────────┐
│ ID       : `sandbox_abc123`│
│ Status   : 🟢 RUNNING      │
│ Template : code-interpreter│
│ Region   : us-east         │
│ Runtime  : 01:42:18        │
│ Expires  : 03:17:42        │
└────────────────────────────┘
```

Inline keyboard:

```text
[⌨️ Open Terminal]
[📦 Deploy Project] [📊 Refresh]
[📜 Logs] [🔄 Restart]
[🛑 Stop VPS]
```

`Open Terminal`, `Live App`, `Preview` এবং `Download` button-এ URL button থাকবে। User-কে raw URL copy করতে হবে না।

---

## ১০. Terminal access UI

Terminal খুললে আগে একটি secure session card দেখানো হবে:

```text
⌨️ TERMINAL SESSION

┌────────────────────────────┐
│ VPS      : sandbox_abc123  │
│ Workspace: /workspace/user │
│ Session  : ACTIVE           │
│ Expires  : 09:42            │
└────────────────────────────┘

Use the secure terminal button below.
The session URL is short-lived.
```

Inline URL keyboard:

```text
[⌨️ Open Secure Terminal](URL)
[🔄 Reconnect] [🛑 Close]
[📜 View Logs]
```

Terminal link কখনো plain text হিসেবে message-এর মধ্যে না দেখানো ভালো। Link button-এর URL short-lived signed session URL হবে।

### Terminal output template

```text
$ npm install

┌────────────────────────────┐
│ PROCESS OUTPUT             │
├────────────────────────────┤
│ Status : RUNNING           │
│ PID    : 4812              │
│ Output : 84 KB             │
└────────────────────────────┘
```

Long terminal output chunk করে পাঠাতে হবে। Sensitive environment variable mask করতে হবে।

---

## ১১. File upload এবং deployment UI

### Upload prompt

```text
📦 DEPLOY PROJECT

Send a ZIP file or choose a source.

Supported: Node.js, Python, PHP and static projects.
Maximum size depends on your package.
```

Inline keyboard:

```text
[📁 Upload ZIP]
[🔗 GitHub Repository]
[🧩 Starter Template]
[↩️ Back]
```

### Processing status

```text
⏳ DEPLOYMENT IN PROGRESS

┌────────────────────────────┐
│ Project  : my-bot.zip      │
│ Stage    : INSTALLING      │
│ Progress : 03 / 06         │
│ VPS      : sandbox_abc123  │
└────────────────────────────┘

Please keep this message open for live updates.
```

Stages:

```text
1. Uploading
2. Validating
3. Extracting
4. Installing
5. Starting
6. Health check
```

### Deployment success

```text
✅ DEPLOYMENT ONLINE

┌────────────────────────────┐
│ Project : my-bot           │
│ Type    : Node.js          │
│ Status  : 🟢 ONLINE        │
│ Runtime : 00:18:42         │
└────────────────────────────┘
```

Inline URL/action keyboard:

```text
[🌐 Open Live App](URL)
[⌨️ Open Terminal](URL)
[📜 Logs] [🔄 Restart]
[🛑 Stop]
```

---

## ১২. Error এবং alert design

Error message-এ provider-এর raw stack trace পাঠানো হবে না। User-friendly summary এবং optional log button থাকবে।

```text
⚠️ ACTION PAUSED

Your HopX provider account has reached its current limit.
Your files and project metadata are safe.

[🔑 Replace HopX Key]
[📩 Contact Owner] [📜 View Details]
```

Owner alert:

```text
🚨 PROVIDER ALERT

┌────────────────────────────┐
│ User   : @{username}       │
│ Status : CREDIT EXHAUSTED  │
│ VPS    : 01 affected       │
│ Action : New deploy paused │
└────────────────────────────┘
```

Inline keyboard:

```text
[🔑 Review Key] [📩 Notify User]
[📊 User Usage] [🧾 Audit]
```

---

## ১৩. Confirmation templates

Destructive actions-এর জন্য দুই-step confirmation দরকার:

```text
⚠️ STOP VPS

This will stop `sandbox_abc123`.
Running processes may be interrupted.
Project files will remain unless you choose delete.
```

Inline keyboard:

```text
[✅ Confirm Stop] [↩️ Cancel]
```

Delete action:

```text
🛑 DELETE PROJECT

This action removes the project workspace from the VPS.
Export a backup before continuing.
```

Inline keyboard:

```text
[📦 Export Backup] [🗑 Confirm Delete]
[↩️ Cancel]
```

---

## ১৪. Pagination এবং refresh

Long user/VPS/project list এক message-এ না পাঠিয়ে pagination ব্যবহার হবে:

```text
👥 USERS — PAGE 1 / 3

┌────┬──────────────┬────────┬────────┐
│ #  │ User         │ Status │ Plan   │
├────┼──────────────┼────────┼────────┤
│ 01 │ @alpha       │ ACTIVE │ Basic  │
│ 02 │ @beta        │ ACTIVE │ Dev    │
│ 03 │ @gamma       │ PENDING│ —      │
└────┴──────────────┴────────┴────────┘
```

Inline keyboard:

```text
[⬅️ Previous] [🔄 Refresh] [Next ➡️]
```

---

## ১৫. Message editing strategy

Progress message বারবার নতুন message না পাঠিয়ে একই message edit করা উচিত। এতে chat পরিষ্কার থাকবে।

Example:

```text
⏳ Uploading 20%
```

পরে একই message:

```text
⏳ Installing 70%
```

শেষে:

```text
✅ Deployment online
```

এতে premium dashboard-এর মতো experience হবে এবং notification spam কমবে।

---

## ১৬. Callback এবং routing rules

Inline callback payload ছোট, non-sensitive এবং server-side resolvable হবে:

```text
user:view:42
vps:status:17
vps:stop_confirm:17
deploy:logs:91
package:select:developer
```

Callback data-তে রাখা যাবে না:

- HopX API key
- auth token
- password
- full file content
- private URL
- sensitive user data

Worker callback receive করে user identity এবং object ownership পুনরায় যাচাই করবে।

---

## ১৭. Premium visual rules

- Header-এ consistent symbol এবং title থাকবে।
- Status-এর জন্য একই color semantics ব্যবহার হবে: `🟢`, `🟡`, `🔴`, `⏸`।
- Table column width fixed থাকবে।
- Important IDs inline code বা monospace হবে।
- Raw URL message body-তে কম রাখা হবে।
- Link button-এ action verb থাকবে: `Open Terminal`, `Open Live App`, `View Logs`।
- User-এর প্রতি message-এ খুব বেশি decorative emoji থাকবে না।
- Long logs separate message বা paginated view-এ যাবে।
- Error message-এ clear next action থাকবে।
- Owner এবং User menu আলাদা হবে।
- Reply keyboard persistent হলেও sensitive action inline confirmation ছাড়া চলবে না।

---

## ১৮. Implementation mapping

| UI requirement | Implementation |
|---|---|
| Table-style card | MarkdownV2 code block / monospace Unicode box |
| Bold/italic/code | Telegram HTML বা MarkdownV2 parse mode |
| Main navigation | ReplyKeyboardMarkup |
| Context actions | InlineKeyboardMarkup |
| Terminal link | Inline URL button with short-lived signed URL |
| Live app link | Inline URL button |
| Approval | Inline callback buttons |
| Destructive action | Confirm/cancel inline buttons |
| Long output | Chunked messages or paginated logs |
| Progress | EditMessageText |
| User-specific view | Callback ownership check |
| Premium status | Consistent header, cards and status symbols |

---

## ১৯. Final UI behavior

```text
Main menu → Reply keyboard
Object details → Monospace table card
Object actions → Inline keyboard
External destination → URL button
Approval → Inline callback
Destructive action → Confirm/cancel
Long output → Paged or chunked monospace
Progress → Same message edited in place
```

এই UI system অনুযায়ী AkashVPS bot Telegram-এর native capability ব্যবহার করে premium dashboard-এর মতো দেখাবে, কিন্তু unsupported true HTML table বা unsafe raw links-এর ওপর নির্ভর করবে না।

**Canonical rule:**

> **Table-style content will use monospace box layouts; navigation will use reply keyboards; object actions and approvals will use inline keyboards; terminal, live app and preview destinations will use secure URL buttons.**
