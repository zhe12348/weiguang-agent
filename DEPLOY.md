# 微光 Render 部署文档

## 1. 当前部署架构

```text
用户浏览器
  -> Render Web Service
  -> server.js
    -> GET / 返回 index.html
    -> POST /api/chat 代理请求 DeepSeek API
```

前端不直接调用 DeepSeek。DeepSeek API Key 只配置在 Render 环境变量中。

## 2. Render 兼容性检查

当前项目已满足 Render Web Service 的基本要求：

- `server.js` 使用 `process.env.PORT || 3000` 读取端口。
- `server.js` 默认监听 `0.0.0.0`，Render 可以从外部访问服务。
- `package.json` 包含 `start` 脚本：`node server.js`。
- `package.json` 声明 Node 版本：`>=18`。
- 项目不需要安装第三方依赖。

## 3. 必需环境变量

在 Render 控制台配置：

```text
DEEPSEEK_API_KEY=你的 DeepSeek API Key
```

可选环境变量：

```text
HOST=0.0.0.0
```

Render 会自动注入 `PORT`，不要手动固定 `PORT=3000`。本地开发才需要使用 `.env` 里的 `PORT=3000`。

## 4. Render 创建服务步骤

### 方式 A：使用 Web Service 手动部署

1. 将项目上传到 GitHub。
2. 打开 Render 控制台：[https://dashboard.render.com](https://dashboard.render.com)
3. 点击 `New +`。
4. 选择 `Web Service`。
5. 连接你的 GitHub 仓库。
6. 选择微光项目仓库。
7. 配置服务：

```text
Runtime: Node
Build Command: npm install
Start Command: npm start
```

如果 Render 允许空安装，也可以保持 `npm install`。当前项目没有第三方依赖，所以安装过程会很快。

8. 在 `Environment Variables` 中添加：

```text
DEEPSEEK_API_KEY=你的 DeepSeek API Key
```

9. 点击 `Create Web Service`。
10. 等待部署完成。

### 方式 B：使用 Blueprint 部署

项目根目录已包含 `render.yaml`。

1. 将项目上传到 GitHub。
2. 打开 Render 控制台：[https://dashboard.render.com](https://dashboard.render.com)
3. 点击 `New +`。
4. 选择 `Blueprint`。
5. 连接并选择微光项目仓库。
6. Render 会读取 `render.yaml`。
7. 按提示填写环境变量：

```text
DEEPSEEK_API_KEY=你的 DeepSeek API Key
```

8. 点击部署。

## 5. 部署后测试

部署完成后，Render 会给出一个域名，例如：

```text
https://weiguang-agent.onrender.com
```

打开首页：

```text
https://你的-render域名
```

测试聊天接口：

```bash
curl -i -X POST https://你的-render域名/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"我今天有点焦虑"}]}'
```

成功时返回：

```json
{"reply":"...AI 回复内容..."}
```

## 6. 常见问题

### 部署成功但网页打不开

检查 Render 日志中是否有：

```text
微光后端已启动：http://0.0.0.0:xxxx
```

如果监听地址是 `127.0.0.1`，外部无法访问。当前代码默认已经改为 `0.0.0.0`。

### `/api/chat` 返回缺少 Key

说明 Render 没有配置环境变量：

```text
DEEPSEEK_API_KEY
```

进入 Render 服务的 `Environment` 页面添加后，重新部署。

### `/api/chat` 返回 DeepSeek 请求失败

检查：

- DeepSeek API Key 是否有效。
- DeepSeek 账户余额或额度是否正常。
- Render 服务是否能访问外网。

### 首页可以打开，但点击提交没有回复

打开浏览器开发者工具，查看 Network 里 `/api/chat` 的响应。常见原因是 Key 未配置或 DeepSeek 返回错误。

## 7. 安全注意事项

- 不要把 `.env` 上传到 GitHub。
- 不要把 DeepSeek API Key 写进 `index.html`。
- 不要在 README、Issue、聊天记录或截图中暴露真实 Key。
- 旧 Key 如果曾经暴露过，应在 DeepSeek 控制台删除并重新创建。
