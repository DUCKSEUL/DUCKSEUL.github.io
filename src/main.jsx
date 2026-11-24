import { guardFraming } from './security.js'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App.jsx'
import 'katex/dist/katex.min.css'
import './index.css'
import './styles-v2.css'
import './styles-v3.css'
import './styles-v4.css'

// 데이터 라우터: 글쓰기 중 이탈 확인(useBlocker)에 필요. 실제 경로는 App의 <Routes>에서 처리
const router = createBrowserRouter([{ path: '*', element: <App /> }])

// 다른 사이트의 iframe 안이면 그리지 않음 (클릭재킹 방어)
if (guardFraming()) {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )
}
