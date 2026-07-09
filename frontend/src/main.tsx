import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  // 暂时禁用 StrictMode 来减少开发环境的重复连接
  // <StrictMode>
    <App />
  // </StrictMode>
)