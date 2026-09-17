-- Email verification (Resend) and PayPal checkout. House keys live in
-- site_settings so admin can paste them at /jokester without a .env file.
-- Env vars still win when set (RESEND_API_KEY, PAYPAL_CLIENT_ID, …).

alter table site_settings add column if not exists resend_api_key text not null default '';
alter table site_settings add column if not exists resend_from_email text not null default 'Laugh4.LoL <onboarding@resend.dev>';
alter table site_settings add column if not exists paypal_client_id text not null default '';
alter table site_settings add column if not exists paypal_client_secret text not null default '';
alter table site_settings add column if not exists paypal_mode text not null default 'sandbox';
alter table site_settings add column if not exists paypal_webhook_id text not null default '';

alter table profiles add column if not exists email_verified boolean not null default false;

alter table subscriptions add column if not exists paypal_order_id text;
alter table subscriptions add column if not exists payer_email text;

create table if not exists email_verifications (
  id          text primary key,
  user_id     text not null,
  email       text not null,
  token_hash  text not null unique,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists email_verifications_user_idx on email_verifications (user_id);

create table if not exists payments (
  id              text primary key,
  user_id         text not null,
  plan            text not null,
  amount_cents    integer not null,
  currency        text not null default 'USD',
  paypal_order_id text not null unique,
  status          text not null default 'created',
  payer_email     text not null default '',
  created_at      timestamptz not null default now(),
  captured_at     timestamptz
);

create index if not exists payments_user_idx on payments (user_id);
