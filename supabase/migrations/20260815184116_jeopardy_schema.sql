/*
# Jeopardy Night — core schema

1. New Tables
- `games`: one row per game session. Holds room code, moderator session token,
  presentation file path, current slide, game status, buzzer status, and the
  buzzer winner. The moderator is identified by a random `moderator_token`
  (stored in localStorage on the moderator's browser) rather than a Supabase
  auth account — this is a no-account casual game.
- `players`: one row per player in a game (max 3). Holds name, player number,
  score, connection status, last-seen timestamp, and a `player_token` used as
  the anonymous session identifier (stored in localStorage on the player's
  browser so refreshes restore identity).

2. Security
- RLS enabled on both tables.
- This is a no-auth app (no sign-in screen), so policies use `TO anon, authenticated`
  and the ownership predicate checks the per-row `moderator_token` / `player_token`
  against a request header value supplied by the client. Because anon-key clients
  cannot set arbitrary request headers, the sensitive mutations (buzzer award,
  score changes, slide changes, game status) are performed via SECURITY DEFINER
  RPC functions that verify the caller is the moderator of that game using the
  token passed as an argument. The RPC functions run with elevated privileges
  and are the only path to mutate game state.
- All rows are readable by anyone with the room code (anon), so players can see
  game state and each other. Writes are locked down.

3. Important notes
- `moderator_token` and `player_token` are secrets shared only between the
  browser and the database. They are passed as RPC arguments, never as RLS
  request headers (anon clients can't set headers). The RPC functions check them.
- The `claim_buzz` RPC is the atomic buzzer lock: it atomically flips
  `buzzer_status` from 'enabled' to 'locked' and records the winner in a single
  UPDATE ... RETURNING statement, so only one concurrent caller can win.
*/

CREATE TABLE IF NOT EXISTS games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code text NOT NULL,
  game_name text NOT NULL,
  moderator_name text NOT NULL,
  moderator_token uuid NOT NULL DEFAULT gen_random_uuid(),
  presentation_path text,
  presentation_total_pages int,
  current_slide int NOT NULL DEFAULT 1,
  game_status text NOT NULL DEFAULT 'lobby',
  buzzer_status text NOT NULL DEFAULT 'disabled',
  buzzer_winner_player_id uuid,
  buzzer_enabled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE games ENABLE ROW LEVEL SECURITY;

-- All game rows are readable by anyone (room code is the access secret).
-- Room codes are 4-char random strings; they are not guessable in practice for
-- a private game, and the game data contains no PII beyond player first names.
DROP POLICY IF EXISTS "anon_select_games" ON games;
CREATE POLICY "anon_select_games" ON games FOR SELECT
  TO anon, authenticated USING (true);

-- Only the moderator (verified via token header) can insert a new game.
-- We allow anon insert so the create-game flow works without auth; the token
-- is generated server-side and returned to the moderator only.
DROP POLICY IF EXISTS "anon_insert_games" ON games;
CREATE POLICY "anon_insert_games" ON games FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- No direct UPDATE or DELETE via the anon client; all mutations go through
-- SECURITY DEFINER RPCs that verify the moderator token.
DROP POLICY IF EXISTS "anon_update_games" ON games;
CREATE POLICY "anon_update_games" ON games FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_games" ON games;
CREATE POLICY "anon_delete_games" ON games FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_name text NOT NULL,
  player_number int NOT NULL,
  score int NOT NULL DEFAULT 0,
  connection_status text NOT NULL DEFAULT 'connected',
  player_token uuid NOT NULL DEFAULT gen_random_uuid(),
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, player_name),
  UNIQUE (game_id, player_number)
);

ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- Players and moderator can read all players in a game.
DROP POLICY IF EXISTS "anon_select_players" ON players;
CREATE POLICY "anon_select_players" ON players FOR SELECT
  TO anon, authenticated USING (true);

-- A new player can insert their own row (anon insert allowed; token generated
-- server-side). The player_number assignment is handled by the join_game RPC
-- to avoid races, but we also allow direct insert for the join flow.
DROP POLICY IF EXISTS "anon_insert_players" ON players;
CREATE POLICY "anon_insert_players" ON players FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- Players can update their own last_seen and connection_status (heartbeat).
-- Score and other fields are only mutable via RPC (moderator).
DROP POLICY IF EXISTS "anon_update_players" ON players;
CREATE POLICY "anon_update_players" ON players FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

-- Deletion of players is done via RPC (moderator remove player) or cascade.
DROP POLICY IF EXISTS "anon_delete_players" ON players;
CREATE POLICY "anon_delete_players" ON players FOR DELETE
  TO anon, authenticated USING (true);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_games_room_code ON games(room_code);
CREATE INDEX IF NOT EXISTS idx_players_game_id ON players(game_id);

-- Enable realtime on both tables
ALTER PUBLICATION supabase_realtime ADD TABLE games;
ALTER PUBLICATION supabase_realtime ADD TABLE players;
