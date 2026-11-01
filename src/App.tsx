import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { RotaAdmin, RotaProtegida } from './components/ProtectedRoute'
import { AuthProvider } from './lib/auth'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Modelos from './pages/Modelos'
import PortalCliente from './pages/PortalCliente'
import Notificacoes from './pages/Notificacoes'
import Relatorios from './pages/Relatorios'
import Perfil from './pages/Perfil'
import LinhasFornecimento from './pages/LinhasFornecimento'
import Pendencias from './pages/Pendencias'
import Milestones from './pages/Milestones'
import Atividades from './pages/Atividades'
import ChecklistGlobal from './pages/ChecklistGlobal'
import RoadmapGlobal from './pages/RoadmapGlobal'
import Configuracoes from './pages/Configuracoes'
import Clientes from './pages/Clientes'
import Usuarios from './pages/Usuarios'
import Consultores from './pages/Consultores'
import Projetos from './pages/Projetos'
import ProjetoDetalhe from './pages/ProjetoDetalhe'
import { ToastProvider } from './lib/toast'



export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/portal/projeto/:token" element={<PortalCliente />} />
          <Route element={<RotaProtegida />}>
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="/projetos" element={<Projetos modo="todos" />} />
              <Route path="/meus-projetos" element={<Projetos modo="meus" />} />
              <Route path="/projetos-atrasados" element={<Projetos modo="atrasados" />} />
              <Route path="/projetos-concluidos" element={<Projetos modo="concluidos" />} />
              <Route path="/projetos/:id" element={<ProjetoDetalhe />} />
              <Route path="/notificacoes" element={<Notificacoes />} />
              <Route path="/relatorios" element={<Relatorios />} />
              <Route path="/roadmap" element={<RoadmapGlobal />} />
              <Route path="/checklist" element={<ChecklistGlobal />} />
              <Route path="/pendencias" element={<Pendencias />} />
              <Route path="/atividades" element={<Atividades />} />
              <Route path="/milestones" element={<Milestones />} />
              <Route path="/perfil" element={<Perfil />} />
              <Route element={<RotaAdmin />}>
                <Route path="/usuarios" element={<Usuarios />} />
                <Route path="/consultores" element={<Consultores />} />
                <Route path="/clientes" element={<Clientes />} />
                <Route path="/linhas" element={<LinhasFornecimento />} />
                <Route path="/configuracoes" element={<Configuracoes />} />
                <Route path="/modelos" element={<Modelos />} />
              </Route>
            </Route>
          </Route>
        </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
