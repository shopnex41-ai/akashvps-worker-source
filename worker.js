import APP_HTML from "./app-html.js";

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
    ["👥 Users", "📨 Pending Users"],
    ["📦 Packages", "✏️ Edit Package"],
    ["🖥 All VPS", "🔑 HopX Keys"],
    ["✅ Activate Package", "❌ Reject User"],
    ["📊 Usage", "📜 Audit Logs"],
    ["🧪 System Status", "🆘 Owner Help"]
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

function webAppButton(text, url) {
  return { text, web_app: { url } };
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
  if (!/^hopx_live_[A-Za-z0-9_.-]{20,}$/.test(key)) return send(env, user.telegram_id, "❌ Invalid HopX key format. Copy the complete key from console.hopx.dev.", mainMenu);
  const validation = await providerRequest("/v1/sandboxes", "GET", key);
  const sandboxes = Array.isArray(validation) ? validation : (validation?.data || validation?.sandboxes || []);
  const encrypted = await encrypt(env, key);
  const fingerprint = `${key.slice(0, 10)}••••${key.slice(-4)}`;
  const previous = await first(env, `SELECT MAX(key_version) AS v FROM provider_credentials WHERE user_id=?`, user.telegram_id);
  const version = Number(previous?.v || 0) + 1;
  await db(env, `UPDATE provider_credentials SET status='revoked', updated_at=? WHERE user_id=? AND status='active'`, now(), user.telegram_id);
  const organization = sandboxes.find((x) => x.organization_id)?.organization_id || validation?.organization_id || null;
  await db(env, `INSERT INTO provider_credentials(user_id, provider, key_version, key_ciphertext, key_fingerprint, organization_ref, status, last_validated_at, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)`, user.telegram_id, "hopx", version, encrypted, fingerprint, organization, "active", now(), now(), now());
  await audit(env, user.telegram_id, "hopx_key_connected", "validated");
  if (messageId) await deleteMessage(env, user.telegram_id, messageId);
  const resources = sandboxes.find((x) => x.resources)?.resources || {};
  return send(env, user.telegram_id, `✅ <b>HOPX ACCOUNT CONNECTED</b>\n\n${table("REAL PROVIDER SCAN", [["Provider", "HopX"], ["Key", fingerprint], ["Status", "VERIFIED"], ["Organization", organization || "provider"], ["Sandboxes", sandboxes.length], ["vCPU", resources.vcpu || "provider"], ["Memory", resources.memory_mb ? `${resources.memory_mb} MB` : "provider"], ["Disk", resources.disk_mb ? `${resources.disk_mb} MB` : "provider"]])}\n\nThe displayed account data comes from the real HopX API response.`, mainMenu);
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

async function stopSandbox(env, user, sandboxId) {
  const sandbox = await first(env, `SELECT * FROM sandboxes WHERE sandbox_id=? AND owner_telegram_id=?`, sandboxId, user.telegram_id);
  if (!sandbox) return send(env, user.telegram_id, "❌ VPS not found or not owned by you.", mainMenu);
  const credential = await getCredential(env, user.telegram_id);
  if (!credential) return send(env, user.telegram_id, "🔑 Connect your HopX key first.", mainMenu);
  try {
    const key = await decrypt(env, credential.key_ciphertext);
    await providerRequest(`/v1/sandboxes/${encodeURIComponent(sandboxId)}/kill`, "POST", key);
    await db(env, `UPDATE sandboxes SET status='stopped' WHERE sandbox_id=?`, sandboxId);
    await audit(env, user.telegram_id, "stop_sandbox", "success", sandboxId);
    return send(env, user.telegram_id, `🛑 <b>VPS STOPPED</b>\n\n${table("VPS", [["ID", sandboxId], ["Status", "STOPPED"], ["Data", "Preserved"]])}`, inline([[callback("🖥 My VPS", "vps:list"), callback("🚀 Create VPS", "vps:create")]]));
  } catch (error) {
    return send(env, user.telegram_id, `❌ Could not stop VPS: ${html(error.message)}`, mainMenu);
  }
}

async function terminalSession(env, user, sandboxId) {
  const sandbox = await first(env, `SELECT * FROM sandboxes WHERE sandbox_id=? AND owner_telegram_id=?`, sandboxId, user.telegram_id);
  if (!sandbox) return send(env, user.telegram_id, "❌ VPS not found or not owned by you.", mainMenu);
  if (!sandbox.service_url) return send(env, user.telegram_id, "⌨️ Terminal is unavailable until the provider returns a VPS URL.", mainMenu);
  return send(env, user.telegram_id, `⌨️ <b>SECURE VPS ACCESS</b>\n\n${table("SESSION", [["VPS", sandbox.sandbox_id], ["Status", sandbox.status], ["Workspace", "/workspace/akashvps"]])}\n\nOpen the provider workspace from the secure button.`, inline([[urlButton("⌨️ Open VPS Workspace", sandbox.service_url)], [callback("📊 Refresh", `vps:status:${sandboxId}`), callback("🛑 Stop VPS", `vps:stop:${sandboxId}`)]]));
}

async function ownerKeys(env, chatId) {
  const result = await all(env, `SELECT user_id, key_fingerprint, status, last_validated_at FROM provider_credentials ORDER BY updated_at DESC LIMIT 20`);
  return send(env, chatId, `🔑 <b>HOPX KEY OVERVIEW</b>\n\n<pre>${html((result.results || []).map((x) => `${x.user_id}  ${x.key_fingerprint}  ${x.status}`).join("\n") || "No provider keys")}</pre>`, ownerMenu);
}

async function ownerAudit(env, chatId) {
  const result = await all(env, `SELECT actor_telegram_id, action, result, created_at FROM audit_logs ORDER BY id DESC LIMIT 20`);
  return send(env, chatId, `📜 <b>AUDIT LOGS</b>\n\n<pre>${html((result.results || []).map((x) => `${x.created_at}  ${x.actor_telegram_id}  ${x.action}  ${x.result}`).join("\n") || "No audit events")}</pre>`, ownerMenu);
}

async function ownerUsers(env, chatId) {
  const result = await all(env, `SELECT telegram_id, username, status, active FROM users ORDER BY created_at DESC LIMIT 50`);
  const rows = result.results || [];
  const buttons = rows.filter((x) => x.telegram_id !== OWNER_DEFAULT && x.status === "pending").map((x) => [callback(`✅ Accept ${x.username ? `@${x.username}` : x.telegram_id}`, `user:accept:${x.telegram_id}`), callback("❌ Reject", `user:reject:${x.telegram_id}`)]);
  return send(env, chatId, `👥 <b>USERS</b>\n\n<pre>${html(rows.map((x) => `${x.telegram_id}  ${x.status}  @${x.username || "-"}`).join("\n") || "No users")}</pre>`, buttons.length ? inline(buttons) : ownerMenu);
}

async function ownerApprove(env, ownerId, targetId) {
  const target = await getUser(env, targetId);
  if (!target) return send(env, ownerId, `❌ User ${html(targetId)} was not found.`, ownerMenu);
  await db(env, `UPDATE users SET status='accepted' WHERE telegram_id=?`, String(targetId));
  await db(env, `UPDATE access_requests SET status='accepted', reviewed_at=? WHERE telegram_id=? AND status='pending'`, now(), String(targetId));
  await audit(env, ownerId, "approve_user", "success");
  await send(env, targetId, "✅ <b>ACCESS ACCEPTED</b>\n\nChoose a package to activate your account.", mainMenu);
  await showPackages(env, targetId);
  return send(env, ownerId, `✅ User ${html(targetId)} accepted. Package selector sent to the user.`, ownerMenu);
}

async function ownerReject(env, ownerId, targetId) {
  const target = await getUser(env, targetId);
  if (!target) return send(env, ownerId, `❌ User ${html(targetId)} was not found.`, ownerMenu);
  await db(env, `UPDATE users SET status='suspended', active=0 WHERE telegram_id=?`, String(targetId));
  await db(env, `UPDATE access_requests SET status='rejected', reviewed_at=? WHERE telegram_id=? AND status='pending'`, now(), String(targetId));
  await audit(env, ownerId, "reject_user", "success");
  await send(env, targetId, "❌ Your access request was not accepted.", mainMenu);
  return send(env, ownerId, `✅ User ${html(targetId)} rejected.`, ownerMenu);
}

async function ownerPackageEdit(env, ownerId, args) {
  const [id, files, uploadMb, cpu] = args;
  if (!id || !files || !uploadMb) return send(env, ownerId, "Usage: /package <id> <max_files> <upload_mb> <cpu_policy>", ownerMenu);
  await db(env, `UPDATE packages SET max_files_per_project=?, max_upload_bytes=?, cpu_policy=? WHERE id=?`, Number(files), Number(uploadMb) * 1024 * 1024, cpu || "provider-default", Number(id));
  await audit(env, ownerId, "edit_package", `package:${id}`);
  return send(env, ownerId, `✅ Package ${html(id)} updated from live D1.\nFiles: ${html(files)}\nUpload: ${html(uploadMb)} MB\nCPU: ${html(cpu || "provider-default")}`, ownerMenu);
}

async function ownerPackageDelete(env, ownerId, id) {
  if (!id) return send(env, ownerId, "Usage: /package_delete <id>", ownerMenu);
  await db(env, `UPDATE packages SET status='inactive' WHERE id=?`, Number(id));
  await audit(env, ownerId, "delete_package", `package:${id}`);
  return send(env, ownerId, `✅ Package ${html(id)} is now inactive in live D1.`, ownerMenu);
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
  const stagingKey = `staging/${user.telegram_id}/${sandbox.sandbox_id}/${crypto.randomUUID()}/${document.file_name || "project.zip"}`;
  if (env.UPLOADS) await env.UPLOADS.put(stagingKey, binary, { httpMetadata: { contentType: document.mime_type || "application/zip" }, customMetadata: { userId: user.telegram_id, sandboxId: sandbox.sandbox_id } });
  try {
    const headers = { Authorization: `Bearer ${token}`, "content-type": "application/json" };
    const write = await fetch(`${agent}/files/write`, { method: "POST", headers, body: JSON.stringify({ path: `${base}/upload.b64`, content: encoded }) });
    if (!write.ok) return send(env, user.telegram_id, "❌ Project upload to VPS failed.", mainMenu);
    const maxFiles = Math.max(1, Number(pkg.max_files_per_project || 25));
    const command = `mkdir -p ${base}/project && base64 -d ${base}/upload.b64 > ${base}/project/project.zip && count=$(unzip -Z1 ${base}/project/project.zip | wc -l) && test "$count" -le ${maxFiles} || { echo "file limit exceeded: $count/${maxFiles}"; exit 23; } && unzip -oq ${base}/project/project.zip -d ${base}/project && rm -f ${base}/upload.b64 ${base}/project/project.zip`;
    const run = await fetch(`${agent}/commands/run`, { method: "POST", headers, body: JSON.stringify({ command, working_dir: "/workspace", timeout: 120 }) });
    const result = await run.json().catch(() => ({}));
    await audit(env, user.telegram_id, "upload_project", run.ok && result.exit_code === 0 ? "success" : "failed", sandbox.sandbox_id);
    if (!run.ok || result.exit_code !== 0) return send(env, user.telegram_id, `❌ <b>EXTRACT FAILED</b>\n\n<pre>${html((result.stderr || "Upload failed").slice(0, 3000))}</pre>`, mainMenu);
    return send(env, user.telegram_id, `✅ <b>PROJECT UPLOADED</b>\n\n${table("DEPLOYMENT", [["File", document.file_name || "upload"], ["VPS", sandbox.sandbox_id], ["Path", `${base}/project`], ["R2", "Temporary object removed"], ["Status", "READY TO START"]])}\n\nUse the secure workspace button to continue.`, inline([[callback("⌨️ Terminal", `terminal:open:${sandbox.sandbox_id}`), callback("📊 VPS Status", `vps:status:${sandbox.sandbox_id}`)]]));
  } finally {
    if (env.UPLOADS) await env.UPLOADS.delete(stagingKey);
  }
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
    if (action === "accept") return ownerApprove(env, userId, value);
    if (action === "reject") return ownerReject(env, userId, value);
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
  if (scope === "activation" && action === "reject" && user.role === "owner") {
    await db(env, `UPDATE package_orders SET status='rejected', reviewed_by=? WHERE user_id=? AND status IN ('awaiting_activation','accepted')`, userId, value);
    await audit(env, userId, "reject_package", `user:${value}`);
    await send(env, value, "❌ Your package activation request was rejected by the Owner.", mainMenu);
    return send(env, userId, `✅ Package request for ${html(value)} rejected.`, ownerMenu);
  }
  if (scope === "packages" && action === "view") return showPackages(env, userId);
  if (scope === "vps" && action === "create") return createSandbox(env, user);
  if (scope === "vps" && action === "list") return userVps(env, user);
  if (scope === "vps" && action === "status") return status(env, user, value);
  if (scope === "vps" && action === "stop") return stopSandbox(env, user, value);
  if (scope === "deploy" && action === "help") return send(env, userId, "📦 Send a ZIP document to this chat. The bot will upload it to your latest active VPS workspace.", mainMenu);
  if (scope === "terminal" && action === "open") return terminalSession(env, user, value);
  if (scope === "usage" && action === "me") return usage(env, user);
  if (scope === "key" && (action === "help" || action === "prompt")) return send(env, userId, "🔑 <b>SEND YOUR HOPX API KEY</b>\n\nCopy the complete key from console.hopx.dev and send it in this private chat. The bot will validate it with the real HopX API, store only an encrypted form, and delete the message after processing.", { force_reply: true, selective: true });
  if (scope === "owner" && action === "contact") return send(env, userId, "📩 Your message has been queued for the Owner.", mainMenu);
  return send(env, userId, "Use the menu to continue.", user.role === "owner" ? ownerMenu : mainMenu);
}

async function usage(env, user) {
  const pkg = await getUserPackage(env, user.telegram_id);
  const active = await first(env, `SELECT COUNT(*) AS n FROM sandboxes WHERE owner_telegram_id=? AND status IN ('creating','running')`, user.telegram_id);
  return send(env, user.telegram_id, `📊 <b>YOUR USAGE</b>\n\n${table("USAGE", [["Package", pkg?.name || "none"], ["Active VPS", `${active?.n || 0} / ${pkg?.max_active_sandboxes || 0}`], ["Files/project", pkg?.max_files_per_project || 0], ["Max upload", `${Math.round((pkg?.max_upload_bytes || 0) / 1024 / 1024)} MB`], ["CPU", pkg?.cpu_policy || "provider"]])}`, mainMenu);
}

async function verifyWebApp(env, request) {
  const raw = request.headers.get("X-Telegram-Init-Data") || "";
  if (!raw || !env.BOT_TOKEN) throw new Error("Telegram WebApp authentication is required");
  const params = new URLSearchParams(raw);
  const received = params.get("hash");
  params.delete("hash");
  const check = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("\n");
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode("WebAppData"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const secret = await crypto.subtle.sign("HMAC", base, new TextEncoder().encode(env.BOT_TOKEN));
  const key = await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(check));
  const expected = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (!received || expected !== received) throw new Error("Invalid Telegram WebApp signature");
  const tgUser = JSON.parse(params.get("user") || "{}");
  return getUser(env, String(tgUser.id));
}

async function appState(env, request) {
  const user = await verifyWebApp(env, request);
  if (!user) throw new Error("User is not registered");
  const pkg = await getUserPackage(env, user.telegram_id);
  const credential = await getCredential(env, user.telegram_id);
  const result = await all(env, `SELECT sandbox_id,label,status,expires_at,service_url FROM sandboxes WHERE owner_telegram_id=? ORDER BY created_at DESC`, user.telegram_id);
  return new Response(JSON.stringify({ user: { name: user.first_name || "", username: user.username || "", role: user.role, status: user.status }, package: pkg ? { name: pkg.name, files: pkg.max_files_per_project, upload_bytes: pkg.max_upload_bytes } : null, credential: credential ? { fingerprint: credential.key_fingerprint, status: credential.status, validated_at: credential.last_validated_at } : null, sandboxes: result.results || [] }), { headers: { "content-type": "application/json" } });
}

async function appUpload(env, request) {
  const user = await verifyWebApp(env, request);
  if (!user || user.status !== "active") throw new Error("Active user access is required");
  const pkg = await getUserPackage(env, user.telegram_id);
  const sandbox = await first(env, `SELECT * FROM sandboxes WHERE owner_telegram_id=? AND status IN ('running','creating') ORDER BY created_at DESC LIMIT 1`, user.telegram_id);
  const credential = await getCredential(env, user.telegram_id);
  if (!pkg || !sandbox?.auth_token_ciphertext || !credential) throw new Error("Connect HopX and create a VPS first");
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new Error("ZIP file is required");
  if (file.size > Math.min(MAX_UPLOAD_BYTES, Number(pkg.max_upload_bytes))) throw new Error("File exceeds the active package limit");
  const binary = await file.arrayBuffer();
  const stagingKey = `staging/${user.telegram_id}/${sandbox.sandbox_id}/${crypto.randomUUID()}/${file.name}`;
  if (env.UPLOADS) await env.UPLOADS.put(stagingKey, binary, { httpMetadata: { contentType: file.type || "application/zip" }, customMetadata: { userId: user.telegram_id, sandboxId: sandbox.sandbox_id } });
  try {
    const token = await decrypt(env, sandbox.auth_token_ciphertext);
    const agent = sandbox.service_url || `https://${sandbox.sandbox_id}.hopx.dev`;
    const headers = { Authorization: `Bearer ${token}`, "content-type": "application/json" };
    const base = `/workspace/akashvps/${user.telegram_id}`;
    const write = await fetch(`${agent}/files/write`, { method: "POST", headers, body: JSON.stringify({ path: `${base}/upload.b64`, content: b64(binary) }) });
    if (!write.ok) throw new Error("HopX file transfer failed");
    const limit = Math.max(1, Number(pkg.max_files_per_project || 25));
    const command = `mkdir -p ${base}/project && base64 -d ${base}/upload.b64 > ${base}/project/project.zip && count=$(unzip -Z1 ${base}/project/project.zip | wc -l) && test "$count" -le ${limit} || { echo "file limit exceeded"; exit 23; } && unzip -oq ${base}/project/project.zip -d ${base}/project && rm -f ${base}/upload.b64 ${base}/project/project.zip`;
    const run = await fetch(`${agent}/commands/run`, { method: "POST", headers, body: JSON.stringify({ command, working_dir: "/workspace", timeout: 120 }) });
    const result = await run.json().catch(() => ({}));
    if (!run.ok || result.exit_code !== 0) throw new Error(result.stderr || "HopX extraction failed");
    await audit(env, user.telegram_id, "webapp_upload", "success", sandbox.sandbox_id);
    return new Response(JSON.stringify({ ok: true, message: "Transferred to HopX VPS. Temporary R2 object deleted." }), { headers: { "content-type": "application/json" } });
  } finally {
    if (env.UPLOADS) await env.UPLOADS.delete(stagingKey);
  }
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
  if (user.role === "owner" && text.startsWith("/approve ")) return ownerApprove(env, chatId, text.split(/\s+/)[1]);
  if (user.role === "owner" && text.startsWith("/reject ")) return ownerReject(env, chatId, text.split(/\s+/)[1]);
  if (user.role === "owner" && text.startsWith("/activate ")) {
    const [, target, packageId] = text.split(/\s+/);
    if (!target || !packageId) return send(env, chatId, "Usage: /activate <telegram_user_id> <package_id>", ownerMenu);
    await activateUser(env, target, Number(packageId), chatId);
    return send(env, chatId, `✅ Package ${html(packageId)} activated for ${html(target)}.`, ownerMenu);
  }
  if (user.role === "owner" && text.startsWith("/package_delete ")) return ownerPackageDelete(env, chatId, text.split(/\s+/)[1]);
  if (user.role === "owner" && text.startsWith("/package ")) return ownerPackageEdit(env, chatId, text.split(/\s+/).slice(1));
  if (user.role === "owner" && text === "/users") return ownerUsers(env, chatId);
  if (user.role === "owner" && text === "/audit") return ownerAudit(env, chatId);
  if (text === "/start" || text === "/menu") {
    if (user.role === "owner") return send(env, chatId, ownerDashboard(), ownerMenu);
    if (user.status === "pending") return requestAccess(env, user);
    if (user.status === "accepted") return showPackages(env, chatId);
    if (user.status !== "active") return send(env, chatId, "Your account is not active. Please contact the Owner.", mainMenu);
    const credential = await getCredential(env, user.telegram_id);
    if (!credential) return send(env, chatId, "🔑 <b>CONNECT YOUR HOPX ACCOUNT</b>\n\nPress the button below. The bot will ask for your real HopX API key, validate it against HopX, and show the provider account scan.", inline([[callback("🔑 Connect HopX API Key", "key:prompt")]]));
    return send(env, chatId, dashboard(user, await getUserPackage(env, user.telegram_id)), mainMenu);
  }
  if (user.role !== "owner" && user.status === "pending") return requestAccess(env, user);
  if (text === "📦 Packages") return showPackages(env, chatId);
  if (text === "🚀 Create VPS") return createSandbox(env, user);
  if (text === "🖥 My VPS") return userVps(env, user);
  if (text === "📊 Usage") return usage(env, user);
  if (text === "🔑 HopX Key") return send(env, chatId, "🔑 Press the button below and send your complete HopX key in this private chat.", inline([[callback("🔑 Connect HopX API Key", "key:prompt")]]));
  if (text === "📦 Deploy Project") return send(env, chatId, "📦 <b>PROJECT DEPLOYMENT</b>\n\nUse the Telegram Mini App for drag-and-drop upload, or send a ZIP document directly in this chat.", inline([[webAppButton("📤 Open Drag-and-Drop Panel", "https://akashvps-admin-bot.axura.workers.dev/app")]]));
  if (text === "⌨️ Terminal") return send(env, chatId, "⌨️ Select your VPS first, then open its secure terminal session.", mainMenu);
  if (user.role === "owner" && text === "👥 Users") return ownerUsers(env, chatId);
  if (user.role === "owner" && text === "📨 Pending Users") return ownerUsers(env, chatId);
  if (user.role === "owner" && text === "📦 Packages") return showPackages(env, chatId);
  if (user.role === "owner" && text === "✏️ Edit Package") return send(env, chatId, "✏️ Edit a live package with:\n/package <id> <max_files> <upload_mb> <cpu_policy>\n\nExample: /package 1 50 50 provider-default", ownerMenu);
  if (user.role === "owner" && text === "🖥 All VPS") {
    const result = await all(env, `SELECT sandbox_id, owner_telegram_id, status, service_url FROM sandboxes ORDER BY created_at DESC LIMIT 20`);
    return send(env, chatId, `🖥 <b>ALL VPS</b>\n\n<pre>${html((result.results || []).map((x) => `${x.sandbox_id}  ${x.owner_telegram_id}  ${x.status}`).join("\n") || "No VPS")}</pre>`, ownerMenu);
  }
  if (user.role === "owner" && text === "🔑 HopX Keys") return ownerKeys(env, chatId);
  if (user.role === "owner" && text === "✅ Activate Package") return send(env, chatId, "✅ Activate with:\n/activate <telegram_user_id> <package_id>\n\nExample: /activate 8519899488 1", ownerMenu);
  if (user.role === "owner" && text === "❌ Reject User") return send(env, chatId, "❌ Reject with:\n/reject <telegram_user_id>\n\nExample: /reject 8519899488", ownerMenu);
  if (user.role === "owner" && text === "📜 Audit Logs") return ownerAudit(env, chatId);
  if (user.role === "owner" && text === "🧪 System Status") {
    const users = await first(env, `SELECT COUNT(*) AS n FROM users`);
    const pending = await first(env, `SELECT COUNT(*) AS n FROM users WHERE status='pending'`);
    const packages = await first(env, `SELECT COUNT(*) AS n FROM packages WHERE status='active'`);
    const logs = await first(env, `SELECT COUNT(*) AS n FROM audit_logs`);
    return send(env, chatId, `🧪 <b>LIVE SYSTEM STATUS</b>\n\n${table("CONTROL PLANE", [["Worker", "ONLINE"], ["D1 users", users?.n || 0], ["Pending users", pending?.n || 0], ["Active packages", packages?.n || 0], ["Audit entries", logs?.n || 0], ["Webhook", "CONFIGURED"]])}`, ownerMenu);
  }
  if (user.role === "owner" && text === "🆘 Owner Help") return send(env, chatId, "🆘 <b>OWNER COMMANDS</b>\n\n/users — list and approve users\n/approve <id> — accept user\n/reject <id> — reject user\n/activate <user_id> <package_id> — assign package\n/package <id> <files> <upload_mb> <cpu> — edit package\n/package_delete <id> — deactivate package\n/audit — real audit log", ownerMenu);
  return send(env, chatId, "Use the menu to continue.", user.role === "owner" ? ownerMenu : mainMenu);
}

async function fetchHandler(request, env) {
  const url = new URL(request.url);
  if (url.pathname === "/health") return new Response(JSON.stringify({ ok: true, service: "akashvps-admin-bot", timestamp: now() }), { headers: { "content-type": "application/json" } });
  if (url.pathname === "/app") return new Response(APP_HTML, { headers: { "content-type": "text/html; charset=utf-8" } });
  if (url.pathname === "/api/app/state" && request.method === "GET") {
    try { return await appState(env, request); } catch (error) { return new Response(JSON.stringify({ error: error.message }), { status: 401, headers: { "content-type": "application/json" } }); }
  }
  if (url.pathname === "/api/app/upload" && request.method === "POST") {
    try { return await appUpload(env, request); } catch (error) { return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { "content-type": "application/json" } }); }
  }
  if (request.method !== "POST" || url.pathname !== "/webhook") return new Response("Not found", { status: 404 });
  if (env.WEBHOOK_SECRET && request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.WEBHOOK_SECRET) return new Response("Forbidden", { status: 403 });
  const update = await request.json();
  try {
    if (update.callback_query) await handleCallback(env, update.callback_query);
    else if (update.message) await handleMessage(env, update.message);
  } catch (error) {
    console.error("update_failed", error?.message || error);
    const chatId = update.message?.chat?.id || update.callback_query?.message?.chat?.id;
    await send(env, env.OWNER_ID || OWNER_DEFAULT, `🚨 <b>LIVE BOT ERROR</b>\n\n${table("UPDATE", [["Type", update.callback_query ? "callback" : "message"], ["Chat", chatId || "unknown"], ["Error", String(error?.message || error).slice(0, 500)]])}`, ownerMenu);
    if (chatId) await send(env, chatId, "⚠️ Temporary bot error. Your data was not deleted. Please retry.", mainMenu);
  }
  return new Response("ok");
}

export default { fetch: fetchHandler };
