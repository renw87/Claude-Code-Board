---
artifact: delivery-plan
task: service-nginx-viewer
date: 2026-07-09
role: tech-lead
status: draft
---

## 版本目标

**版本**: 1.0.0（Board 增量功能）
**范围**: 在 Board 新增只读「服务与 Nginx 查看」功能
**放行标准**: 四个探针均可在本机正常返回数据或降级；前端四分区独立渲染；不破坏现有 Board 功能

## 工作拆解

| # | 工作项 | 主责角色 | 依赖 | 预估 |
|---|--------|----------|------|------|
| 1 | `ServiceInspectorService`：四探针 + 降级 + cwd 关联 | backend-engineer | — | 2h |
| 2 | 路由 `service.routes.ts` + `nginx.routes.ts` + 挂载 `server.ts` | backend-engineer | #1 | 30min |
| 3 | 前端页面 `ServiceNginxPage`：四分区卡片 + 自动刷新 | frontend-engineer | #2 | 2h |
| 4 | 项目详情「相关服务」入口 | frontend-engineer | #2 | 1h |
| 5 | 导航入口 + 路由注册 | frontend-engineer | #3 | 15min |
| 6 | 端到端验证（探针数据、降级、不影响现有功能） | qa-engineer | #3,#4 | 30min |

## 角色分工

- **tech-lead**（我）: 收口、评审、放行。本任务在 plan 阶段即出方案。
- **backend-engineer**: 实现 `ServiceInspectorService` + routes + 安全校验。
- **frontend-engineer**: 实现 `/services` 页面 + 相关服务入口。
- **qa-engineer**: 验证探针正确性、降级路径、不破坏现有功能。

## 风险与缓解

| 风险 | 影响 | 缓解措施 | Owner |
|------|------|----------|-------|
| docker/nginx 未安装 | 对应分区无数据 | 独立降级，不影响其他分区 | backend-engineer |
| `nginx -T` 输出含上游密钥 | 敏感信息暴露 | 低风险（Board 管理员即本机管理员）；后续可加脱敏 | tech-lead |
| 按 cwd 关联不准 | 误关联 | 前端标注「疑似关联」 | frontend-engineer |
| shell 命令注入 | 安全漏洞 | 使用 `execFile`（参数数组），路径白名单，不拼接 | backend-engineer |

## 技能装配清单

本项目为个人 fork，非海尔内部应用，不触发 Haier 企业技能（haier-bpmn/haier-hprmc/haier-scaffold 等）。

| 来源 | 技能 | 触发原因 | 优先级 |
|------|------|----------|--------|
| 手动 | 无 | 无海尔平台能力依赖 | N/A |

## 节点检查

| 节点 | 检查项 | 状态 |
|------|--------|------|
| 方案评审 | arch-design.md + api-contract.md 已产出 | ✅ |
| 开发完成 | 四探针 + 路由 + 前端页面 | ⬜ |
| 测试完成 | 探针数据/降级/不破坏现有 | ⬜ |
| 发布准备 | pm2 restart + 浏览器验证 | ⬜ |

## 不破坏现有功能（设计保证清单）

- ✅ 所有新增文件，不修改任何现有 `.ts`/`.tsx`/`.json`
- ✅ 新路由独立挂载（`server.ts` 新增两行 `app.use`，不修改现有路由注册）
- ✅ 前端新页面追加到路由列表、导航追加一个入口按钮
- ✅ 无 DB schema 变更、无现有 API 签名变更
- ✅ 只读操作，不执行 write 命令
- ✅ 回滚方式：删除新文件 + 移除 3 行注册代码即可

## 项目配置清单

### 项目通用配置

| 配置项说明 | Key | 值 | 状态 | 目标文件 | 来源 |
|-----------|-----|-----|------|----------|------|
| 企业应用 | 否 | — | N/A | — | 个人 fork 项目 |
| S码 | — | — | N/A | — | 非海尔内部应用 |
| 域名上下文 | — | — | N/A | — | 非海尔内部应用 |

## 前端交付物与检查点

| 交付物 | 状态 |
|--------|------|
| 页面结构设计 | ✅ arch-design 已定 |
| 组件划分 | ✅ ServiceNginxPage + 四分区卡片 |
| 响应式 | 延续现有 Tailwind 响应式基线 |
| loading/empty/error/data | ✅ 每个分区四种状态 |
| 设计 token | 复用现有 Board token |
| A11y | 延续现有键盘/焦点/标签策略 |

## 前端脚手架门禁

N/A —— 扩展现有 Board 前端（React/Vite,3900），非海尔内部应用，不生成海尔标准脚手架。预览 = 实现后在运行中的 Board 应用查看。

## API Contract

✅ `docs/artifacts/2026-07-09-service-nginx-viewer/api-contract.md` 已产出（4 个端点，公共类型已定义）。