const OWNER_DEFAULT = "8269594940";
const HOPX_API = "https://api.hopx.dev";
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const mainMenu = {
  keyboard: [
    ["🚀 Create VPS", "🖥 My VPS"],
    ["📦 Deploy Project", "⌨️ Terminal"],
    ["📊 Usage", "🔑 HopX Key"]
  ],
  resize_keyboard: true,
  is_persistent: true
};

const ownerMenu = {
  keyboard: [
    ["👥 Users", "📦 Packages"],
    ["🖥 All VPS", "🔑 HopX Keys"],
    ["📊 Usage", "📜 Audit Logs"]
  ],
  resize_keyboard: true,
  is_persistent: true
};

const html = (value = "") => String(value).replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));

const now = () => new Date().toISOString();
const short = (value = "") => String(value).slice(0, 18);

function table(title, rows) {
  const width = Math.max(28, ...rows.map(([k, v]) => String(k).length + String(v).length + 7));
  const line = "─".repeat(width);
  return `<pre>┌${line}┐\n│ ${title.padEnd(width - 2)} │\n├${line}┤\n${rows.map(([k, v]) => `│ ${String(k).padEnd(12)}: ${String(v).padEnd(width - 16)} │`).join("\n")}\n└${line}┘</pre>`;
}

function inline(rows) {
  return { inline_keyboard: rows };
}

function callback(text, data) {
  return { text, callback_data: data };
}

function urlButton(text, url) {
  return { text, url };
}

async function tg(env, method, payload) {
  const response = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  return response.json();
}

async function send(env, chatId, text, replyMarkup, extra = {}) {
  return tg(env, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    reply_markup: replyMarkup,
    disable_web_page_preview: true,
    ...extra
  });
}

async function answerCallback(env, callbackId, text = "") {
  return tg(env, "answerCallbackQuery", { callback_query_id: callbackId, text, show_alert: false });
}

async function edit(env, chatId, messageId, text, replyMarkup) {
  return tg(env, "editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    reply_markup: replyMarkup,
    disable_web_page_preview: true
  });
}

async function deleteMessage(env, chatId, messageId) {
  return tg(env, "deleteMessage", { chat_id: chatId, message_id: messageId });
}

async function db(env, sql, ...params) {
  return env.DB.prepare(sql).bind(...params).run();
}

async function first(env, sql, ...params) {
  return env.DB.prepare(sql).bind(...params).first();
}

async function all(env, sql, ...params) {
  return env.DB.prepare(sql).bind(...params).all();
}

function b64(bytes) {
  let binary = "";
  const view = new Uint8Array(bytes);
  for (let i = 0; i < view.length; i += 0x8000) binary += String.fromCharCode(...view.subarray(i, i + 0x8000));
  return btoa(binary);
}

function bytesFromB64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function cryptoKey(env) {
  if (!env.CREDENTIAL_ENCRYPTION_KEY) throw new Error("CREDENTIAL_ENCRYPTION_KEY is not configured");
  const raw = bytesFromB64(env.CREDENTIAL_ENCRYPTION_KEY);
  if (raw.byteLength !== 32) throw new Error("CREDENTIAL_ENCRYPTION_KEY must be base64 encoded 32 bytes");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encrypt(env, value) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await cryptoKey(env), new TextEncoder().encode(value));
  return `${b64(iv)}.${b64(cipher)}`;
}

async function decrypt(env, packed) {
  const [ivPart, cipherPart] = String(packed).split(".");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytesFromB64(ivPart) }, await cryptoKey(env), bytesFromB64(cipherPart));
  return new TextDecoder().decode(plain);
}

async function audit(env, userId, action, result, sandboxId = null) {
  await db(env, `INSERT INTO audit_logs(actor_telegram_id, action, sandbox_id, result, created_at) VALUES(?,?,?,?,?)`, String(userId), action, sandboxId, result, now());
}

async function getUser(env, userId) {
  return first(env, `SELECT * FROM users WHERE telegram_id = ?`, String(userId));
}

