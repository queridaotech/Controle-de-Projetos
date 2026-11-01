import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useToast } from '../lib/toast'
import { PageHeader, Section } from '../components/ui'
import { BotaoPrimario, Campo, SemSupabase, input } from '../components/forms'
import { PAPEL } from '../lib/labels'

export default function Perfil() {
  const { perfil, atualizarPerfil } = useAuth()
  const toast = useToast()
  const [nome, setNome] = useState(perfil?.full_name ?? '')
  const [fone, setFone] = useState('')
  const [atual, setAtual] = useState('')
  const [nova, setNova] = useState('')
  const [conf, setConf] = useState('')
  const [erroSenha, setErroSenha] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const meuId = perfil?.id
  useEffect(() => {
    if (!supabase || !meuId) return
    supabase.from('profiles').select('phone').eq('id', meuId).single().then(({ data }) => setFone(data?.phone ?? ''))
  }, [meuId])

  if (!supabase || !perfil) return <SemSupabase />

  async function salvarDados(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return toast.erro('Informe seu nome.')
    setOcupado(true)
    const { error } = await supabase!.from('profiles').update({ full_name: nome.trim(), phone: fone.trim() || null }).eq('id', perfil!.id)
    setOcupado(false)
    if (error) return toast.erro('Não foi possível salvar.')
    toast.ok('Perfil atualizado.')
    atualizarPerfil()
  }

  async function trocarSenha(e: React.FormEvent) {
    e.preventDefault()
    setErroSenha('')
    if (nova.length < 10) return setErroSenha('A nova senha deve ter ao menos 10 caracteres.')
    if (nova !== conf) return setErroSenha('A confirmação não confere.')
    if (!atual) return setErroSenha('Informe a senha atual.')
    setOcupado(true)
    // Reautentica com a senha atual antes de trocar
    const { error: errLogin } = await supabase!.auth.signInWithPassword({ email: perfil!.email, password: atual })
    if (errLogin) {
      setOcupado(false)
      return setErroSenha('Senha atual incorreta.')
    }
    const { error } = await supabase!.auth.updateUser({ password: nova })
    setOcupado(false)
    if (error) return setErroSenha('Não foi possível trocar a senha. Escolha uma senha mais forte.')
    setAtual(''); setNova(''); setConf('')
    toast.ok('Senha alterada.')
  }

  return (
    <>
      <PageHeader title="Meu Perfil" subtitle={`${perfil.email} · ${PAPEL[perfil.role]}`} />
      <div className="grid max-w-3xl gap-5">
        <Section title="Dados pessoais">
          <form onSubmit={salvarDados} className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Nome completo"><input className={input} value={nome} onChange={(e) => setNome(e.target.value)} /></Campo>
            <Campo rotulo="Telefone"><input className={input} value={fone} onChange={(e) => setFone(e.target.value)} /></Campo>
            <div className="sm:col-span-2"><BotaoPrimario disabled={ocupado}>Salvar</BotaoPrimario></div>
          </form>
        </Section>
        <Section title="Alterar senha">
          <form onSubmit={trocarSenha} className="grid gap-4 sm:grid-cols-3" autoComplete="off">
            <Campo rotulo="Senha atual"><input type="password" className={input} value={atual} onChange={(e) => setAtual(e.target.value)} autoComplete="current-password" /></Campo>
            <Campo rotulo="Nova senha"><input type="password" className={input} value={nova} onChange={(e) => setNova(e.target.value)} autoComplete="new-password" /></Campo>
            <Campo rotulo="Confirmar nova senha"><input type="password" className={input} value={conf} onChange={(e) => setConf(e.target.value)} autoComplete="new-password" /></Campo>
            {erroSenha && <p className="text-sm text-red-600 sm:col-span-3">{erroSenha}</p>}
            <div className="sm:col-span-3"><BotaoPrimario disabled={ocupado}>Alterar senha</BotaoPrimario></div>
          </form>
        </Section>
      </div>
    </>
  )
}
