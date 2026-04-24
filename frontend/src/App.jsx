import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import AdminDashboard from './pages/AdminDashboard'
import EmployeeDashboard from './pages/EmployeeDashboard'
import Onboarding from './pages/Onboarding'

function RequireAuth({ children, adminOnly = false }) {
  const session = JSON.parse(localStorage.getItem('session') || 'null')
  if (!session) return <Navigate to="/login" replace />
  if (adminOnly && !session.is_manager) return <Navigate to={`/employee/${session.employee.id}`} replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"    element={<Login />} />
        <Route path="/admin"    element={<RequireAuth adminOnly><AdminDashboard /></RequireAuth>} />
        <Route path="/manager"  element={<Navigate to="/admin" replace />} />
        <Route path="/employee/:id" element={<RequireAuth><EmployeeDashboard /></RequireAuth>} />
        <Route path="/onboarding"   element={<Onboarding />} />
        <Route path="*"         element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
