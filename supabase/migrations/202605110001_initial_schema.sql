create extension if not exists pgcrypto;

do $$
begin
  create type user_role as enum ('Admin', 'Operator', 'Viewer');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type theme_preference as enum ('light', 'dark', 'system');
exception
  when duplicate_object then null;
end
$$;

create table if not exists tenants (
  tenant_id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists buildings (
  building_id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(tenant_id) on delete cascade,
  name text not null,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now()
);

create table if not exists users (
  user_id uuid primary key,
  tenant_id uuid references tenants(tenant_id) on delete set null,
  email varchar(255) not null unique,
  role_type user_role not null default 'Viewer',
  first_name varchar(100),
  last_name varchar(100),
  preferred_theme theme_preference not null default 'system',
  password_hash varchar(255) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists user_building_access (
  user_id uuid not null references users(user_id) on delete cascade,
  building_id uuid not null references buildings(building_id) on delete cascade,
  access_level text not null default 'viewer',
  granted_at timestamptz not null default now(),
  primary key (user_id, building_id)
);

create table if not exists sensors (
  sensor_id uuid primary key default gen_random_uuid(),
  building_id uuid not null references buildings(building_id) on delete cascade,
  external_id text not null unique,
  name text not null,
  unit text not null default 'kWh',
  created_at timestamptz not null default now()
);

create table if not exists anomalies (
  anomaly_id uuid primary key default gen_random_uuid(),
  sensor_id uuid not null references sensors(sensor_id) on delete cascade,
  severity text not null,
  summary text not null,
  detected_at timestamptz not null default now()
);

create table if not exists optimisation_recommendations (
  recommendation_id uuid primary key default gen_random_uuid(),
  building_id uuid not null references buildings(building_id) on delete cascade,
  recommendation_text text not null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists alert_thresholds (
  threshold_id uuid primary key default gen_random_uuid(),
  sensor_id uuid not null references sensors(sensor_id) on delete cascade,
  metric text not null default 'consumption',
  min_value numeric,
  max_value numeric,
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  notification_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(user_id) on delete cascade,
  channel text not null default 'in_app',
  message text not null,
  sent_at timestamptz not null default now(),
  read_at timestamptz
);

create table if not exists maintenance_windows (
  maintenance_window_id uuid primary key default gen_random_uuid(),
  building_id uuid not null references buildings(building_id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text not null
);

create table if not exists audit_logs (
  audit_log_id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references users(user_id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
