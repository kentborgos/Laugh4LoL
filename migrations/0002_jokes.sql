-- Laugh4.LoL joke vault + crawler tables (unowned, shared catalog)

create table if not exists jokes (
  id            serial primary key,
  setup         text not null default '',
  punchline     text not null default '',
  body          text not null,
  rating        text not null check (rating in ('clean', 'adult')),
  category      text not null default 'general',
  source_name   text not null default 'seed',
  source_url    text not null default '',
  content_hash  text not null unique,
  created_at    timestamptz not null default now()
);

create index if not exists jokes_rating_idx on jokes (rating);
create index if not exists jokes_category_idx on jokes (category);
create index if not exists jokes_created_at_idx on jokes (created_at desc);

create table if not exists crawl_sources (
  id           serial primary key,
  name         text not null unique,
  url          text not null,
  kind         text not null check (kind in ('api', 'site', 'forum')),
  rating       text not null default 'clean' check (rating in ('clean', 'adult')),
  last_crawled timestamptz,
  last_status  text not null default 'idle',
  last_error   text,
  enabled      boolean not null default true
);

create table if not exists crawl_runs (
  id           serial primary key,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  found_count  integer not null default 0,
  saved_count  integer not null default 0,
  status       text not null default 'running'
);

create index if not exists crawl_runs_started_idx on crawl_runs (started_at desc);

insert into crawl_sources (name, url, kind, rating) values
  ('icanhazdadjoke', 'https://icanhazdadjoke.com/search', 'api', 'clean'),
  ('Official Joke API', 'https://official-joke-api.appspot.com/jokes/ten', 'api', 'clean'),
  ('JokeAPI Safe', 'https://v2.jokeapi.dev/joke/Any?amount=10&safe-mode', 'api', 'clean'),
  ('JokeAPI Programming', 'https://v2.jokeapi.dev/joke/Programming?amount=10&safe-mode', 'api', 'clean'),
  ('JokeAPI Late Show', 'https://v2.jokeapi.dev/joke/Dark,Pun,Misc?amount=10&blacklistFlags=racist,sexist', 'api', 'adult'),
  ('Reddit r/dadjokes', 'https://old.reddit.com/r/dadjokes/hot.json?limit=25', 'forum', 'clean'),
  ('Reddit r/Jokes', 'https://old.reddit.com/r/Jokes/hot.json?limit=25', 'forum', 'clean'),
  ('Reddit r/cleanjokes', 'https://old.reddit.com/r/cleanjokes/hot.json?limit=20', 'forum', 'clean'),
  ('Reddit r/DirtyJokes', 'https://old.reddit.com/r/DirtyJokes/hot.json?limit=20', 'forum', 'adult'),
  ('Chuck Norris API', 'https://api.chucknorris.io/jokes/random', 'api', 'clean')
on conflict (name) do nothing;
