import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { logger } from '../utils/logger';

const execFileAsync = promisify(execFile);

export interface PortInfo {
  port: number;
  protocol: string;
  pid: number;
  process: string;
  tag?: string;
}

export interface SystemdService {
  name: string;
  status: string;
  startedAt: string | null;
}

export interface DockerContainer {
  name: string;
  image: string;
  status: string;
  ports: string;
}

export interface NginxConfig {
  configPath: string;
  rawText: string;
  files: string[];
}

export interface ProbeResult<T> {
  available: boolean;
  data: T | null;
  error: string | null;
}

export interface ServiceSnapshot {
  ports: ProbeResult<PortInfo[]>;
  systemd: ProbeResult<SystemdService[]>;
  docker: ProbeResult<DockerContainer[]>;
  nginx: ProbeResult<NginxConfig>;
  timestamp: string;
}

export interface CwdServiceResult {
  cwd: string;
  ports: Array<PortInfo & { matchReason: string }>;
  docker: Array<DockerContainer & { matchReason: string }>;
  disclaimer: string;
}

const BOARD_PORT_TAGS: Record<number, string> = {
  3900: 'board-frontend',
  8700: 'board-backend',
  3001: 'cloudcli-reserved',
  3500: 'preview-reserved',
  8080: 'backend-reserved',
};

/**
 * 只读服务探针服务。所有方法只执行固定只读命令，使用 execFile（参数数组）防注入，
 * 每个探针独立 try/catch + 降级；不执行任何写操作（启停/编辑/reload）。
 */
export class ServiceInspectorService {
  /**
   * 并发执行四个探针，返回服务快照。
   */
  async getOverview(): Promise<ServiceSnapshot> {
    const [ports, systemd, docker, nginx] = await Promise.allSettled([
      this.getListeningPorts(),
      this.getSystemdServices(),
      this.getDockerContainers(),
      this.getNginxConfig(),
    ]);

    const unwrap = <T>(r: PromiseSettledResult<ProbeResult<T>>): ProbeResult<T> => {
      if (r.status === 'fulfilled') return r.value;
      return { available: false, data: null, error: r.reason?.message || 'Unknown error' };
    };

    return {
      ports: unwrap(ports),
      systemd: unwrap(systemd),
      docker: unwrap(docker),
      nginx: unwrap(nginx),
      timestamp: new Date().toISOString(),
    };
  }