async function upsertUser(env, from) {
  const id = String(from.id);
  const existing = await getUser(env, id);
  if (existing) {
    await db(env, `UPDATE users SET username=?, first_name=?, last_name=?, language_code=?, last_seen_at=? WHERE telegram_id=?`, from.username || null, from.first_name || null, from.last_name || null, from.language_code || null, now(), id);
    return { ...existing, username: from.username || null, first_name: from.first_name || null, last_seen_at: now() };
  }
  const owner = id === String(OWNER_DEFAULT);
  await db(env, `INSERT INTO users(telegram_id, username, first_name, last_name, language_code, role, active, status, created_at, last_seen_at) VALUES(?,?,?,?,?,?,?,?,?,?)`, id, from.username || null, from.first_name || null, from.last_name || null, from.language_code || null, owner ? "owner" : "user", owner ? 1 : 0, owner ? "active" : "pending", now(), now());
  return getUser(env, id);
}

async function getPackage(env, packageId) {
  return first(env, `SELECT * FROM packages WHERE id=? AND status='active'`, packageId);
}

async function getUserPackage(env, userId) {
  return first(env, `SELECT p.*, up.expires_at AS package_expires_at, up.status AS assignment_status FROM user_packages up JOIN packages p ON p.id=up.package_id WHERE up.user_id=? AND up.status='active' AND p.status='active'`, String(userId));
}

async function getCredential(env, userId) {
  return first(env, `SELECT * FROM provider_credentials WHERE user_id=? AND provider='hopx' AND status='active' ORDER BY key_version DESC LIMIT 1`, String(userId));
}

function dashboard(user, pkg) {
  const name = user.username ? `@${user.username}` : user.first_name || user.telegram_id;
  return `✦ <b>AKASHVPS USER PANEL</b> ✦\n\n${table("ACCOUNT", [["User", name], ["Status", String(user.status || "pending").toUpperCase()], ["Package", pkg?.name || "Not activated"], ["Role", user.role]])}\n\nChoose an action below.`;
}

function ownerDashboard() {
  return `✦ <b>AKASHVPS OWNER CONTROL</b> ✦\n\n${table("PLATFORM", [["Mode", "SELF-SERVICE"], ["Roles", "OWNER + USER"], ["Provider", "PER-USER HOPX"], ["Status", "ONLINE"]])}\n\nUse the admin keyboard below.`;
}

async function requestAccess(env, user) {
  const existing = await first(env, `SELECT * FROM access_requests WHERE telegram_id=? AND status='pending' ORDER BY id DESC LIMIT 1`, user.telegram_id);
  if (!existing) await db(env, `INSERT INTO access_requests(telegram_id, username, first_name, last_name, status, created_at) VALUES(?,?,?,?,?,?)`, user.telegram_id, user.username, user.first_name, user.last_name, "pending", now());
  await send(env, env.OWNER_ID || OWNER_DEFAULT, `🔔 <b>NEW USER REQUEST</b>\n\n${table("USER", [["Name", user.first_name || "-"], ["Username", user.username ? `@${user.username}` : "-"], ["Telegram", user.telegram_id]])}`, inline([[callback("✅ Accept User", `user:accept:${user.telegram_id}`), callback("❌ Reject", `user:reject:${user.telegram_id}`)]]));
  return send(env, user.telegram_id, `⏳ <b>ACCESS REQUEST RECEIVED</b>\n\nYour request has been sent to the Owner. You will receive package activation instructions after acceptance.`, mainMenu);
}

async function showPackages(env, chatId) {
  const result = await all(env, `SELECT * FROM packages WHERE status='active' ORDER BY id`);
  const rows = result.results || [];
  const text = `📦 <b>AVAILABLE PACKAGES</b>\n\n${rows.map((p) => `${table(p.name, [["Files", p.max_files_per_project], ["Commands", p.max_commands_per_day], ["Deploys", p.max_deployments_per_day], ["Upload", `${Math.round(p.max_upload_bytes / 1024 / 1024)} MB`], ["CPU", p.cpu_policy || "provider"]])}`).join("\n\n")}\nThere is no bot-enforced date or runtime expiry. Provider limits still apply.`;
  const buttons = rows.map((p) => callback(`📦 ${p.name}`, `package:select:${p.id}`));
  return send(env, chatId, text, inline([buttons]));
}

