const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");

loadEnv();

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SYSTEM_PROMPT = `你是一个普通、有点幽默感的大学生朋友，专门安慰情绪。

回复要求：
1. 每次字数尽量长（200-400字），像真人聊天，不敷衍。
2. 口语化，加入语气词：“啊这”、“诶”、“emm…”、“小声说”等。
3. 分段回复，可加入动作描写
4. 使用具体生活比喻和细节，增强画面感。
5. 可以自嘲、幽默，但必须共情用户情绪。
6. 不要直接否定或说教用户情绪。

回复结构：
- 第一段：接住情绪（强共情）
- 第二段：生活化解释（让用户觉得“正常”）
- 第三段：轻引导（非常小的动作，不说教）
- 结尾：留一个可以继续聊的话头

在回复结尾，必须加一句轻引导，比如：
“我们可以先聊到这一步，如果你愿意，可以点一下下面那个反馈按钮，让我知道刚刚有没有帮到你一点点。”

如果用户表达自伤、自杀等风险，要温和建议联系现实支持资源。`;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, { status: "ok" });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/chat") {
      await handleChat(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/conversations") {
      await handleConversationSave(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/feedback") {
      await handleFeedbackSave(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/feedback-records") {
      await handleFeedbackRecordSave(req, res);
      return;
    }

    if (req.method === "GET") {
      await serveStatic(url.pathname, res);
      return;
    }

    sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: "服务器出错了，请稍后再试" });
  }
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`端口 ${PORT} 已被占用，请换一个 PORT 后重试。`);
    process.exit(1);
  }

  console.error("后端启动失败：", error.message);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`微光后端已启动：http://${HOST}:${PORT}`);
});

async function handleChat(req, res) {
  let body;
  try {
    body = await readJson(req);
  } catch (error) {
    sendJson(res, 400, { error: error.message || "请求 JSON 格式错误" });
    return;
  }

  const messages = normalizeMessages(body.messages);
  if (!messages.length) {
    sendJson(res, 400, { error: "messages 不能为空" });
    return;
  }

  if (!DEEPSEEK_API_KEY) {
    sendJson(res, 500, { error: "后端缺少 DEEPSEEK_API_KEY，请先配置 .env" });
    return;
  }

  const upstream = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      max_tokens: 400,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages]
    })
  });

  const data = await upstream.json();
  if (!upstream.ok) {
    sendJson(res, upstream.status, {
      error: data?.error?.message || data?.message || "DeepSeek 请求失败"
    });
    return;
  }

  sendJson(res, 200, {
    reply: data?.choices?.[0]?.message?.content || "emm…我刚刚有点卡壳了，你再和我说一次，我这次认真接住你。"
  });
}

async function handleConversationSave(req, res) {
  let body;
  try {
    body = await readJson(req);
  } catch (error) {
    sendJson(res, 400, { error: error.message || "请求 JSON 格式错误" });
    return;
  }

  const messages = normalizeMessages(body.messages);
  const conversationId = String(body.conversation_id || body.id || "");
  if (!conversationId || !body.user_id || !messages.length) {
    sendJson(res, 400, { error: "conversation_id、user_id 和 messages 不能为空" });
    return;
  }

  const now = new Date().toISOString();
  const payload = {
    user_id: String(body.user_id),
    conversation_id: conversationId,
    first_user_text: messages[0]?.content || "",
    messages,
    ended: !!body.ended,
    feedback: body.feedback || null,
    message_count: messages.length,
    updated_at: now
  };

  const result = await upsertSupabase("conversations", payload, "conversation_id");
  if (!result.ok) {
    sendJson(res, result.status, { error: result.error });
    return;
  }

  sendJson(res, 200, { ok: true });
}

async function handleFeedbackSave(req, res) {
  let body;
  try {
    body = await readJson(req);
  } catch (error) {
    sendJson(res, 400, { error: error.message || "请求 JSON 格式错误" });
    return;
  }

  if (!body.usage_count || !body.understood_score || !body.reuse_intent) {
    sendJson(res, 400, { error: "usage_count、understood_score 和 reuse_intent 不能为空" });
    return;
  }

  const payload = {
    user_id: body.user_id ? String(body.user_id) : "anonymous",
    submitted_at: body.submitted_at || new Date().toISOString(),
    usage_count: String(body.usage_count),
    understood_score: Number(body.understood_score),
    helpful_quote: body.helpful_quote ? String(body.helpful_quote) : null,
    awkward_quote: body.awkward_quote ? String(body.awkward_quote) : null,
    feature_request: body.feature_request ? String(body.feature_request) : null,
    reuse_intent: String(body.reuse_intent)
  };

  const result = await insertSupabase("mvp_feedback", payload);
  if (!result.ok) {
    sendJson(res, result.status, { error: result.error });
    return;
  }

  sendJson(res, 200, { ok: true });
}

async function handleFeedbackRecordSave(req, res) {
  let body;
  try {
    body = await readJson(req);
  } catch (error) {
    sendJson(res, 400, { error: error.message || "请求 JSON 格式错误" });
    return;
  }

  if (!body.user_id || !body.conversation_id || !body.feedback_type) {
    sendJson(res, 400, { error: "user_id、conversation_id 和 feedback_type 不能为空" });
    return;
  }

  const messages = normalizeMessages(body.messages);
  const payload = {
    user_id: String(body.user_id),
    conversation_id: String(body.conversation_id),
    feedback_type: String(body.feedback_type),
    first_user_text: body.first_user_text ? String(body.first_user_text) : messages[0]?.content || "",
    messages,
    message_count: Number(body.message_count || messages.length)
  };

  const result = await insertSupabase("feedback_records", payload);
  if (!result.ok) {
    sendJson(res, result.status, { error: result.error });
    return;
  }

  sendJson(res, 200, { ok: true });
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) return [];

  return messages
    .filter((item) => item && (item.role === "user" || item.role === "assistant"))
    .map((item) => ({
      role: item.role,
      content: String(item.content || "").slice(0, 1000)
    }))
    .filter((item) => item.content.trim());
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 64 * 1024) {
        reject(new Error("请求体过大"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

async function upsertSupabase(table, payload, onConflict) {
  const query = onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : "";
  return writeSupabase(table, payload, query, "resolution=merge-duplicates");
}

async function insertSupabase(table, payload) {
  return writeSupabase(table, payload, "", "return=minimal");
}

async function writeSupabase(table, payload, query, prefer) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return {
      ok: false,
      status: 503,
      error: "Supabase 环境变量未配置"
    };
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Prefer": prefer
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`Supabase 写入 ${table} 失败：`, text);
      return {
        ok: false,
        status: res.status,
        error: text || "Supabase 写入失败"
      };
    }

    return { ok: true, status: res.status };
  } catch (error) {
    console.error(`Supabase 写入 ${table} 异常：`, error.message || error);
    return {
      ok: false,
      status: 500,
      error: "Supabase 写入异常"
    };
  }
}

async function serveStatic(pathname, res) {
  const filePath = pathname === "/" ? "index.html" : pathname.slice(1);
  const fullPath = path.resolve(__dirname, filePath);

  if (!fullPath.startsWith(__dirname) || !fs.existsSync(fullPath)) {
    sendText(res, 404, "Not found");
    return;
  }

  const ext = path.extname(fullPath);
  const contentType = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8"
  }[ext] || "application/octet-stream";

  res.writeHead(200, { "Content-Type": contentType });
  fs.createReadStream(fullPath).pipe(res);
}

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function sendText(res, status, text) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

function loadEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
