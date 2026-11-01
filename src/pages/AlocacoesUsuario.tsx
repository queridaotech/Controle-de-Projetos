import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'
import { Modal, Confirmar } from '../components/Modal'
import { BotaoPrimario, BotaoSecundario, input } from '../components/forms'
import { STATUS_PROJETO, ALOCACAO } from '../lib/labels'

export interface UsuarioAloc {
  id: string; full_name: string; email: string; role: 'admin' | 'consultant'
  can_operate: boolean; auto_assign_new_projects: boolean
}
interface Proj { id: string; name: string; status: string; client: { name: string } | null }
interface Aloc { id: string; project_id: string; member_role: string; allocation_role: string }

const ENCERRADOS = ['completed', 'cancelled']

export default function AlocacoesUsuario({ usuario, onClose, onChanged }: { usuario: UsuarioAloc; onClose: () => void; onChanged: () => void }) {
  const toast = useToast()
  const [projetos, setProjetos] = useState<Proj[]>([])
  const [atuais, setAtuais] = useState<Aloc[]>([])
  const [marcados, setMarcados] = useState<Set<string>>(new Set())
  const [busca, setBusca] = useState('')
  const [auto, setAuto] = useState(usuario.auto_assign_new_projects)
  const [confirmarTodos, setConfirmarTodos] = useState(false)
  const [confirmarSalvar, setConfirmarSalvar] = useState<string[] | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const carregar = useCallback(async () => {
    const [p, a] = await Promise.all([
      supabase!.from('projects').select('id, name, status, client:clients(name)').is('archived_at', null).order('created_at', { ascending: false }),
      supabase!.from('project_members').select('id, project_id, member_role, allocation_role').eq('user_id', usuario.id),
    ])
    setProjetos((p.data as unknown as Proj[]) ?? [])
    const lista = (a.data as Aloc[]) ?? []
    setAtuais(lista)
    setMarcados(new Set(lista.map((x) => x.project_id)))
  }, [usuario.id])

  useEffect(() => {
    carregar()
  }, [carregar])

  const exibidos = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return projetos.filter((p) => !q || `${p.name} ${p.client?.name ?? ''}`.toLowerCase().includes(q))
  }, [projetos, busca])

  const atuaisIds = useMemo(() => new Set(atuais.map((a) => a.project_id)), [atuais])
  const aAdicionar = [...marcados].filter((id) => !atuaisIds.has(id))
  const aRemover = atuais.filter((a) => !marcados.has(a.project_id))
  const removeuPrincipal = aRemover.some((a) => a.member_role === 'principal')
  const mudou = aAdicionar.length > 0 || aRemover.length > 0

  function alternar(id: string) {
    const n = new Set(marcados)
    n.has(id) ? n.delete(id) : n.add(id)
    setMarcados(n)
  }

  async function salvar() {
    setOcupado(true)
    let falhou = false
    if (aAdicionar.length) {
      const { error } = await supabase!.rpc('allocate_user_to_projects', { p_user: usuario.id, p_projects: aAdicionar, p_all_active: false, p_auto: null })
      if (error) { falhou = true; toast.erro(error.message || 'Não foi possível alocar.') }
    }
    if (aRemover.length) {
      const { error } = await supabase!.from('project_members').delete().eq('user_id', usuario.id).in('project_id', aRemover.map((a) => a.project_id))
      if (error) { falhou = true; toast.erro('Não foi possível remover alocações.') }
    }
    setOcupado(false)
    setConfirmarSalvar(null)
    if (!falhou) toast.ok('Alocações atualizadas.')
    await carregar()
    onChanged()
  }

  async function alocarTodos() {
    setOcupado(true)
    const { data, error } = await supabase!.rpc('allocate_user_to_projects', { p_user: usuario.id, p_projects: [], p_all_active: true, p_auto: auto })
    setOcupado(false)
    setConfirmarTodos(false)
    if (error) toast.erro(error.message || 'Não foi possível alocar.')
    else toast.ok(`${data ?? 0} projeto(s) ativo(s) adicionados${auto ? '. Novos projetos serão atribuídos automaticamente.' : '.'}`)
    await carregar()
    onChanged()
  }

  async function alterarAuto(valor: boolean) {
    setAuto(valor)
    const { error } = await supabase!.from('profiles').update({ auto_assign_new_projects: valor }).eq('id', usuario.id)
    if (error) {
      setAuto(!valor)
      return toast.erro(error.message || 'Não foi possível alterar.')
    }
    toast.ok(valor ? 'Novos projetos serão atribuídos automaticamente.' : 'Atribuição automática desligada.')
    onChanged()
  }

  const bloqueado = !usuario.can_operate

  return (
    <Modal largo titulo={`Alocações — ${usuario.full_name || usuario.email}`} onClose={onClose}>
      {bloqueado ? (
        <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
          Este usuário não está habilitado para atuar operacionalmente. Habilite-o em "Editar" para alocá-lo em projetos.
        </p>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">
            {atuais.length} projeto(s) alocado(s){usuario.role === 'admin' && ' · Administrador atuante: mantém acesso global mesmo sem alocação'}.
            Não há limite de projetos por pessoa.
          </p>

          <div className="mb-3 rounded-lg border border-line p-3 text-sm">
            <p className="mb-2 font-medium">Alocar em todos os projetos ativos</p>
            <label className="mb-2 flex items-start gap-2 text-muted">
              <input type="checkbox" className="mt-0.5" checked={auto} onChange={(e) => alterarAuto(e.target.checked)} />
              <span>Também atribuir automaticamente os novos projetos a esta pessoa (desligado por padrão; vale para projetos criados daqui em diante)</span>
            </label>
            <BotaoSecundario onClick={() => setConfirmarTodos(true)} disabled={ocupado}>Alocar em todos os ativos</BotaoSecundario>
          </div>

          <input className={`${input} mb-3`} placeholder="Buscar projeto ou cliente" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <div className="max-h-72 overflow-y-auto rounded-lg border border-line">
            {exibidos.map((p) => {
              const a = atuais.find((x) => x.project_id === p.id)
              return (
                <label key={p.id} className="flex cursor-pointer items-center gap-3 border-b border-line/60 px-3 py-2.5 text-sm last:border-0 hover:bg-surface">
                  <input type="checkbox" checked={marcados.has(p.id)} onChange={() => alternar(p.id)} />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{p.client?.name ?? p.name}</span>
                    <span className="block text-xs text-muted">{p.name} · {STATUS_PROJETO[p.status]}{ENCERRADOS.includes(p.status) && ' (encerrado)'}</span>
                  </span>
                  {a && <span className="text-xs text-muted">{ALOCACAO[a.allocation_role]}{a.member_role === 'principal' && ' · principal'}</span>}
                </label>
              )
            })}
            {exibidos.length === 0 && <p className="p-4 text-center text-sm text-muted">Nenhum projeto.</p>}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-xs text-muted">{aAdicionar.length} a adicionar · {aRemover.length} a remover</span>
            <div className="flex gap-2">
              <BotaoSecundario onClick={onClose}>Fechar</BotaoSecundario>
              <BotaoPrimario disabled={!mudou || ocupado} onClick={() => (aRemover.length ? setConfirmarSalvar([]) : salvar())}>Salvar alocações</BotaoPrimario>
            </div>
          </div>
        </>
      )}

      {confirmarTodos && (
        <Confirmar
          titulo="Alocar em todos os projetos ativos"
          rotulo="Alocar"
          texto={`${usuario.full_name || usuario.email} será adicionado como auxiliar a todos os projetos ativos em que ainda não estiver.${auto ? ' Os projetos novos também serão atribuídos automaticamente.' : ''}`}
          onConfirm={alocarTodos}
          onClose={() => setConfirmarTodos(false)}
          carregando={ocupado}
        />
      )}
      {confirmarSalvar && (
        <Confirmar
          titulo="Remover alocações"
          rotulo="Confirmar"
          texto={`Remover ${aRemover.length} alocação(ões)? O usuário perde o acesso a esses projetos.${removeuPrincipal ? ' Atenção: em pelo menos um deles esta pessoa é o consultor principal e o projeto ficará sem principal.' : ''}`}
          onConfirm={salvar}
          onClose={() => setConfirmarSalvar(null)}
          carregando={ocupado}
        />
      )}
    </Modal>
  )
}
