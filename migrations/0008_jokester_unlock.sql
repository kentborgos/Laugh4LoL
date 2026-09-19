-- Session-backed vault unlock so preview (no third-party cookies) and
-- production both remember an admin unlock for a week.
alter table profiles add column if not exists jokester_unlocked_at timestamptz;
