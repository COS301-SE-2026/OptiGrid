insert into tenants (tenant_id, name)
values ('11111111-1111-1111-1111-111111111111', 'OptiGrid Demo Tenant')
on conflict (tenant_id) do update set name = excluded.name;

insert into buildings (building_id, tenant_id, name, timezone)
values (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'Head Office',
  'Africa/Johannesburg'
)
on conflict (building_id) do update
set
  tenant_id = excluded.tenant_id,
  name = excluded.name,
  timezone = excluded.timezone;

insert into users (
  user_id,
  tenant_id,
  email,
  role_type,
  first_name,
  last_name,
  preferred_theme,
  password_hash
)
values (
  '33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  'ops-admin@optigrid.test',
  'Admin',
  'Ops',
  'Admin',
  'system',
  '$2b$10$2h2mZKoDbJkWBk4x9swFZeF7Ojf9SIxkV8W8QhQPXfS9M9iYjW0uS'
)
on conflict (user_id) do update
set
  tenant_id = excluded.tenant_id,
  email = excluded.email,
  role_type = excluded.role_type,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  preferred_theme = excluded.preferred_theme,
  password_hash = excluded.password_hash;

insert into user_building_access (user_id, building_id, access_level)
values (
  '33333333-3333-3333-3333-333333333333',
  '22222222-2222-2222-2222-222222222222',
  'admin'
)
on conflict (user_id, building_id) do update
set access_level = excluded.access_level;

insert into sensors (sensor_id, building_id, external_id, name, unit)
values (
  '44444444-4444-4444-4444-444444444444',
  '22222222-2222-2222-2222-222222222222',
  'meter-main-feed-1',
  'Main Feed Meter',
  'kWh'
)
on conflict (sensor_id) do update
set
  building_id = excluded.building_id,
  external_id = excluded.external_id,
  name = excluded.name,
  unit = excluded.unit;

insert into alert_thresholds (threshold_id, sensor_id, metric, min_value, max_value)
values (
  '55555555-5555-5555-5555-555555555555',
  '44444444-4444-4444-4444-444444444444',
  'consumption',
  0,
  500
)
on conflict (threshold_id) do update
set
  sensor_id = excluded.sensor_id,
  metric = excluded.metric,
  min_value = excluded.min_value,
  max_value = excluded.max_value;

insert into optimisation_recommendations (recommendation_id, building_id, recommendation_text, status)
values (
  '66666666-6666-6666-6666-666666666666',
  '22222222-2222-2222-2222-222222222222',
  'Shift HVAC pre-cooling to off-peak window between 03:00 and 05:00.',
  'open'
)
on conflict (recommendation_id) do update
set
  building_id = excluded.building_id,
  recommendation_text = excluded.recommendation_text,
  status = excluded.status;

insert into maintenance_windows (maintenance_window_id, building_id, starts_at, ends_at, reason)
values (
  '77777777-7777-7777-7777-777777777777',
  '22222222-2222-2222-2222-222222222222',
  now() + interval '1 day',
  now() + interval '1 day 2 hours',
  'Planned inverter firmware update'
)
on conflict (maintenance_window_id) do update
set
  building_id = excluded.building_id,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  reason = excluded.reason;

insert into notifications (notification_id, user_id, channel, message)
values (
  '88888888-8888-8888-8888-888888888888',
  '33333333-3333-3333-3333-333333333333',
  'in_app',
  'Welcome to OptiGrid integration baseline.'
)
on conflict (notification_id) do update
set
  user_id = excluded.user_id,
  channel = excluded.channel,
  message = excluded.message;

insert into anomalies (anomaly_id, sensor_id, severity, summary)
values (
  '99999999-9999-9999-9999-999999999999',
  '44444444-4444-4444-4444-444444444444',
  'medium',
  'Consumption exceeded expected baseline by 18%.'
)
on conflict (anomaly_id) do update
set
  sensor_id = excluded.sensor_id,
  severity = excluded.severity,
  summary = excluded.summary;

insert into audit_logs (audit_log_id, actor_user_id, action, target_type, target_id, metadata)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '33333333-3333-3333-3333-333333333333',
  'seed_loaded',
  'system',
  'initial',
  '{"source":"supabase/seed.sql"}'::jsonb
)
on conflict (audit_log_id) do update
set
  actor_user_id = excluded.actor_user_id,
  action = excluded.action,
  target_type = excluded.target_type,
  target_id = excluded.target_id,
  metadata = excluded.metadata;
