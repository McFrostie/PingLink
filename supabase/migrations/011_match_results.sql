-- ─────────────────────────────────────────────
-- Migration 011: Match Results & Scoring
-- Add score tracking and winner recording for completed matches
-- ─────────────────────────────────────────────

alter table matches
  add column if not exists score_player_1 int,
  add column if not exists score_player_2 int,
  add column if not exists winner_id uuid references profiles(id) on delete set null;

comment on column matches.score_player_1 is 'Final score for player 1';
comment on column matches.score_player_2 is 'Final score for player 2';
comment on column matches.winner_id is 'The winning player (references profiles.id)';