  /** 获取本机监听端口（ss -ltnp）。 */
  async getListeningPorts(): Promise<ProbeResult<PortInfo[]>> {
    try {
      const { stdout } = await execFileAsync('ss', ['-ltnp'], { timeout: 10000, maxBuffer: 1024 * 1024 });
      const ports: PortInfo[] = [];
      const lines = stdout.split('\n').slice(1); // skip header
      for (const line of lines) {
        const match = line.match(/LISTEN\s+\d+\s+\d+\s+\S+:(\d+)\s+\S+\s+users:\(\("([^"]+)",pid=(\d+)/);
        if (match) {
          const port = parseInt(match[1], 10);
          const protocol = line.includes(':::') ? 'tcp6' : 'tcp';
          ports.push({
            port,
            protocol,
            pid: parseInt(match[3], 10),
            process: match[2],
            tag: BOARD_PORT_TAGS[port],
          });
        }
      }
      // dedupe by port + protocol
      const seen = new Set<string>();
      const deduped = ports.filter(p => {
        const k = `${p.port}:${p.protocol}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      deduped.sort((a, b) => a.port - b.port);
      return { available: true, data: deduped, error: null };
    } catch (e) {
      logger.warn('ServiceInspector: ss -ltnp failed', e);
      return { available: false, data: null, error: (e as Error).message };
    }
  }

  /** 获取正在运行的 systemd 服务。 */
  async getSystemdServices(): Promise<ProbeResult<SystemdService[]>> {
    try {
      const { stdout } = await execFileAsync('systemctl', [
        'list-units', '--type=service', '--state=running', '--no-pager', '--no-legend',
      ], { timeout: 10000, maxBuffer: 1024 * 1024 });
      const services: SystemdService[] = [];
      for (const line of stdout.split('\n')) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 4) {
          services.push({
            name: parts[0],
            status: 'running',
            // systemctl 输出格式: UNIT LOAD ACTIVE SUB DESCRIPTION
            // 第4列是 SUB, 第5列+是描述; 启动时间不在 list-units 里，用 systemctl show 单独查太重
            // 这里只返回名称+状态，不查启动时间（避免 O(n) 子命令）
            startedAt: null,
          });
        }
      }
      return { available: true, data: services, error: null };
    } catch (e) {
      logger.warn('ServiceInspector: systemctl failed', e);
      return { available: false, data: null, error: (e as Error).message };
    }
  }

  /** 获取 docker 容器列表。 */
  async getDockerContainers(): Promise<ProbeResult<DockerContainer[]>> {
    try {
      const { stdout } = await execFileAsync('docker', [
        'ps', '-a', '--format', '{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}',
      ], { timeout: 15000, maxBuffer: 1024 * 1024 });
      const containers: DockerContainer[] = [];
      for (const line of stdout.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const [name, image, status, ports] = trimmed.split('|');
        if (name) {
          containers.push({ name, image: image ?? '', status: status ?? '', ports: ports ?? '' });
        }
      }
      return { available: true, data: containers, error: null };
    } catch (e) {
      logger.warn('ServiceInspector: docker failed', e);
      return { available: false, data: null, error: (e as Error).message };
    }
  }

  /** 获取 Nginx 聚合配置（sudo nginx -T）。 */
  async getNginxConfig(): Promise<ProbeResult<NginxConfig>> {
    try {
      // 先获取配置路径
      let configPath = '/etc/nginx/nginx.conf';
      try {
        const { stdout: v } = await execFileAsync('sudo', ['nginx', '-V'], { timeout: 10000, maxBuffer: 1024 * 1024 });
        const m = v.match(/--conf-path=(\S+)/);
        if (m) configPath = m[1];
      } catch {
        // sudo nginx -V 失败，用默认路径
      }

      const { stdout } = await execFileAsync('sudo', ['nginx', '-T'], { timeout: 15000, maxBuffer: 4 * 1024 * 1024 });
      const files = this.extractNginxFiles(stdout);
      return { available: true, data: { configPath, rawText: stdout, files }, error: null };
    } catch (e) {
      logger.warn('ServiceInspector: nginx -T failed', e);
      return { available: false, data: null, error: (e as Error).message };
    }
  }

  /** 从 nginx -T 输出中提取 # configuration file ... 行，列出涉及的文件。 */
  private extractNginxFiles(raw: string): string[] {
    const files = new Set<string>();
    const re = /^#\s*configuration file\s+(.+?):/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
      files.add(m[1]);
    }
    return Array.from(files);
  }

  /** 只读查看 /etc/nginx 下的单个配置文件。路径白名单，防越权。 */
  async readNginxFile(relPath: string): Promise<{ path: string; content: string }> {
    const base = '/etc/nginx';
    // 规范化路径，拒绝 .. 越权
    const resolved = path.resolve(base, relPath);
    if (!resolved.startsWith(path.resolve(base) + path.sep) && resolved !== path.resolve(base)) {
      throw new Error(`Path traversal denied: ${relPath}`);
    }
    if (!fs.existsSync(resolved)) {
      throw new Error(`File not found: ${relPath}`);
    }
    const content = fs.readFileSync(resolved, 'utf-8');
    return { path: resolved, content };
  }

  /**
   * 按工作目录自动发现关联服务（启发式）。
   * 通过 /proc/<pid>/cwd 匹配进程 + docker inspect Mounts 匹配容器。
   */
  async getServicesByCwd(cwd: string): Promise<CwdServiceResult> {
    const resolvedCwd = path.resolve(cwd);
    if (!fs.existsSync(resolvedCwd) || !fs.statSync(resolvedCwd).isDirectory()) {
      throw new Error(`Directory not found: ${resolvedCwd}`);
    }

    const portsResult: Array<PortInfo & { matchReason: string }> = [];
    const dockerResult: Array<DockerContainer & { matchReason: string }> = [];

    // 1. 通过 /proc/<pid>/cwd 匹配进程
    try {
      const ports = await this.getListeningPorts();
      if (ports.available && ports.data) {
        for (const p of ports.data) {
          try {
            const procCwd = fs.readlinkSync(`/proc/${p.pid}/cwd`);
            if (procCwd === resolvedCwd || procCwd.startsWith(resolvedCwd + '/')) {
              portsResult.push({ ...p, matchReason: 'cwd_match' });
            }
          } catch {
            // /proc/<pid>/cwd 不可读（权限或进程已退出），跳过
          }
        }
      }
    } catch {
      // 端口探测失败，跳过
    }

    // 2. docker inspect 检查 Mounts 源是否匹配
    try {
      const containers = await this.getDockerContainers();
      if (containers.available && containers.data) {
        for (const c of containers.data) {
          try {
            const { stdout } = await execFileAsync('docker', ['inspect', c.name], {
              timeout: 10000, maxBuffer: 1024 * 1024,
            });
            const info = JSON.parse(stdout);
            const mounts = info[0]?.Mounts || [];
            const workdir = info[0]?.Config?.WorkingDir || '';
            const matched = mounts.some((m: any) => {
              const src = m.Source || '';
              return src === resolvedCwd || src.startsWith(resolvedCwd + '/');
            }) || workdir === resolvedCwd || workdir.startsWith(resolvedCwd + '/');
            if (matched) {
              dockerResult.push({ ...c, matchReason: 'mount_or_workdir_match' });
            }
          } catch {
            // docker inspect 失败，跳过
          }
        }
      }
    } catch {
      // docker 不可用，跳过
    }

    return {
      cwd: resolvedCwd,
      ports: portsResult,
      docker: dockerResult,
      disclaimer: '启发式关联，非权威',
    };
  }
}