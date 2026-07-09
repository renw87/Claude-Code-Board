import React, { useEffect, useState, useMemo } from 'react';
import { Server, Wifi, Container, Globe, AlertCircle, Loader } from 'lucide-react';
import axiosInstance from '../utils/axiosInstance';
import { useSessions } from '../hooks/useSessions';
import { cn } from '../utils';

interface ProbeResult<T> {
  available: boolean;
  data: T | null;
  error: string | null;
}

interface ServiceSnapshot {
  ports: ProbeResult<PortInfo[]>;
  systemd: ProbeResult<SystemdService[]>;
  docker: ProbeResult<DockerContainer[]>;
  nginx: ProbeResult<NginxConfig>;
  timestamp: string;
}

interface PortInfo {
  port: number; protocol: string; pid: number; process: string; tag?: string; cwd?: string;
}
interface SystemdService {
  name: string; status: string; startedAt: string | null;
}
interface DockerContainer {
  name: string; image: string; status: string; ports: string;
}
interface NginxConfig {
  configPath: string; rawText: string; files: string[];
}

const BOARD_TAGS: Record<string, string> = {
  'board-frontend': 'Board 前端',
  'board-backend': 'Board 后端',
  'cloudcli-reserved': 'CloudCLI 保留',
  'preview-reserved': '预览保留',
  'backend-reserved': '后端保留',
};

const SectionCard: React.FC<{
  title: string; icon: React.ReactNode; available: boolean; error: string | null;
  children: React.ReactNode;
}> = ({ title, icon, available, error, children }) => (
  <div className="glass-card border border-white/30 rounded-xl p-4 shadow-soft">
    <div className="flex items-center gap-2 mb-3">
      {icon}
      <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      {!available && (
        <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">不可用</span>
      )}
    </div>
    {!available && error && (
      <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2 mb-2 font-mono whitespace-pre-wrap">
        {error}
      </div>
    )}
    {children}
  </div>
);