async function activateUser(env, userId, packageId, ownerId) {
  const pkg = await getPackage(env, packageId);
  if (!pkg) throw new Error("Package not found");
  await db(env, `UPDATE users SET status='active', active=1 WHERE telegram_id=?`, String(userId));
  await db(env, `INSERT INTO user_packages(user_id, package_id, assigned_by, starts_at, status) VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET package_id=excluded.package_id, assigned_by=excluded.assigned_by, starts_at=excluded.starts_at, status='active'`, String(userId), pkg.id, String(ownerId), now());
  await db(env, `UPDATE package_orders SET status='activated', activated_at=?, reviewed_by=? WHERE user_id=? AND status IN ('awaiting_activation','accepted')`, now(), String(ownerId), String(userId));
  await audit(env, ownerId, "activate_package", `package:${pkg.name}`);
  await send(env, userId, `✅ <b>PACKAGE ACTIVATED</b>\n\n${table("PLAN", [["Package", pkg.name], ["Files", pkg.max_files_per_project], ["Upload", `${Math.round(pkg.max_upload_bytes / 1024 / 1024)} MB`], ["CPU", pkg.cpu_policy || "provider"], ["Status", "ACTIVE"]])}\n\nYou can now connect your own HopX key and use the bot self-service.`, mainMenu);
}

