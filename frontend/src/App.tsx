import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Layout } from './components/Layout/Layout';
import { SplitView } from './components/Layout/SplitView';
import { CreateSessionModal } from './components/Session/CreateSessionModal';
import { ErrorBoundary } from './components/Common/ErrorBoundary';
import { useWebSocket } from './hooks/useWebSocket';
import { useNotifications } from './hooks/useNotifications';
import { SessionsProvider } from './contexts/SessionsContext';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/Auth/ProtectedRoute';
import { LoginPage } from './components/Auth/LoginPage';
import { WorkflowStages } from './pages/WorkflowStages';
import { WorkItemListPage } from './pages/WorkItemListPage';
import { WorkItemDetailPage } from './pages/WorkItemDetailPage';
import AgentPromptsPage from './pages/AgentPromptsPage';
import AgentPromptDetailPage from './pages/AgentPromptDetailPage';
import { GlassDemo } from './pages/GlassDemo';

function App() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { isConnected, connectionError } = useWebSocket();
  
  // 激活全域通知系统
  useNotifications();
  
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <div className="min-h-screen bg-gray-50 relative">
            <Routes>
                {/* 登录页面 */}
                <Route path="/login" element={<LoginPage />} />
                
                {/* 受保护的路由 */}
                <Route path="/*" element={
                  <ProtectedRoute>
                    <SessionsProvider>
                      {/* WebSocket 连接状态提示 - 固定在顶部 */}
                      {!isConnected && (
                        <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-50 border-b border-yellow-400 p-4">
                          <div className="flex items-center justify-center">
                            <div className="flex-shrink-0">
                              <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                            </div>
                            <div className="ml-3">
                              <p className="text-sm text-yellow-700">
                                {connectionError ? `连接错误: ${connectionError.message}` : '正在连接到服务器...'}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      <Layout onCreateSession={() => setIsCreateModalOpen(true)}>
                        <ErrorBoundary>
                          <Routes>
                            <Route path="/" element={<SplitView onCreateSession={() => setIsCreateModalOpen(true)} />} />
                            <Route path="/sessions/:sessionId" element={<SplitView onCreateSession={() => setIsCreateModalOpen(true)} />} />
                            <Route path="/workflow-stages" element={<WorkflowStages />} />
                            <Route path="/work-items" element={<WorkItemListPage />} />
                            <Route path="/work-items/:id" element={<WorkItemDetailPage />} />
                            <Route path="/agent-prompts" element={<AgentPromptsPage />} />
                            <Route path="/agent-prompts/:name" element={<AgentPromptDetailPage />} />
                            <Route path="/glass-demo" element={<GlassDemo />} />
                            <Route path="*" element={<Navigate to="/" replace />} />
                          </Routes>
                        </ErrorBoundary>

                        {/* 创建 Session Modal */}
                        <CreateSessionModal
                          isOpen={isCreateModalOpen}
                          onClose={() => setIsCreateModalOpen(false)}
                        />
                      </Layout>
                    </SessionsProvider>
                  </ProtectedRoute>
                } />
              </Routes>

              {/* Toast 通知 */}
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  style: {
                    background: '#363636',
                    color: '#fff',
                  },
                }}
              />
            </div>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;