export const ServiceNginxPage: React.FC = () => {
  const [snapshot, setSnapshot] = useState<ServiceSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { sessions } = useSessions();

  // 从已有会话构建「工作目录 → 项目名」映射，用于端口→项目关联
  const projectMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sessions) {
      const dir = s.workingDir?.trim();
      if (dir && !map.has(dir)) {
        map.set(dir, dir.split('/').filter(Boolean).pop() || dir);
      }
    }
    return map;
  }, [sessions]);

  /** 根据端口 cwd 匹配已知项目名，找不到返回 null */
  const matchProject = (cwd?: string): string | null => {
    if (!cwd) return null;
    // 精确匹配
    if (projectMap.has(cwd)) return projectMap.get(cwd)!;
    // 前缀匹配（子目录也属于该项目）
    for (const [dir, name] of projectMap) {
      if (cwd.startsWith(dir + '/')) return name;
    }
    return null;
  };

  const fetchSnapshot = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axiosInstance.get('/services/overview');
      setSnapshot(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSnapshot(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error && !snapshot) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500 gap-2">
        <AlertCircle className="w-8 h-8" />
        <p className="text-sm">{error}</p>
        <button onClick={fetchSnapshot} className="text-blue-600 text-sm underline">重试</button>
      </div>
    );
  }

  const s = snapshot!;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">服务与 Nginx</h1>
        <button
          onClick={fetchSnapshot}
          className="text-sm text-blue-600 hover:text-blue-700 underline"
        >
          刷新
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 监听端口 */}
        <SectionCard
          title="监听端口"
          icon={<Wifi className="w-4 h-4 text-blue-500" />}
          available={s.ports.available}
          error={s.ports.error}
        >
          {s.ports.available && s.ports.data && s.ports.data.length > 0 ? (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-100">
                  <th className="text-left py-1">端口</th>
                  <th className="text-left">协议</th>
                  <th className="text-left">PID</th>
                  <th className="text-left">进程</th>
                  <th className="text-left">项目</th>
                  <th className="text-left">说明</th>
                </tr>
              </thead>
              <tbody>
                {s.ports.data.map(p => {
                  const project = matchProject(p.cwd);
                  return (
                    <tr key={`${p.port}:${p.protocol}`} className={cn(
                      'border-b border-gray-50',
                      p.tag && 'bg-blue-50/50'
                    )}>
                      <td className="py-1.5 font-mono font-semibold">{p.port}</td>
                      <td className="text-gray-500">{p.protocol}</td>
                      <td className="font-mono text-gray-500">{p.pid}</td>
                      <td className="text-gray-700">{p.process}</td>
                      <td>
                        {project ? (
                          <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded" title={p.cwd}>
                            {project}
                          </span>
                        ) : p.cwd ? (
                          <span className="text-xs text-gray-400" title={p.cwd}>
                            {p.cwd.split('/').filter(Boolean).pop()}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td>
                        {p.tag && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                            {BOARD_TAGS[p.tag] || p.tag}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="text-xs text-gray-400">无监听端口数据</p>
          )}
        </SectionCard>

        {/* systemd 服务 */}
        <SectionCard
          title="systemd 服务"
          icon={<Server className="w-4 h-4 text-green-500" />}
          available={s.systemd.available}
          error={s.systemd.error}
        >
          {s.systemd.available && s.systemd.data && s.systemd.data.length > 0 ? (
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-100">
                    <th className="text-left py-1">服务名</th>
                    <th className="text-left">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {s.systemd.data.slice(0, 50).map(svc => (
                    <tr key={svc.name} className="border-b border-gray-50">
                      <td className="py-1 font-mono text-gray-700">{svc.name}</td>
                      <td>
                        <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                          {svc.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-gray-400">无 systemd 服务数据</p>
          )}
        </SectionCard>

        {/* docker 容器 */}
        <SectionCard
          title="Docker 容器"
          icon={<Container className="w-4 h-4 text-purple-500" />}
          available={s.docker.available}
          error={s.docker.error}
        >
          {s.docker.available && s.docker.data && s.docker.data.length > 0 ? (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-100">
                  <th className="text-left py-1">名称</th>
                  <th className="text-left">镜像</th>
                  <th className="text-left">状态</th>
                  <th className="text-left">端口</th>
                </tr>
              </thead>
              <tbody>
                {s.docker.data.map(c => (
                  <tr key={c.name} className="border-b border-gray-50">
                    <td className="py-1 font-mono font-semibold text-gray-700">{c.name}</td>
                    <td className="text-gray-500 text-xs">{c.image}</td>
                    <td>
                      <span className={cn(
                        'text-xs px-1.5 py-0.5 rounded',
                        c.status.includes('Up') ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      )}>
                        {c.status.slice(0, 20)}
                      </span>
                    </td>
                    <td className="font-mono text-xs text-gray-500">{c.ports}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-xs text-gray-400">无 Docker 容器数据</p>
          )}
        </SectionCard>

        {/* Nginx 配置 */}
        <SectionCard
          title="Nginx 配置"
          icon={<Globe className="w-4 h-4 text-orange-500" />}
          available={s.nginx.available}
          error={s.nginx.error}
        >
          {s.nginx.available && s.nginx.data ? (
            <div>
              <p className="text-xs text-gray-500 mb-2">
                配置路径: <code className="bg-gray-100 px-1 rounded">{s.nginx.data.configPath}</code>
              </p>
              <p className="text-xs text-gray-500 mb-2">
                涉及文件: {s.nginx.data.files.length} 个
              </p>
              <details className="text-xs">
                <summary className="text-blue-600 cursor-pointer hover:underline">
                  查看全文 ({s.nginx.data.rawText.length} 字符)
                </summary>
                <pre className="mt-2 bg-gray-900 text-green-400 p-3 rounded-lg overflow-x-auto max-h-96 text-xs font-mono">
                  {s.nginx.data.rawText.slice(0, 20000)}
                  {s.nginx.data.rawText.length > 20000 && '\n\n... (截断，共 ' + s.nginx.data.rawText.length + ' 字符)'}
                </pre>
              </details>
            </div>
          ) : (
            <p className="text-xs text-gray-400">无 Nginx 配置数据</p>
          )}
        </SectionCard>
      </div>

      <p className="text-xs text-gray-400 text-right">
        更新时间: {new Date(s.timestamp).toLocaleString()}
      </p>
    </div>
  );
};