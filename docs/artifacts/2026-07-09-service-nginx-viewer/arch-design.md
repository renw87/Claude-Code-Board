---
artifact: arch-design
task: service-nginx-viewer
date: 2026-07-09
role: architect
status: draft
---

## 一、系统边界

### 外部依赖
- **本机 CLI**：`ss -ltnp`（监听端口）、`systemctl list-units`（systemd 服务）、`docker ps -a`（容器）、`nginx -T`/`nginx -V`（Nginx 配置）。全部只读，不执行写操作。
- **本机 /proc 文件系统**：`/proc/<pid>/cwd`（按工作目录关联服务）。只读。
- **本机 /etc/nginx**：只读文件访问，路径白名单校验。

### 边界内
- Board 后端新增 `ServiceInspectorService`（只读探针，并发执行，独立降级）。
- Board 前端新增 `/services` 页面 + 项目详情「相关服务」入口。
- 复用现有 authMiddleware、layout、design token。

### 边界外
- 不调用任何外部 API（非海尔内部应用，无 S码/域名上下文/APP_API_DOMAIN）。
- 不启停服务、不编辑配置、不 reload Nginx。
- 不跨机器。

## 二、组件拆分

| 组件 | 职责 | 位置 |
|------|------|------|
| `ServiceInspectorService` | 封装四个只读探针 + 按 cwd 关联；并发执行，每探针独立 try/catch + 降级 | `backend/src/services/ServiceInspectorService.ts` |
| `service.routes.ts` | 暴露 `/api/services/overview`、`/api/services/by-cwd`、`/api/nginx/config`、`/api/nginx/file` | `backend/src/routes/service.routes.ts` |
| `ServiceNginxPage` | 四分区只读卡片（端口/systemd/docker/nginx）+ 自动刷新 | `frontend/src/pages/ServiceNginxPage.tsx` |
| 项目详情「相关服务」区块 | 调 `/api/services/by-cwd?path=<工作目录>`，弹层展示 | `frontend/src/components/Session/` 新增 |
| 路由 | 新增 `/services` 路由 + 导航入口 | `frontend/src/App.tsx`（路由）+ layout 导航 |

**不修改现有组件**：所有新增文件，不碰现有 service/route/page。

## 三、关键数据流

```mermaid
flowchart TD
  U[用户打开 /services] --> FE[前端并发 GET /api/services/overview]
  FE --> BE[ServiceInspectorService.getOverview]
  BE --> P1[getPorts: ss -ltnp]
  BE --> P2[getSystemd: systemctl list-units]
  BE --> P3[getDocker: docker ps -a]
  BE --> P4[getNginx: nginx -T]
  P1 --> R1[Parse → PortInfo[]]
  P2 --> R2[Parse → SystemdService[]]
  P3 --> R3[Parse → DockerContainer[]]
  P4 --> R4[Parse → NginxConfig]
  R1 & R2 & R3 & R4 --> AGG[ServiceSnapshot]
  AGG --> FE
  FE --> RENDER[四分区卡片渲染，每区独立 loading/empty/error/data]

  U2[项目详情: 相关服务] --> FE2[GET /api/services/by-cwd?path=DIR]
  FE2 --> BE2[/proc/pid/cwd 匹配 + docker inspect Mounts]
  BE2 --> FE2 --> MODAL[弹层: 疑似关联服务列表]
```

## 四、接口约定

详见 `api-contract.md`。四个端点：

| 端点 | 方法 | 描述 | 鉴权 |
|------|------|------|------|
| `/api/services/overview` | GET | 四区快照（端口/systemd/docker/nginx） | authMiddleware |
| `/api/services/by-cwd?path=` | GET | 按工作目录关联服务 | authMiddleware |
| `/api/nginx/config` | GET | nginx -T 聚合配置 | authMiddleware |
| `/api/nginx/file?path=` | GET | 单文件只读（白名单） | authMiddleware |

## 五、技术选型

| 层 | 选型 | 理由 |
|----|------|------|
| 后端 | 沿用 Express + TypeScript | 不引入新框架，增量 service + route |
| shell 执行 | `child_process.execFile`（非 exec） | 防注入：参数数组，不用 shell 字符串拼接 |
| 并发 | `Promise.allSettled` | 四探针并发执行，单个失败不阻塞其他 |
| 前端 | 沿用 React + Vite + Tailwind + MUI | 不引入新依赖 |
| 渲染 | 复用 `MarkdownRenderer`（Nginx 配置高亮）+ 简单表格 | 无新组件库 |

## 六、安全设计

- **命令防注入**：所有 shell 命令使用 `execFile`（参数数组），不接受自由输入拼接到命令字符串。
- **路径白名单**：`/api/nginx/file?path=` 参数校验：必须是 `/etc/nginx` 下的相对路径，规范化后拒绝 `..` 越权。
- **cwd 校验**：`/api/services/by-cwd?path=` 参数校验：必须是绝对路径、目录存在，且在允许目录范围内。
- **只读保证**：不执行 `systemctl start/stop/restart`、`docker start/stop`、`nginx -s reload`、任何写操作。
- **鉴权**：所有新路由挂在 `authMiddleware` 之后。

## 七、风险与约束

| 风险 | 影响 | 缓解 |
|------|------|------|
| docker/nginx 未安装 | 对应分区降级为「不可用」 | 探针独立 try/catch，返回 `available: false` |
| 只读命令权限不足 | 对应分区无数据 | 同上，前端展示降级提示 |
| `nginx -T` 输出含上游密钥（如 proxy_set_header Authorization） | 敏感信息暴露给 Board 管理员 | Board 管理员即本机管理员；风险可接受。若需脱敏，后续可加正则过滤 |
| 按 cwd 关联是启发式 | 可能误关联（同名目录、符号链接） | 前端标注「疑似关联」，不作权威 |
| 并发 execFile 开销 | 多探针短时 CPU 占用 | 可接受（单用户、按需触发、非高频） |

## 八、不破坏现有功能（设计保证）

- 所有新增文件，不修改任何现有 `.ts`/`.tsx`/`.json` 文件。
- 新路由独立挂载：`server.ts` 中新增 `app.use('/api/services', authMiddleware, serviceRouter)` + `app.use('/api/nginx', authMiddleware, nginxRouter)`，不修改现有路由注册。
- 前端新页面 `/services` 追加到路由列表；导航入口追加到现有导航组件（新增 JSX 元素，不删不改现有）。
- 无 DB schema 变更。
- 无现有 API 签名变更。
- pm2 重启后完全回退：删除新文件 + 移除 3 行路由注册 + 移除 1 行导航即可。