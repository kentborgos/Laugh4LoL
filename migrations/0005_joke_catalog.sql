-- Crowd score for open-catalog ranking + archive sources (not live-crawled)

alter table jokes add column if not exists score integer not null default 0;

create index if not exists jokes_score_idx on jokes (score desc);
create index if not exists jokes_rating_score_idx on jokes (rating, score desc);
create index if not exists jokes_source_name_idx on jokes (source_name);

insert into crawl_sources (name, url, kind, rating) values
  ('Catalog: taivop/joke-dataset', 'https://github.com/taivop/joke-dataset', 'site', 'clean'),
  ('Catalog: SocialGrep 1M r/Jokes', 'https://huggingface.co/datasets/SocialGrep/one-million-reddit-jokes', 'site', 'clean'),
  ('Catalog: amoudgl short-jokes', 'https://github.com/amoudgl/short-jokes-dataset', 'site', 'clean'),
  ('Catalog: Official Joke API dump', 'https://github.com/15Dkatz/official_joke_api', 'site', 'clean'),
  ('Catalog: JokeAPI dump', 'https://v2.jokeapi.dev/', 'api', 'clean'),
  ('Catalog: icanhazdadjoke dump', 'https://icanhazdadjoke.com/', 'api', 'clean'),
  ('Catalog: Chuck Norris API dump', 'https://api.chucknorris.io/', 'api', 'clean')
on conflict (name) do nothing;
