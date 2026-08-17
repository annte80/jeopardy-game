/*
# Fix ambiguous column references in create_game and join_game

When a function RETURNS TABLE with a column named `id`, PostgreSQL treats `id`
as a PL/pgSQL variable, making `RETURNING id` ambiguous against table columns.
Qualify RETURNING columns with the table name.
*/

CREATE OR REPLACE FUNCTION create_game(p_game_name text, p_moderator_name text)
RETURNS TABLE (
  id uuid, room_code text, game_name text, moderator_name text,
  moderator_token uuid, game_status text
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  new_id uuid;
  new_code text;
  new_token uuid;
BEGIN
  new_code := generate_room_code();
  new_token := gen_random_uuid();
  INSERT INTO games (room_code, game_name, moderator_name, moderator_token, game_status)
  VALUES (new_code, p_game_name, p_moderator_name, new_token, 'lobby')
  RETURNING games.id, games.moderator_token INTO new_id, new_token;
  RETURN QUERY
    SELECT new_id AS id, new_code AS room_code, p_game_name AS game_name,
           p_moderator_name AS moderator_name, new_token AS moderator_token,
           'lobby' AS game_status;
END;
$$;

CREATE OR REPLACE FUNCTION join_game(p_room_code text, p_player_name text)
RETURNS TABLE (
  id uuid, game_id uuid, player_name text, player_number int,
  score int, player_token uuid
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_game games%ROWTYPE;
  v_next_num int;
  v_player_id uuid;
  v_token uuid;
BEGIN
  SELECT * INTO v_game FROM games WHERE room_code = upper(p_room_code);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_game.game_status = 'ended' THEN
    RAISE EXCEPTION 'This game has ended' USING ERRCODE = 'P0003';
  END IF;
  IF v_game.game_status = 'playing' THEN
    RAISE EXCEPTION 'This game has already started' USING ERRCODE = 'P0004';
  END IF;

  IF EXISTS (SELECT 1 FROM players WHERE game_id = v_game.id AND player_name = p_player_name) THEN
    RAISE EXCEPTION 'That player name is already being used.' USING ERRCODE = 'P0005';
  END IF;

  SELECT COALESCE(MAX(player_number), 0) + 1 INTO v_next_num
  FROM players WHERE game_id = v_game.id;
  IF v_next_num > 3 THEN
    RAISE EXCEPTION 'This game already has 3 players.' USING ERRCODE = 'P0006';
  END IF;

  v_token := gen_random_uuid();
  INSERT INTO players (game_id, player_name, player_number, score, connection_status, player_token)
  VALUES (v_game.id, p_player_name, v_next_num, 0, 'connected', v_token)
  RETURNING players.id, players.player_token INTO v_player_id, v_token;

  RETURN QUERY
    SELECT v_player_id AS id, v_game.id AS game_id, p_player_name AS player_name,
           v_next_num AS player_number, 0 AS score, v_token AS player_token;
END;
$$;
