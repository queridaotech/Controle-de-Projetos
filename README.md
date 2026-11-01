# Petrosupply Project Management

Plataforma interna de gestão da homologação de fornecedores no CRC Petrobras.
React + TypeScript + Vite + Tailwind + Supabase (Auth, Postgres, Storage, RLS, Edge Functions).

## Primeiro acesso

1. No painel do Supabase (projeto `snrtwjmzuydxtjdajoyr`): **Authentication → Users → Add user**. Informe e-mail e senha e marque "Auto Confirm User".
   O **primeiro usuário criado vira Administrador**; os demais entram como Consultor.
2. Rode localmente:

```bash
npm install
cp .env.example .env   # VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (chave publishable)
npm run dev
```

3. Entre com o usuário criado. Em **Administração → Usuários** crie os consultores (a senha temporária é exibida uma única vez).
4. Cadastre clientes, depois projetos. Cada projeto nasce com o roadmap CRC completo (8 etapas, 32 tarefas, 7 milestones, 14 documentos, 8 critérios).

Nunca coloque a Service Role Key no frontend. Ela existe apenas dentro da Edge Function `admin-users`.

## Perfis

| Perfil | Acesso |
|---|---|
| Administrador | tudo: usuários, clientes, projetos, links do portal |
| Consultor | somente os projetos em que está alocado (garantido por RLS) |
| Cliente externo | sem conta; vê apenas o portal por link com token |

## Módulos

- **Dashboard** executivo com dados reais.
- **Projetos** (todos, meus, em atraso, concluídos), criação, edição, arquivamento, alocação de consultor principal e auxiliares.
- **Página do projeto**: Visão Geral, Roadmap (etapas, milestones, conclusão manual do CRC), Checklist (upload de arquivos), Tarefas, Pendências, Critérios e Certificações, Credenciais (cofre cifrado e auditado), Portal do cliente, Histórico.
- **Visões globais**: Roadmap (matriz das 8 etapas), Checklist, Pendências, Atividades, Milestones e Relatórios (com CSV), sempre limitadas aos projetos que o usuário pode acessar.
- **Notificações** (prazos vencendo/vencidos, atribuições), geradas diariamente às 08:00 (Brasília) por pg_cron.
- **Portal do cliente** em `/portal/projeto/{token}`: somente leitura, sem login.

## Alocações

- Um consultor pode estar em quantos projetos forem necessários; a alocação é definida **somente pelo administrador** (Administração → Usuários → ícone de pasta).
- Opções: projetos específicos (seleção múltipla), **todos os projetos ativos** e, de forma separada e desligada por padrão, **atribuir automaticamente os novos projetos** à pessoa.
- O administrador também pode ser alocado e atuar como consultor (função "Administrador atuante"); seu acesso global independe de alocação.
- "Pode atuar operacionalmente" (por usuário): desmarcado, a pessoa não pode ser alocada; para desmarcar, remova antes as alocações.
- Consultores não alteram suas alocações, nem cliente, tipo ou arquivamento do projeto. Podem atualizar etapas, status, tarefas, documentos, pendências, milestones, critérios, comentários e o que o portal exibe (links do portal continuam só do administrador).
- Estrutura: `project_members` (project_id, user_id, allocation_role, is_primary, assigned_by, assigned_at, created_at, updated_at; únicos por projeto+usuário).
- Toda alteração gera histórico com usuário, projeto, data/hora, tipo, dados anteriores e novos.

## Regras importantes

- A conclusão do CRC é sempre registrada manualmente (número e data de emissão). O banco impede concluir com etapas obrigatórias abertas.
- Credenciais: toda visualização, alteração, exclusão **e tentativa negada** é registrada (Administração → Configurações). Senha cifrada com chave do Supabase Vault; só é lida pela função `reveal_credential`, que audita cada acesso. Nunca aparece no portal.
- O portal consulta apenas `get_public_project(token)`, que devolve um JSON já filtrado. Notas internas, documentos, consultores, tarefas e credenciais nunca são enviados.
- Links podem expirar e ser revogados; gerar um novo link desativa os anteriores.

## Banco de dados

Migrations em `supabase/migrations/` (ordem 0001 → 0012), **todas já aplicadas** no projeto:

| Arquivo | Conteúdo |
|---|---|
| 0001_schema | 25 tabelas, FKs, checks e índices |
| 0002_helpers_triggers | permissões, herança do modelo, progresso, auditoria, notificações |
| 0003_credentials_vault | cofre cifrado, `save_credential` / `reveal_credential` |
| 0004_public_portal | `get_public_project(token)` e `create_public_link()` |
| 0005_rls_storage | RLS em todas as tabelas, bucket privado `project-documents` |
| 0006_seed_crc_template | modelo CRC Petrobras |
| 0007_harden_functions | revoga execução de funções internas via API |
| 0008_schedule_deadlines | agenda diária dos alertas de prazo (pg_cron) |
| 0009_credential_log_user_fk | relaciona o log de acesso às credenciais ao usuário |
| 0010_allocations_and_credential_audit | alocações flexíveis, administrador atuante, alocação automática opcional, auditoria de tentativas negadas de credenciais |
| 0011_harden_new_trigger_functions | impede chamada direta das funções de gatilho novas |
| 0012_denied_credential_alerts | notifica os administradores sobre tentativas negadas de acesso a credenciais (1 alerta por pessoa a cada 10 min) |

Edge Function: `supabase/functions/admin-users` (criar usuário, alterar perfil/ativo, redefinir senha; apenas administradores).

Avisos do linter de segurança que são intencionais: `get_public_project` (portal), `save_credential`, `reveal_credential`, `create_public_link` e as funções auxiliares de RLS (`is_admin`, `is_project_member`, `can_access_project`). Cada uma valida a permissão por dentro. `rls_auto_enable` é do próprio Supabase.

## Publicação

O app é um SPA estático. Publique a pasta `dist` (`npm run build`) em Vercel, Netlify ou similar, definindo `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no ambiente.
`vercel.json` e `public/_redirects` já redirecionam todas as rotas para o `index.html` (necessário para o link do portal abrir direto) e `vercel.json` adiciona cabeçalhos de segurança.
Modelos de Projetos (Administração) edita etapas, tarefas e checklist copiados para novos projetos.
Se o Supabase usar confirmação por e-mail ou redirecionamentos, cadastre a URL final em Authentication → URL Configuration.

## Backups e manutenção

- Ative backups diários no plano do Supabase (Database → Backups).
- Arquivos anexados ficam no bucket privado `project-documents`, em `{id_do_projeto}/arquivo`.
- Projetos arquivados ficam ocultos, mas preservados; a exclusão apaga tudo do projeto em cascata.
