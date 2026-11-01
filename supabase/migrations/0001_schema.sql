-- =====================================================================
-- Petrosupply Project Management — 0001: estrutura de tabelas
-- Códigos de status em inglês (snake_case); a interface traduz para PT-BR.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- Perfis e papéis ----------
create table public.roles (
  code        text primary key,
  name        text not null,
  description text
);
insert into public.roles (code, name, description) values
  ('admin',      'Administrador', 'Acesso completo à aplicação'),
  ('consultant', 'Consultor',     'Acessa somente os projetos em que está alocado');

create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text not null default '',
  email      text not null,
  phone      text,
  role       text not null default 'consultant' references public.roles(code),
  active     boolean not null default true,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Clientes ----------
create table public.clients (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  cnpj         text unique,
  contact_name text,
  email        text,
  phone        text,
  notes        text,
  active       boolean not null default true,
  created_by   uuid references public.profiles(id) default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint clients_cnpj_len check (cnpj is null or length(regexp_replace(cnpj, '\D', '', 'g')) = 14)
);

-- ---------- Tipos de projeto e modelos de etapas ----------
create table public.project_types (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  description text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.stage_templates (
  id              uuid primary key default gen_random_uuid(),
  project_type_id uuid not null references public.project_types(id) on delete cascade,
  position        int  not null,
  name            text not null,
  objective       text,
  description     text,
  milestone_title text,
  weight          numeric(6,2) not null default 12.5 check (weight >= 0),
  required        boolean not null default true,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (project_type_id, position)
);

create table public.stage_template_tasks (
  id                uuid primary key default gen_random_uuid(),
  stage_template_id uuid not null references public.stage_templates(id) on delete cascade,
  position          int  not null,
  title             text not null,
  description       text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (stage_template_id, position)
);

create table public.document_checklists (
  id              uuid primary key default gen_random_uuid(),
  project_type_id uuid not null references public.project_types(id) on delete cascade,
  position        int  not null,
  name            text not null,
  category        text,
  description     text,
  required        boolean not null default true,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (project_type_id, position)
);

-- ---------- Projetos ----------
create table public.projects (
  id                     uuid primary key default gen_random_uuid(),
  project_type_id        uuid not null references public.project_types(id),
  client_id              uuid not null references public.clients(id) on delete restrict,
  name                   text not null,
  registration_type      text not null check (registration_type in
                           ('reseller_distributor','manufacturer_trader','manufacturer_non_trader','service_provider')),
  contact_name           text,
  contact_email          text,
  contact_phone          text,
  start_date             date,
  estimated_days         int check (estimated_days is null or estimated_days > 0),
  expected_end_date      date,
  actual_end_date        date,
  status                 text not null default 'not_started' check (status in
                           ('not_started','in_progress','waiting_client','waiting_petrobras',
                            'internal_review','with_pending','delayed','completed','cancelled')),
  current_stage_position int not null default 1,
  progress               numeric(5,2) not null default 0 check (progress between 0 and 100),
  crc_number             text,
  crc_issued_at          date,
  internal_notes         text,
  archived_at            timestamptz,
  created_by             uuid references public.profiles(id) default auth.uid(),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table public.project_members (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  member_role text not null default 'auxiliary' check (member_role in ('principal','auxiliary')),
  created_by  uuid references public.profiles(id) default auth.uid(),
  created_at  timestamptz not null default now(),
  unique (project_id, user_id)
);
create unique index project_members_one_principal on public.project_members (project_id) where member_role = 'principal';

-- ---------- Etapas (cópia do modelo, isoladas por projeto) ----------
create table public.project_stages (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects(id) on delete cascade,
  template_id    uuid references public.stage_templates(id) on delete set null,
  position       int  not null,
  name           text not null,
  objective      text,
  description    text,
  weight         numeric(6,2) not null default 12.5 check (weight >= 0),
  required       boolean not null default true,
  status         text not null default 'not_started' check (status in ('not_started','in_progress','completed','blocked')),
  responsible_id uuid references public.profiles(id) on delete set null,
  start_date     date,
  due_date       date,
  completed_at   timestamptz,
  progress       numeric(5,2) not null default 0 check (progress between 0 and 100),
  notes          text,
  created_by     uuid references public.profiles(id) default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (project_id, position)
);

create table public.project_tasks (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  stage_id     uuid references public.project_stages(id) on delete set null,
  title        text not null,
  description  text,
  assigned_to  uuid references public.profiles(id) on delete set null,
  start_date   date,
  due_date     date,
  priority     text not null default 'medium' check (priority in ('low','medium','high','critical')),
  status       text not null default 'todo' check (status in ('todo','in_progress','blocked','done')),
  completed_at timestamptz,
  created_by   uuid references public.profiles(id) default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.milestones (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects(id) on delete cascade,
  stage_id       uuid references public.project_stages(id) on delete set null,
  title          text not null,
  planned_date   date,
  completed_at   timestamptz,
  responsible_id uuid references public.profiles(id) on delete set null,
  status         text not null default 'pending' check (status in ('pending','completed','delayed')),
  created_by     uuid references public.profiles(id) default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---------- Documentos ----------
create table public.project_documents (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects(id) on delete cascade,
  checklist_item_id uuid references public.document_checklists(id) on delete set null,
  name              text not null,
  category          text,
  required          boolean not null default true,
  sender            text not null default 'Cliente',
  status            text not null default 'not_requested' check (status in
                      ('not_requested','requested','received','in_review','approved','rejected','needs_fix','waived')),
  requested_at      timestamptz,
  received_at       timestamptz,
  validated_at      timestamptz,
  file_path         text,
  file_name         text,
  file_size         bigint,
  mime_type         text,
  notes             text,
  created_by        uuid references public.profiles(id) default auth.uid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ---------- Cofre de credenciais (senha cifrada; ver 0003) ----------
create table public.project_credentials (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects(id) on delete cascade,
  platform_name  text not null,
  url            text,
  login          text,
  access_email   text,
  password_enc   bytea,
  notes          text,
  responsible_id uuid references public.profiles(id) on delete set null,
  created_by     uuid references public.profiles(id) default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.credential_access_logs (
  id            uuid primary key default gen_random_uuid(),
  credential_id uuid,
  project_id    uuid not null,
  user_id       uuid,
  action        text not null check (action in ('create','update','reveal','delete')),
  created_at    timestamptz not null default now()
);

-- ---------- Critérios, certificações, pendências ----------
create table public.project_criteria (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects(id) on delete cascade,
  code            text not null check (code in
                    ('managerial','family_registration','legal','economic','gri','technical','lfo','certifications')),
  name            text not null,
  status          text not null default 'not_evaluated' check (status in
                    ('not_evaluated','in_evaluation','approved','rejected','pending')),
  gri_level       text check (gri_level in ('low','medium','high','not_evaluated')),
  started_at      date,
  last_updated_at date,
  responsible_id  uuid references public.profiles(id) on delete set null,
  notes           text,
  pending_notes   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (project_id, code)
);

create table public.project_certifications (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  cert_type   text not null check (cert_type in ('iso_9001','iso_14001','iso_45001','api','other')),
  other_name  text,
  identifier  text,
  valid_until date,
  status      text not null default 'pending' check (status in ('valid','expired','pending','not_applicable')),
  document_id uuid references public.project_documents(id) on delete set null,
  created_by  uuid references public.profiles(id) default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.project_pending_items (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects(id) on delete cascade,
  stage_id       uuid references public.project_stages(id) on delete set null,
  criterion_id   uuid references public.project_criteria(id) on delete set null,
  document_id    uuid references public.project_documents(id) on delete set null,
  description    text not null,
  responsible_id uuid references public.profiles(id) on delete set null,
  identified_at  date not null default current_date,
  due_date       date,
  priority       text not null default 'medium' check (priority in ('low','medium','high','critical')),
  status         text not null default 'open' check (status in
                   ('open','in_progress','waiting_client','waiting_petrobras','resolved','cancelled')),
  action_plan    text,
  resolved_at    timestamptz,
  created_by     uuid references public.profiles(id) default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Comentários são sempre INTERNOS (nunca expostos no portal do cliente)
create table public.project_comments (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  stage_id   uuid references public.project_stages(id) on delete cascade,
  task_id    uuid references public.project_tasks(id) on delete cascade,
  pending_id uuid references public.project_pending_items(id) on delete cascade,
  author_id  uuid references public.profiles(id) default auth.uid(),
  body       text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Auditoria ----------
create table public.project_activity_logs (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  user_id     uuid references public.profiles(id) on delete set null,
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  old_data    jsonb,
  new_data    jsonb,
  created_at  timestamptz not null default now()
);

-- ---------- Portal externo ----------
create table public.project_public_links (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  token      text not null unique
             default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  active     boolean not null default true,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);

-- Define o que cada projeto expõe no portal (camada de dados públicos controlada)
create table public.project_public_status (
  project_id          uuid primary key references public.projects(id) on delete cascade,
  show_dates          boolean not null default true,
  show_stages         boolean not null default true,
  show_criteria       boolean not null default true,
  show_certifications boolean not null default true,
  show_pending        boolean not null default true,
  show_crc_number     boolean not null default true,
  public_note         text,
  updated_at          timestamptz not null default now()
);

-- ---------- Linhas de fornecimento ----------
create table public.supply_families (
  id          uuid primary key default gen_random_uuid(),
  code        text unique,
  name        text not null,
  description text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.project_supply_families (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  family_id  uuid not null references public.supply_families(id) on delete restrict,
  status     text not null default 'selected' check (status in ('selected','approved','rejected','pending')),
  notes      text,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, family_id)
);

-- ---------- Notificações ----------
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- Índices ----------
create index on public.projects (client_id);
create index on public.projects (status) where archived_at is null;
create index on public.project_members (user_id);
create index on public.project_stages (project_id);
create index on public.project_tasks (project_id, status);
create index on public.project_tasks (assigned_to) where status <> 'done';
create index on public.project_tasks (stage_id);
create index on public.milestones (project_id);
create index on public.project_documents (project_id, status);
create index on public.project_credentials (project_id);
create index on public.credential_access_logs (project_id, created_at desc);
create index on public.project_criteria (project_id);
create index on public.project_certifications (project_id);
create index on public.project_pending_items (project_id, status);
create index on public.project_comments (project_id, created_at desc);
create index on public.project_activity_logs (project_id, created_at desc);
create index on public.project_public_links (project_id);
create index on public.project_supply_families (project_id);
create index on public.notifications (user_id, read_at, created_at desc);