async function providerRequest(path, method, key, body) {
  const response = await fetch(`${HOPX_API}${path}`, { method, headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!response.ok) {
    const error = new Error(data?.error || data?.message || `HopX ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

async function connectKey(env, user, key, messageId) {
  if (!key.startsWith("hopx_live_")) return send(env, user.telegram_id, "❌ Invalid HopX key format. It should start with `hopx_live_`.", mainMenu);
  const validation = await providerRequest("/v1/sandboxes", "GET", key);
  const encrypted = await encrypt(env, key);
  const fingerprint = `${key.slice(0, 10)}••••${key.slice(-4)}`;
  const previous = await first(env, `SELECT MAX(key_version) AS v FROM provider_credentials WHERE user_id=?`, user.telegram_id);
  const version = Number(previous?.v || 0) + 1;
  await db(env, `UPDATE provider_credentials SET status='revoked', updated_at=? WHERE user_id=? AND status='active'`, now(), user.telegram_id);
  await db(env, `INSERT INTO provider_credentials(user_id, provider, key_version, key_ciphertext, key_fingerprint, organization_ref, status, last_validated_at, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`, user.telegram_id, "hopx", version, encrypted, fingerprint, validation?.organization_id || null, "active", now(), now(), now());
  await audit(env, user.telegram_id, "hopx_key_connected", "validated");
  if (messageId) await deleteMessage(env, user.telegram_id, messageId);
  return send(env, user.telegram_id, `✅ <b>HOPX KEY VERIFIED</b>\n\n${table("PROVIDER", [["Key", fingerprint], ["Status", "VERIFIED"], ["Version", version], ["Sandboxes", validation?.sandboxes?.length ?? "ready"]])}\n\nYour own HopX account is now connected.`, mainMenu);
}

async function createSandbox(env, user) {
  const pkg = await getUserPackage(env, user.telegram_id);
  if (!pkg) return send(env, user.telegram_id, "📦 Activate a package first.", inline([[callback("📦 View Packages", "packages:view")]]));
  const credential = await getCredential(env, user.telegram_id);
  if (!credential) return send(env, user.telegram_id, "🔑 Connect your own HopX API key first.", inline([[callback("🔑 Connect HopX", "key:help")]]));
  const activeCount = await first(env, `SELECT COUNT(*) AS n FROM sandboxes WHERE owner_telegram_id=? AND status IN ('creating','running')`, user.telegram_id);
  if (Number(activeCount?.n || 0) >= Number(pkg.max_active_sandboxes)) return send(env, user.telegram_id, "⏸ Your package active VPS limit has been reached.", inline([[callback("📊 Usage", "usage:me")]]));
  const key = await decrypt(env, credential.key_ciphertext);
  try {
    const sandbox = await providerRequest("/v1/sandboxes", "POST", key, { template_id: "73" });
    const id = sandbox.id;
    const token = sandbox.auth_token ? await encrypt(env, sandbox.auth_token) : null;
    await db(env, `INSERT INTO sandboxes(sandbox_id, label, owner_telegram_id, status, expires_at, service_url, auth_token_ciphertext, created_at) VALUES(?,?,?,?,?,?,?,?)`, id, `${pkg.name} workspace`, user.telegram_id, sandbox.status || "running", sandbox.token_expires_at || null, sandbox.public_host || sandbox.direct_url || null, token, now());
    await audit(env, user.telegram_id, "create_sandbox", "success", id);
    return send(env, user.telegram_id, `✅ <b>VPS READY</b>\n\n${table("VPS", [["ID", id], ["Status", sandbox.status || "running"], ["Template", sandbox.template_name || "code-interpreter"], ["Expires", sandbox.timeout_seconds ? `${sandbox.timeout_seconds}s` : "provider"]])}`, inline([[callback("📊 Refresh", `vps:status:${id}`), callback("📦 Deploy", `deploy:help:${id}`)], [callback("🛑 Stop VPS", `vps:stop:${id}`)]]));
  } catch (error) {
    const exhausted = [402, 403, 429].includes(error.status);
    await db(env, `UPDATE provider_credentials SET status=?, last_error_code=?, updated_at=? WHERE id=?`, exhausted ? "exhausted" : "invalid", String(error.status || "provider_error"), now(), credential.id);
    await audit(env, user.telegram_id, "create_sandbox", `failed:${error.status || "provider"}`);
    await send(env, env.OWNER_ID || OWNER_DEFAULT, `🚨 <b>HOPX PROVIDER ALERT</b>\n\n${table("USER", [["Telegram", user.telegram_id], ["Status", exhausted ? "LIMIT/QUOTA" : "INVALID KEY"], ["Action", "New operations paused"]])}`);
    return send(env, user.telegram_id, `⏸ <b>HOPX ACCESS PAUSED</b>\n\nYour provider account is unavailable or out of limit. Your data and package are preserved.`, inline([[callback("🔑 Replace Key", "key:help"), callback("📩 Contact Owner", "owner:contact")]]));
  }
}

async function userVps(env, user) {
  const result = await all(env, `SELECT sandbox_id, label, status, expires_at, service_url FROM sandboxes WHERE owner_telegram_id=? ORDER BY created_at DESC LIMIT 10`, user.telegram_id);
  const rows = result.results || [];
  if (!rows.length) return send(env, user.telegram_id, "🖥 <b>MY VPS</b>\n\nNo VPS has been created yet.", inline([[callback("🚀 Create VPS", "vps:create")]]));
  const text = `🖥 <b>MY VPS</b>\n\n${rows.map((s) => table(s.label, [["ID", s.sandbox_id], ["Status", s.status], ["Expires", s.expires_at || "provider"]])).join("\n\n")}`;
  return send(env, user.telegram_id, text, inline(rows.map((s) => [callback(`📊 ${short(s.sandbox_id)}`, `vps:status:${s.sandbox_id}`)])));
}

async function status(env, user, sandboxId) {
  const sandbox = await first(env, `SELECT * FROM sandboxes WHERE sandbox_id=? AND owner_telegram_id=?`, sandboxId, user.telegram_id);
  if (!sandbox) return send(env, user.telegram_id, "❌ VPS not found or not owned by you.", mainMenu);
  const credential = await getCredential(env, user.telegram_id);
  if (!credential) return send(env, user.telegram_id, "🔑 Connect your HopX key first.", mainMenu);
  try {
    const key = await decrypt(env, credential.key_ciphertext);
    const list = await providerRequest(`/v1/sandboxes/${encodeURIComponent(sandboxId)}`, "GET", key);
    await db(env, `UPDATE sandboxes SET status=?, service_url=? WHERE sandbox_id=?`, list.status || sandbox.status, list.public_host || list.direct_url || sandbox.service_url, sandboxId);
    return send(env, user.telegram_id, `📊 <b>LIVE VPS STATUS</b>\n\n${table("VPS", [["ID", sandboxId], ["Status", list.status || sandbox.status], ["URL", list.public_host || list.direct_url || "not available"]])}`, inline([[callback("🔄 Refresh", `vps:status:${sandboxId}`), callback("📦 Deploy", `deploy:help:${sandboxId}`)]]));
  } catch {
    return send(env, user.telegram_id, "⚠️ Provider status could not be refreshed. Your local record is preserved.", mainMenu);
  }
}

async function handleDocument(env, user, document, messageId) {
  const pkg = await getUserPackage(env, user.telegram_id);
  if (!pkg || user.status !== "active") return send(env, user.telegram_id, "📦 Activate a package before uploading a project.", inline([[callback("📦 Packages", "packages:view")]]));
  if (Number(document.file_size || 0) > Math.min(MAX_UPLOAD_BYTES, Number(pkg.max_upload_bytes))) return send(env, user.telegram_id, "❌ This file is larger than your package limit.", mainMenu);
  const sandbox = await first(env, `SELECT * FROM sandboxes WHERE owner_telegram_id=? AND status IN ('running','creating') ORDER BY created_at DESC LIMIT 1`, user.telegram_id);
  if (!sandbox?.auth_token_ciphertext) return send(env, user.telegram_id, "🖥 Create a VPS first.", inline([[callback("🚀 Create VPS", "vps:create")]]));
  const credential = await getCredential(env, user.telegram_id);
  if (!credential) return send(env, user.telegram_id, "🔑 Connect your HopX key first.", mainMenu);
  const token = await decrypt(env, sandbox.auth_token_ciphertext);
  const fileInfo = await tg(env, "getFile", { file_id: document.file_id });
  if (!fileInfo.ok) return send(env, user.telegram_id, "❌ Telegram file could not be retrieved.", mainMenu);
  const binary = await (await fetch(`https://api.telegram.org/file/bot${env.BOT_TOKEN}/${fileInfo.result.file_path}`)).arrayBuffer();
  const encoded = b64(binary);
  const base = `/workspace/akashvps/${user.telegram_id}`;
  const agent = sandbox.service_url || `https://${sandbox.sandbox_id}.hopx.dev`;
  const headers = { Authorization: `Bearer ${token}`, "content-type": "application/json" };
  const write = await fetch(`${agent}/files/write`, { method: "POST", headers, body: JSON.stringify({ path: `${base}/upload.b64`, content: encoded }) });
  if (!write.ok) return send(env, user.telegram_id, "❌ Project upload to VPS failed.", mainMenu);
  const maxFiles = Math.max(1, Number(pkg.max_files_per_project || 25));
  const command = `mkdir -p ${base}/project && base64 -d ${base}/upload.b64 > ${base}/project/project.zip && count=$(unzip -Z1 ${base}/project/project.zip | wc -l) && test "$count" -le ${maxFiles} || { echo "file limit exceeded: $count/${maxFiles}"; exit 23; } && unzip -oq ${base}/project/project.zip -d ${base}/project && rm -f ${base}/upload.b64 ${base}/project/project.zip`;
  const run = await fetch(`${agent}/commands/run`, { method: "POST", headers, body: JSON.stringify({ command, working_dir: "/workspace", timeout: 120 }) });
  const result = await run.json().catch(() => ({}));
  await audit(env, user.telegram_id, "upload_project", run.ok && result.exit_code === 0 ? "success" : "failed", sandbox.sandbox_id);
  if (!run.ok || result.exit_code !== 0) return send(env, user.telegram_id, `❌ <b>EXTRACT FAILED</b>\n\n<pre>${html((result.stderr || "Upload failed").slice(0, 3000))}</pre>`, mainMenu);
  return send(env, user.telegram_id, `✅ <b>PROJECT UPLOADED</b>\n\n${table("DEPLOYMENT", [["File", document.file_name || "upload"], ["VPS", sandbox.sandbox_id], ["Path", `${base}/project`], ["Status", "READY TO START"]])}\n\nUse the terminal to install dependencies and start the project.`, inline([[callback("⌨️ Terminal", `terminal:open:${sandbox.sandbox_id}`), callback("📊 VPS Status", `vps:status:${sandbox.sandbox_id}`)]]));
}

async function handleCallback(env, query) {
  const userId = String(query.from.id);
  const user = await getUser(env, userId);
  await answerCallback(env, query.id);
  if (!user) return;
  const [scope, action, value] = String(query.data || "").split(":");
  if (scope === "user" && user.role === "owner") {
    const target = await getUser(env, value);
    if (!target) return send(env, userId, "User not found.", ownerMenu);
    if (action === "accept") {
      await db(env, `UPDATE users SET status='accepted' WHERE telegram_id=?`, value);
      await db(env, `UPDATE access_requests SET status='accepted', reviewed_at=? WHERE telegram_id=? AND status='pending'`, now(), value);
      await send(env, value, "✅ <b>ACCESS ACCEPTED</b>\n\nChoose a package to activate your account.", mainMenu);
      return showPackages(env, value);
    }
    if (action === "reject") {
      await db(env, `UPDATE users SET status='suspended', active=0 WHERE telegram_id=?`, value);
      await db(env, `UPDATE access_requests SET status='rejected', reviewed_at=? WHERE telegram_id=? AND status='pending'`, now(), value);
      await send(env, value, "❌ Your access request was not accepted.", mainMenu);
      return send(env, userId, `❌ User ${html(value)} rejected.`, ownerMenu);
    }
  }
  if (scope === "package" && action === "select") {
    if (!user || user.status !== "accepted") return send(env, userId, "Your account is not ready for package activation.", mainMenu);
    const pkg = await getPackage(env, value);
    if (!pkg) return send(env, userId, "Package unavailable.", mainMenu);
    await db(env, `INSERT INTO package_orders(user_id, package_id, status, requested_at) VALUES(?,?,?,?)`, userId, pkg.id, "awaiting_activation", now());
    await send(env, env.OWNER_ID || OWNER_DEFAULT, `📦 <b>PACKAGE ACTIVATION REQUEST</b>\n\n${table("REQUEST", [["User", user.username ? `@${user.username}` : userId], ["Package", pkg.name], ["Status", "AWAITING OWNER"]])}`, inline([[callback("✅ Activate", `activate:${userId}:${pkg.id}`), callback("❌ Reject", `activation:reject:${userId}`)]]));
    return send(env, userId, `⏳ Package <b>${html(pkg.name)}</b> activation is pending.`, mainMenu);
  }
  if (scope === "activate" && user.role === "owner") {
    const target = action;
    await activateUser(env, target, Number(value), userId);
    return send(env, userId, `✅ Package activated for ${html(target)}.`, ownerMenu);
  }
  if (scope === "packages" && action === "view") return showPackages(env, userId);
  if (scope === "vps" && action === "create") return createSandbox(env, user);
  if (scope === "vps" && action === "status") return status(env, user, value);
  if (scope === "deploy" && action === "help") return send(env, userId, "📦 Send a ZIP document to this chat. The bot will upload it to your latest active VPS workspace.", mainMenu);
  if (scope === "terminal" && action === "open") return send(env, userId, "⌨️ Terminal gateway is being finalized. Use the VPS workspace upload and logs while the secure WebSocket session is enabled.", mainMenu);
  if (scope === "usage" && action === "me") return usage(env, user);
  if (scope === "key" && action === "help") return send(env, userId, "🔑 Send your HopX API key as a private message beginning with `hopx_live_`. It will be deleted after processing and never shown back.", mainMenu);
  return send(env, userId, "Use the menu to continue.", user.role === "owner" ? ownerMenu : mainMenu);
}

async function usage(env, user) {
  const pkg = await getUserPackage(env, user.telegram_id);
  const active = await first(env, `SELECT COUNT(*) AS n FROM sandboxes WHERE owner_telegram_id=? AND status IN ('creating','running')`, user.telegram_id);
  return send(env, user.telegram_id, `📊 <b>YOUR USAGE</b>\n\n${table("USAGE", [["Package", pkg?.name || "none"], ["Active VPS", `${active?.n || 0} / ${pkg?.max_active_sandboxes || 0}`], ["Files/project", pkg?.max_files_per_project || 0], ["Max upload", `${Math.round((pkg?.max_upload_bytes || 0) / 1024 / 1024)} MB`], ["CPU", pkg?.cpu_policy || "provider"]])}`, mainMenu);
}

async function handleMessage(env, message) {
  const user = await upsertUser(env, message.from || { id: message.chat.id });
  const chatId = String(message.chat.id);
  const text = String(message.text || "").trim();
  if (message.document) return handleDocument(env, user, message.document, message.message_id);
  if (text.startsWith("hopx_live_")) {
    if (user.status !== "active") return send(env, chatId, "Your account must be active before connecting a HopX key.", mainMenu);
    try { return await connectKey(env, user, text, message.message_id); } catch (error) { return send(env, chatId, `❌ Key validation failed: ${html(error.message)}`, mainMenu); }
  }
  if (text === "/start" || text === "/menu") {
    if (user.role === "owner") return send(env, chatId, ownerDashboard(), ownerMenu);
    if (user.status === "pending") return requestAccess(env, user);
    if (user.status === "accepted") return showPackages(env, chatId);
    if (user.status !== "active") return send(env, chatId, "Your account is not active. Please contact the Owner.", mainMenu);
    return send(env, chatId, dashboard(user, await getUserPackage(env, user.telegram_id)), mainMenu);
  }
  if (user.role !== "owner" && user.status === "pending") return requestAccess(env, user);
  if (text === "📦 Packages") return showPackages(env, chatId);
  if (text === "🚀 Create VPS") return createSandbox(env, user);
  if (text === "🖥 My VPS") return userVps(env, user);
  if (text === "📊 Usage") return usage(env, user);
  if (text === "🔑 HopX Key") return send(env, chatId, "🔑 Send your HopX key as a private message beginning with `hopx_live_`.", mainMenu);
  if (text === "📦 Deploy Project") return send(env, chatId, "📦 Send a ZIP document to upload it to your latest VPS.", mainMenu);
  if (text === "⌨️ Terminal") return send(env, chatId, "⌨️ Select your VPS first, then open its secure terminal session.", mainMenu);
  if (user.role === "owner" && text === "👥 Users") {
    const result = await all(env, `SELECT telegram_id, username, status, active FROM users ORDER BY created_at DESC LIMIT 20`);
    return send(env, chatId, `👥 <b>USERS</b>\n\n<pre>${html((result.results || []).map((x) => `${x.telegram_id}  ${x.status}  @${x.username || "-"}`).join("\n") || "No users")}</pre>`, ownerMenu);
  }
  if (user.role === "owner" && text === "📦 Packages") return showPackages(env, chatId);
  if (user.role === "owner" && text === "🖥 All VPS") {
    const result = await all(env, `SELECT sandbox_id, owner_telegram_id, status, service_url FROM sandboxes ORDER BY created_at DESC LIMIT 20`);
    return send(env, chatId, `🖥 <b>ALL VPS</b>\n\n<pre>${html((result.results || []).map((x) => `${x.sandbox_id}  ${x.owner_telegram_id}  ${x.status}`).join("\n") || "No VPS")}</pre>`, ownerMenu);
  }
  return send(env, chatId, "Use the menu to continue.", user.role === "owner" ? ownerMenu : mainMenu);
}

async function fetchHandler(request, env) {
  const url = new URL(request.url);
  if (url.pathname === "/health") return new Response(JSON.stringify({ ok: true, service: "akashvps-admin-bot", timestamp: now() }), { headers: { "content-type": "application/json" } });
  if (request.method !== "POST" || url.pathname !== "/webhook") return new Response("Not found", { status: 404 });
  if (env.WEBHOOK_SECRET && request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.WEBHOOK_SECRET) return new Response("Forbidden", { status: 403 });
  const update = await request.json();
  try {
    if (update.callback_query) await handleCallback(env, update.callback_query);
    else if (update.message) await handleMessage(env, update.message);
  } catch (error) {
    console.error("update_failed", error?.message || error);
    const chatId = update.message?.chat?.id || update.callback_query?.message?.chat?.id;
    if (chatId) await send(env, chatId, "⚠️ Temporary bot error. Your data was not deleted. Please retry.", mainMenu);
  }
  return new Response("ok");
}

export default { fetch: fetchHandler };
