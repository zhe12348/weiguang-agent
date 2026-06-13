# 微光 Railway 部署文档

## 1. 部署架构

```text
用户浏览器
  -> Railway 公网域名
  -> Node.js server.js
    -> GET / 返回 index.html
    -> GET /health 返回健康状态
    -> POST /api/chat 调用 DeepSeek API
```

DeepSeek API Key 只保存在 Railway Variables 中，不会发送给前端。

## 2. Railway 兼容性

当前项目已经满足 Railway 部署要求：

- `server.js` 使用 `process.env.PORT || 3000`。
- 服务默认监听 `0.0.0.0`。
- `package.json` 包含 `start` 脚本：`node server.js`。
- Node.js 版本要求为 `>=18`。
- `railway.toml` 指定 Railpack、启动命令和健康检查。
- `/health` 成功时返回 `{"status":"ok"}`。

## 3. 环境变量

必须在 Railway 中设置：

```text
DEEPSEEK_API_KEY=你的 DeepSeek API Key
```

不需要手动设置：

```text
PORT
```

Railway 会自动注入 `PORT`。

通常也不需要设置 `HOST`，因为代码默认监听：

```text
0.0.0.0
```

## 4. 上传 GitHub 前检查

确认 `.gitignore` 包含：

```text
.env
env.txt
node_modules/
.DS_Store
```

不要将 `.env` 或任何真实 API Key 上传到 GitHub。

可以在提交前执行：

```bash
git status
git check-ignore .env
```

## 5. 从 GitHub 部署

1. 将项目推送到 GitHub。
2. 打开 [Railway](https://railway.com) 并登录。
3. 点击 `New Project`。
4. 选择 `Deploy from GitHub repo`。
5. 授权 Railway 访问 GitHub。
6. 选择微光项目仓库。
7. Railway 会读取 `package.json` 和 `railway.toml` 并开始构建。
8. 打开项目中的微光服务。
9. 点击 `Variables`。
10. 点击 `New Variable`。
11. 添加：

```text
DEEPSEEK_API_KEY=你的 DeepSeek API Key
```

12. 保存变量并等待 Railway 自动重新部署。

## 6. 生成公网域名

1. 打开微光服务。
2. 点击 `Settings`。
3. 找到 `Networking`。
4. 找到 `Public Networking`。
5. 点击 `Generate Domain`。
6. Railway 会生成一个 `.railway.app` 域名。

## 7. 部署后测试

健康检查：

```bash
curl https://你的域名.railway.app/health
```

预期返回：

```json
{"status":"ok"}
```

聊天接口：

```bash
curl -i -X POST https://你的域名.railway.app/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"我今天有点焦虑"}]}'
```

成功时返回：

```json
{"reply":"...AI 回复内容..."}
```

也可以直接打开 Railway 域名，在网页中提交一段情绪文字测试。

## 8. 常见问题

### 部署日志显示没有启动命令

确认仓库根目录存在 `package.json`，并包含：

```json
"scripts": {
  "start": "node server.js"
}
```

### 服务无法响应

确认日志显示服务监听在 `0.0.0.0`，并使用 Railway 自动注入的端口。

### `/api/chat` 提示缺少 Key

进入服务的 `Variables` 页面，添加 `DEEPSEEK_API_KEY`，然后重新部署。

### 页面可以打开但聊天失败

检查 Railway Deploy Logs，并确认 DeepSeek Key 有效、账户额度正常。
