# 微光 AI Agent

## 项目简介

本项目用于构建个人 AI Agent 系统。

Agent承担两项核心任务：

### 1. 推进微光项目

微光是一款基于 AI 的青年情绪调节与陪伴系统。

Agent负责：

* 阅读代码
* 修改代码
* 修复Bug
* 优化架构
* API迁移后端
* 协助部署上线
* 产品迭代建议

---


## 当前阶段

阶段：

MVP优化阶段

当前重点：

* DeepSeek API迁移后端
* 数据安全优化
* 用户体验优化

---

## 长期目标

1. 完成微光产品上线
2. 提升产品开发能力
3. 提升创业能力

---

维护者：

dongzhe

---

## 当前项目结构

```text
weiguang-agent/

AGENTS.md .txt
README.md
package.json
server.js
index.html
weiguang代码.txt
.env.example

用户调研
副本微光——基于AI的青年情绪调节与陪伴系统(1)(2).docx
```

## 当前架构

```text
浏览器 index.html
  ↓ POST /api/chat
Node 后端 server.js
  ↓ DeepSeek API
AI 回复
```

说明：

* 前端负责页面交互、多轮对话、本地历史记录、反馈记录、Supabase 同步。
* 后端负责读取环境变量中的 DeepSeek API Key，并代理调用 DeepSeek。
* DeepSeek API Key 不再放在前端代码里。

## 本地运行

1. 复制环境变量文件：

```bash
cp .env.example .env
```

2. 在 `.env` 中填写：

```bash
DEEPSEEK_API_KEY=你的 DeepSeek API Key
PORT=3000
HOST=0.0.0.0
```

3. 启动服务：

```bash
npm start
```

4. 打开：

```text
http://localhost:3000
```
