import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

// Gestão de usuários. A Service Role Key existe APENAS aqui (ambiente da função),
// nunca no frontend. Só administradores ativos podem chamar.

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const ROLES = ['admin', 'consultant']
const emailOk = (v: unknown): v is string => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
const senhaOk = (v: unknown): v is string => typeof v === 'string' && v.length >= 10 && v.length <= 72

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json(405, { error: 'Método não permitido.' })

  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    })

    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: auth, error: authError } = await admin.auth.getUser(token)
    if (authError || !auth.user) return json(401, { error: 'Sessão inválida.' })

    const { data: me } = await admin.from('profiles').select('role, active').eq('id', auth.user.id).single()
    if (!me || me.role !== 'admin' || !me.active) return json(403, { error: 'Apenas administradores.' })

    const body = await req.json().catch(() => ({}))

    switch (body.action) {
      case 'create': {
        const { email, password, full_name, phone, role } = body
        if (!emailOk(email)) return json(400, { error: 'E-mail inválido.' })
        if (!senhaOk(password)) return json(400, { error: 'A senha temporária deve ter de 10 a 72 caracteres.' })
        if (typeof full_name !== 'string' || !full_name.trim()) return json(400, { error: 'Informe o nome.' })
        if (!ROLES.includes(role)) return json(400, { error: 'Perfil inválido.' })

        const { data: created, error } = await admin.auth.admin.createUser({
          email: email.trim().toLowerCase(),
          password,
          email_confirm: true,
          user_metadata: { full_name: full_name.trim() },
        })
        if (error || !created.user) {
          const jaExiste = /already|registered|exists/i.test(error?.message ?? '')
          return json(jaExiste ? 409 : 400, { error: jaExiste ? 'Já existe um usuário com este e-mail.' : 'Não foi possível criar o usuário.' })
        }
        // O trigger criou o perfil como "consultor"; ajusta perfil e telefone.
        const { error: upErr } = await admin
          .from('profiles')
          .update({ full_name: full_name.trim(), phone: phone || null, role })
          .eq('id', created.user.id)
        if (upErr) return json(500, { error: 'Usuário criado, mas falhou ao ajustar o perfil.' })
        return json(200, { id: created.user.id })
      }

      case 'update': {
        const { id, full_name, phone, role, active } = body
        if (typeof id !== 'string') return json(400, { error: 'Usuário não informado.' })
        if (role !== undefined && !ROLES.includes(role)) return json(400, { error: 'Perfil inválido.' })
        // Evita se trancar para fora do sistema
        if (id === auth.user.id && (role === 'consultant' || active === false)) {
          return json(400, { error: 'Você não pode remover seu próprio acesso de administrador nem se desativar.' })
        }
        const patch: Record<string, unknown> = {}
        if (typeof full_name === 'string' && full_name.trim()) patch.full_name = full_name.trim()
        if (phone !== undefined) patch.phone = phone || null
        if (role !== undefined) patch.role = role
        if (typeof active === 'boolean') patch.active = active
        if (Object.keys(patch).length === 0) return json(400, { error: 'Nada para atualizar.' })

        const { error } = await admin.from('profiles').update(patch).eq('id', id)
        if (error) return json(500, { error: 'Não foi possível atualizar o usuário.' })

        if (typeof active === 'boolean') {
          // Desativar também bloqueia o login
          await admin.auth.admin.updateUserById(id, { ban_duration: active ? 'none' : '876000h' })
        }
        return json(200, { ok: true })
      }

      case 'reset_password': {
        const { id, password } = body
        if (typeof id !== 'string') return json(400, { error: 'Usuário não informado.' })
        if (!senhaOk(password)) return json(400, { error: 'A senha temporária deve ter de 10 a 72 caracteres.' })
        const { error } = await admin.auth.admin.updateUserById(id, { password })
        if (error) return json(500, { error: 'Não foi possível redefinir a senha.' })
        return json(200, { ok: true })
      }

      default:
        return json(400, { error: 'Ação desconhecida.' })
    }
  } catch (_e) {
    return json(500, { error: 'Erro interno.' })
  }
})
