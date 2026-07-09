---
artifact: api-contract
task: service-nginx-viewer
date: 2026-07-09
role: architect
status: draft
---

## 概述

本次新增 4 个只读 API 端点，用于查看本机服务状态与 Nginx 配置。所有端点需 Bearer JWT 鉴权（复用 `authMiddleware`）。Base URL: `http://localhost:8700`（本地）/ `http://10.170.76.72:8700`（局域网）。

## 接口索引

| # | 方法 | 路径 | 描述 |
|---|------|------|------|
| 1 | GET | `/api/services/overview` | 四区服务快照 |
| 2 | GET | `/api/services/by-cwd?path=` | 按工作目录关联服务 |
| 3 | GET | `/api/nginx/config` | Nginx 聚合配置 |
| 4 | GET | `/api/nginx/file?path=` | Nginx 单文件只读 |

---

## 1. GET /api/services/overview

### 描述
并发执行四个只读探针，返回本机服务快照。

### 请求
- Headers: `Authorization: Bearer <JWT>`
- 无参数

### 响应 200
```json
{
  "ports": {
    "available": true,
    "data": [
      {
        "port": 3900,
        "protocol": "tcp",
        "pid": 12345,
        "process": "node",
        "tag": "board-frontend"
      }
    ],
    "error": null
  },
  "systemd": {
    "available": true,
    "data": [
      {
        "name": "nginx.service",
        "status": "running",
        "startedAt": "2026-07-09T01:00:00Z"
      }
    ],
    "error": null
  },
  "docker": {
    "available": true,
    "data": [
      {
        "name": "my-container",
        "image": "node:22",
        "status": "running",
        "ports": "0.0.0.0:8080->8080/tcp"
      }
    ],
    "error": null
  },
  "nginx": {
    "available": true,
    "data": {
      "configPath": "/etc/nginx/nginx.conf",
      "configText": "# nginx.conf ...",
      "files": ["/etc/nginx/nginx.conf", "/etc/nginx/sites-enabled/default"]
    },
    "error": null
  },
  "timestamp": "2026-07-09T07:00:00Z"
}
```

### 错误场景
- 401: 未提供或无效 JWT
- 200: 单个探针失败时对应字段 `available: false` + `error` 说明，不报 500

---

## 2. GET /api/services/by-cwd?path=/home/sandboxadm/Documents/MyProject

### 描述
按工作目录自动发现关联服务（启发式）。

### 请求
- Headers: `Authorization: Bearer <JWT>`
- Query: `path`（必填，绝对路径，目录必须存在且可读）

### 响应 200
```json
{
  "cwd": "/home/sandboxadm/Documents/MyProject",
  "ports": [
    {
      "port": 8080,
      "protocol": "tcp",
      "pid": 12345,
      "process": "java",
      "matchReason": "cwd_match"
    }
  ],
  "docker": [
    {
      "name": "my-container",
      "image": "openjdk:21",
      "status": "running",
      "matchReason": "mount_source_match"
    }
  ],
  "disclaimer": "启发式关联，非权威"
}
```

### 错误场景
- 400: `path` 参数缺失或不是绝对路径
- 403: `path` 不在允许目录范围内
- 404: `path` 目录不存在

---

## 3. GET /api/nginx/config

### 描述
返回 `nginx -T` 聚合输出，支持按 server/location 分段。

### 请求
- Headers: `Authorization: Bearer <JWT>`
- Query: `section`（可选，`"all"` 默认 | `"server"` 列表 | `"full"` 全文）

### 响应 200
```json
{
  "available": true,
  "configPath": "/etc/nginx/nginx.conf",
  "sections": [
    {
      "serverName": "example.com",
      "listen": "80",
      "locations": [
        {
          "path": "/",
          "config": "proxy_pass http://backend:8080;"
        }
      ]
    }
  ],
  "rawText": "# nginx -T 全文 ...",
  "error": null
}
```

### 错误场景
- 200: nginx 未安装时 `available: false` + `error: "nginx not found"`

---

## 4. GET /api/nginx/file?path=sites-enabled/default

### 描述
只读查看 `/etc/nginx` 下的单个配置文件。

### 请求
- Headers: `Authorization: Bearer <JWT>`
- Query: `path`（必填，`/etc/nginx` 下的相对路径，防越权）

### 响应 200
```json
{
  "path": "/etc/nginx/sites-enabled/default",
  "content": "server {\n  listen 80;\n  ...\n}"
}
```

### 错误场景
- 400: `path` 参数缺失或含 `..` 越权
- 404: 文件不存在
- 403: 路径不在白名单 (`/etc/nginx`) 内

---

## 公共类型

### PortInfo
| 字段 | 类型 | 说明 |
|------|------|------|
| port | number | 监听端口 |
| protocol | string | tcp / tcp6 |
| pid | number | 进程 PID |
| process | string | 进程名（从 /proc/pid/comm） |
| tag? | string | 标签（board-frontend / board-backend / cloudcli / reserved） |

### SystemdService
| 字段 | 类型 | 说明 |
|------|------|------|
| name | string | 服务名（如 nginx.service） |
| status | string | running / exited / failed |
| startedAt | string | ISO 8601 启动时间 |

### DockerContainer
| 字段 | 类型 | 说明 |
|------|------|------|
| name | string | 容器名 |
| image | string | 镜像 |
| status | string | running / exited / paused |
| ports | string | 端口映射（如 "0.0.0.0:8080->8080/tcp"） |

### NginxConfig
| 字段 | 类型 | 说明 |
|------|------|------|
| configPath | string | 主配置文件路径 |
| sections | NginxSection[] | 按 server/location 分段 |
| rawText | string | nginx -T 全文 |
| files | string[] | 涉及的配置文件列表 |

### NginxSection
| 字段 | 类型 | 说明 |
|------|------|------|
| serverName | string | server_name |
| listen | string | listen 指令 |
| locations | NginxLocation[] | location 块列表 |

### NginxLocation
| 字段 | 类型 | 说明 |
|------|------|------|
| path | string | location 路径 |
| config | string | location 内配置文本 |