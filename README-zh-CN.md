# Claude Code Board

> ## ⚠️ 公告：本项目已停止维护
>
> 此保存库已归档，将不再接收更新、错误修复或新功能。
>
> **本项目采用 MIT 授权发布** — 你可以自由 fork、修改、散布，并用于任何目的（包括商业用途），完全没有限制。欢迎自由取用！
>
> 🌐 **Landing Page:** [https://cc-board.cablate.com](https://cc-board.cablate.com)

<div align="center">

![Claude Code Board](assets/banner.png)

**为 Claude Code CLI 设计的综合性 Session 管理系统，具备先进的工作流程功能**

**📖 Language / 语言:** [English](README.md) | [简体中文](README-zh-CN.md)

**⚠️ 重要：** [请先阅读免责声明](#️-免责声明) | **🚀 快速开始：** [安装步骤](#安装) | **📖 使用指南：** [操作说明](#-使用指南)

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](package.json)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Maintenance](https://img.shields.io/badge/维护中%3F-否-red.svg)]()
[![Platform](https://img.shields.io/badge/platform-Windows-lightgrey.svg)](#requirements)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)

</div>

## 🌟 概述

Claude Code Board 是一个强大的网页版管理系统，专为使用 Claude Code CLI 的开发者设计。它提供直观的接口来同时管理多个 AI 编程对话，具备工作流程自动化、基于 Agent 的提示管理和智能项目组织等先进功能。

![Session List Management](assets/SessionList.png)
*主控制台展示多个活跃 Session 的状态和管理界面*

## 🆚 为什么选择 Claude Code Board 而不是直接使用 CLI？

### 增强的 CLI 体验
Claude Code CLI 在单一专注的编程对话中表现优异。然而，在管理具有多个上下文的复杂项目时，一些额外的功能变得非常有价值：
- **并发开发** - 同时处理多个功能或项目
- **Session 组织** - 根据项目目标和开发阶段组织对话
- **Agent 工作流程** - 简化不同 AI 专业化之间的切换
- **可视化管理** - 网页接口提供更好的 Session 概览和导航


### 工作流程比较

**传统 CLI 工作流程** 😤
```
1. 打开项目目录
2. 启动 cmd/terminal 窗口
3. 输入 Claude Code CLI 命令
4. 输入命令并等待完成
5. 多项目时：寻找对应的终端窗口
6. 难以同时在同一项目中运行多个对话
```

**Claude Code Board 工作流程** 🚀
```
1. 直接在网页接口创建新对话
2. 一键选择项目目录和 Agent
3. 轻松为同一项目启动多个对话
4. 跨对话延续：在前对话基础上建构新任务
5. 任务完成时收到明确通知
6. 直观接口：一目了然所有对话状态
7. 即时切换：点击即可进入任何对话
8. 并发管理：无缝处理多个项目
```

## ✨ 主要功能

### 🎯 内核 Session 管理
- **多 Session 支持** - 同时运行和管理多个 Claude Code 实例
- **即时聊天接口** - WebSocket 驱动的无缝对话体验
- **智能状态追踪** - 自动监控 Session 状态（闲置、处理中、完成、错误）
- **Session 恢复** - 保留完整上下文的对话恢复功能
- **快速 Session 启动** - 基于现有对话创建新 Session，具备智能预填功能

### 🤖 高端 AI 工作流程
- **Agent 集成** - 从 `.claude/agents` 目录动态加载 Claude agents
- **工作流程阶段** - 预配置的开发阶段（代码审查、调试、功能开发）
- **智能消息增强** - 自动注入 Agent 指令以确保行为一致性
- **自订提示模板** - 常见开发任务的快速启动模板

### 📊 项目组织
- **工作项目** - 在项目特定的工作项目下组织 Session
- **项目分类** - 使用项目和主题标签对 Session 进行分类
- **工作区路径集成** - 自动工作目录管理
- **开发环境集成** - 与 dev.md 和项目文档深度集成

### 🎨 现代化 UI/UX
- **响应式布局** - 针对桌面和平板查看优化
- **即时通知** - Windows Toast 通知 Session 事件
- **消息过滤** - 针对不同消息类型的高端过滤系统

## 🚀 快速开始

### 系统需求

- **操作系统**：Windows 10/11
- **Node.js**：18.0.0 或更高版本
- **Claude Code CLI**：已全域安装的最新版本
  ```bash
  npm install -g @anthropic-ai/claude-code
  ```

### 安装

1. **拷贝保存库**
   ```bash
   git clone https://github.com/yourusername/claude-code-board.git
   cd claude-code-board
   ```

2. **安装相依套件**
   ```bash
   # 安装根目录相依套件
   npm install

   # 安装后端相依套件
   cd backend && npm install

   # 安装前端相依套件
   cd ../frontend && npm install
   ```

3. **快速启动**
   ```bash
   # 选项 1：使用提供的批量文件（Windows）
   start.bat

   # 选项 2：手动启动
   npm run dev:backend   # 终端 1
   npm run dev:frontend  # 终端 2
   ```

4. **访问应用程序**
   - 前端：`http://localhost:5173`
   - 后端 API：`http://localhost:3001`

![Welcome Interface](assets/Demo1.png)
*初次启动后的欢迎界面*

## 🎯 使用指南

### 创建你的第一个 Session

![Session Creation Wizard](assets/CreateSession.png)
*Session 创建向导界面，支持快速模板和默认配置*

1. **基本设置**
   - 从主仪表板点击「New Session」
   - 为你的编程任务输入描述性名称
   - 选择或输入项目的工作目录

2. **高端配置**
   - 选择专业化 AI 行为的 **Workflow Stage**
   - 链接到 **Work Item** 进行项目组织
   - 选择领域专业的 **Agent**

3. **快速模板**
   - 使用预定义的常见任务模板：
     - 🔍 代码审查
     - 🐛 错误修复
     - ✨ 功能开发
     - 📝 文档撰写

### 使用 Agents

![Agent Configuration](assets/EditWorkStageAgent.png)
*Workflow Stage 与 Agent 配置界面*

1. **Agent 设置**
   - 在设置中配置你的 Claude agents 目录
   - Agents 自动从 `~/.claude/agents/` 加载
   - 创建引用特定 agents 的工作流程阶段

2. **动态 Agent 加载**
   - Agents 按需为每条消息加载
   - 避免静态提示包含的 token 浪费
   - 在整个对话中保持行为一致性

### 消息管理

![Message Filter Interface](assets/SessionDetail.png)
*消息过滤和管理界面*

- **过滤**：隐藏/显示不同消息类型（user、assistant、tool_use、thinking）
- **导出**：下载对话历史为 JSON 格式
- **即时更新**：查看生成中的回应
- **搜索**：在对话历史中寻找特定消息

### 项目组织

![Project Organization](assets/WorkItem.png)
*项目分类和工作项目组织界面*

- **工作项目**：将相关 Session 归类到项目任务下
- **分类**：使用项目和主题标签对 Session 进行标记
- **工作区集成**：自动路径侦测和继承
- **快速启动**：基于现有 Session 启动新对话

## 🔧 配置

### 环境变量

在 `backend/` 和 `frontend/` 目录中创建 `.env` 文件：

**后端 (.env)**
```env
PORT=3001
NODE_ENV=development
DATABASE_PATH=./database/claude_code_board.db
SOCKET_PORT=3001
```

**前端 (.env)**
```env
VITE_API_URL=http://localhost:3001
VITE_SOCKET_URL=http://localhost:3001
```

### Agent 配置

1. **设置 Claude Agents 目录**
   - 默认位置：`~/.claude/agents/`
   - 在应用程序设置中配置路径
   - 为每个 agent 创建包含指令的 `.md` 文件

2. **Agent 文件结构**
   ```
   ~/.claude/agents/
   ├── code-reviewer.md     # 代码审查专家
   ├── debugger.md          # 错误修复专家
   ├── architect.md         # 系统设计顾问
   └── documenter.md        # 文档撰写专家
   ```

### 工作流程阶段

![Workflow Stage Configuration](assets/WorkStage.png)
*Workflow Stage 编辑界面展示 Agent 选择和自订提示*

![Agent Configuration](assets/Agent.png)
*Agent 管理和配置界面*

- **自订提示**：定义阶段特定的系统提示
- **Agent 引用**：将阶段链接到特定的 Claude agents
- **建议任务**：为每个阶段提供任务模板
- **颜色编码**：使用自订颜色进行视觉组织


## ⚠️ 免责声明

**重要资安声明**

此工具仅供**个人电脑使用**，**不适用于在线部署**。应用程序除了基础的硬编码登录之外，**没有任何资安防护**。

**主要资安限制：**
- 无数据传输加密
- 无安全认证系统
- 无输入验证或清理机制
- 无常见网络漏洞防护
- 无访问控制机制
- 数据库和文件系统可直接访问

**责任免除声明：**
本项目的作者和贡献者对于使用此软件可能造成的任何损害、损失或资安漏洞**概不负责**。包括但不限于：
- 智能财产或创作内容的损失
- 金钱财产损失或损害
- 数据外泄或未授权访问
- 系统入侵或恶意软件感染
- 任何其他直接或间接损害

**使用此软件即表示您确认：**
- 您完全承担使用风险
- 您了解资安限制
- 您仅会在安全的个人电脑上使用
- 您不会部署在公开或共享网络上
- 您承担所有后果的完全责任

## 📝 授权

本项目采用 MIT 授权 - 详情请见 [LICENSE](LICENSE) 文件。

## 🤝 支持

### 取得协助

- 📚 **文档**：查看此 README 和内联代码文档
- 🐛 **错误回报**：在 GitHub 上创建 issue
- 💡 **功能请求**：在 GitHub Discussions 中讨论

---

<div align="center">

**用 ❤️ 为热爱 AI 驱动编程的开发者而建**

[⭐ 为此保存库加星](https://github.com/yourusername/claude-code-board) • [🐛 回报问题](https://github.com/yourusername/claude-code-board/issues) • [💡 请求功能](https://github.com/yourusername/claude-code-board/issues)

</div>