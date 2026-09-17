-- Membership, AI quotas, and admin-set subscription prices (per-user)

create table if not exists site_settings (
  id                  integer primary key check (id = 1),
  monthly_price_cents integer not null default 599,
  annual_price_cents  integer not null default 4999,
  admin_email         text not null default 'kent.borgos22@gmail.com',
  free_daily_ai       integer not null default 5,
  paid_daily_ai       integer not null default 80,
  updated_at          timestamptz not null default now()
);

insert into site_settings (id) values (1) on conflict (id) do nothing;

create table if not exists profiles (
  user_id    text primary key,
  email      text not null default '',
  role       text not null default 'member' check (role in ('member', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists subscriptions (
  user_id     text primary key,
  plan        text not null default 'free' check (plan in ('free', 'monthly', 'annual')),
  status      text not null default 'active' check (status in ('active', 'canceled')),
  price_cents integer not null default 0,
  started_at  timestamptz not null default now(),
  expires_at  timestamptz
);

create table if not exists ai_usage (
  user_id text not null,
  day     date not null,
  count   integer not null default 0,
  primary key (user_id, day)
);
