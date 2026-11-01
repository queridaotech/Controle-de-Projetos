import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { supabase, supabaseConfigured } from '../lib/supabase'

export default function Login() {
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [ver, setVer] = useState(false)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (!supabase) {
      // Modo demonstração até configurar o Supabase (.env)
      nav('/')
      return
    }
    setCarregando(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    setCarregando(false)
    if (error) setErro('E-mail ou senha inválidos.')
    else nav('/')
  }

  return (
    <div className="flex min-h-full">
      <div className="relative hidden flex-1 flex-col justify-between bg-gradient-to-br from-navy-950 via-navy-900 to-navy-950 p-12 text-white lg:flex">
        <img src="/logo-branco.png" alt="Petrosupply" className="h-9 w-auto self-start" />
        <div className="max-w-md">
          <h2 className="text-3xl font-semibold leading-tight">Gestão de homologação de fornecedores, em um só lugar.</h2>
          <p className="mt-4 text-white/70">Acompanhe cada etapa do CRC Petrobras, controle documentos e pendências e mantenha seus clientes informados.</p>
        </div>
        <div className="h-1 w-24 rounded-full bg-brand" />
      </div>

      <div className="flex flex-1 items-center justify-center bg-surface p-6">
        <form onSubmit={entrar} className="card w-full max-w-sm p-8">
          <img src="/logo-branco.png" alt="" className="mb-6 hidden h-0" />
          <h1 className="text-xl font-semibold">Entrar</h1>
          <p className="mt-1 text-sm text-muted">Acesse o Petrosupply Project Management.</p>

          <label className="mt-6 block text-xs font-medium text-muted">E-mail</label>
          <div className="relative mt-1.5">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-line py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand" placeholder="voce@empresa.com.br" />
          </div>

          <label className="mt-4 block text-xs font-medium text-muted">Senha</label>
          <div className="relative mt-1.5">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input type={ver ? 'text' : 'password'} required={supabaseConfigured} value={senha} onChange={(e) => setSenha(e.target.value)}
              className="w-full rounded-lg border border-line py-2.5 pl-9 pr-10 text-sm outline-none focus:border-brand" placeholder="••••••••" />
            <button type="button" onClick={() => setVer(!ver)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted" aria-label="Mostrar senha">
              {ver ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {erro && <p className="mt-3 text-sm text-red-600">{erro}</p>}
          {!supabaseConfigured && (
            <p className="mt-3 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-700">
              Supabase ainda não configurado: o acesso está em modo demonstração. Defina as variáveis no arquivo .env.
            </p>
          )}

          <button disabled={carregando} className="mt-6 w-full rounded-lg bg-navy-900 py-2.5 text-sm font-medium text-white transition hover:bg-navy-950 disabled:opacity-60">
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
