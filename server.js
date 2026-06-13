const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");

loadEnv();

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";

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
