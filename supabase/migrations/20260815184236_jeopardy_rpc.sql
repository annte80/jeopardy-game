/*
# Jeopardy Night — RPC functions

All SECURITY DEFINER. Moderator functions verify moderator_token. claim_buzz
is the atomic buzzer lock using UPDATE...WHERE buzzer_status='enabled'.
*/

CREATE OR REPLACE FUNCTION generate_room_code()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text := '';
  i int;
  exists boolean;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..4 LOOP
      code := code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    END LOOP;
    SELECT EXISTS(SELECT 1 FROM games WHERE room_code = code) INTO exists;
    EXIT WHEN NOT exists;
  END LOOP;
  RETURN code;
END;
$$;

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

CREATE OR REPLACE FUNCTION claim_buzz(p_game_id uuid, p_player_id uuid, p_player_token uuid)
RETURNS TABLE (
  won boolean, game_id uuid, winner_player_id uuid, buzzer_status text
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_game games%ROWTYPE;
  v_player players%ROWTYPE;
  v_winner uuid;
  v_status text;
BEGIN
  SELECT * INTO v_game FROM games WHERE id = p_game_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, 'error'::text;
    RETURN;
  END IF;

  SELECT * INTO v_player FROM players WHERE id = p_player_id AND player_token = p_player_token AND game_id = p_game_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, p_game_id, NULL::uuid, v_game.buzzer_status;
    RETURN;
  END IF;

  UPDATE games
    SET buzzer_status = 'locked',
        buzzer_winner_player_id = p_player_id,
        buzzer_enabled_at = NULL,
        updated_at = now()
    WHERE id = p_game_id AND buzzer_status = 'enabled'
    RETURNING buzzer_winner_player_id, buzzer_status INTO v_winner, v_status;

  IF v_winner IS NOT NULL THEN
    RETURN QUERY SELECT true, p_game_id, v_winner, v_status;
  ELSE
    RETURN QUERY SELECT false, p_game_id, v_game.buzzer_winner_player_id, v_game.buzzer_status;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION mod_set_slide(p_game_id uuid, p_mod_token uuid, p_slide int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_game games%ROWTYPE;
BEGIN
  SELECT * INTO v_game FROM games WHERE id = p_game_id;
  IF NOT FOUND OR v_game.moderator_token != p_mod_token THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
  END IF;
  UPDATE games SET current_slide = GREATEST(1, p_slide), updated_at = now() WHERE id = p_game_id;
END;
$$;

CREATE OR REPLACE FUNCTION mod_set_game_status(p_game_id uuid, p_mod_token uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_game games%ROWTYPE;
BEGIN
  SELECT * INTO v_game FROM games WHERE id = p_game_id;
  IF NOT FOUND OR v_game.moderator_token != p_mod_token THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
  END IF;
  UPDATE games SET game_status = p_status, updated_at = now() WHERE id = p_game_id;
END;
$$;

CREATE OR REPLACE FUNCTION mod_set_buzzer(p_game_id uuid, p_mod_token uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_game games%ROWTYPE;
BEGIN
  SELECT * INTO v_game FROM games WHERE id = p_game_id;
  IF NOT FOUND OR v_game.moderator_token != p_mod_token THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
  END IF;
  IF p_status = 'enabled' THEN
    UPDATE games
      SET buzzer_status = 'enabled',
          buzzer_winner_player_id = NULL,
          buzzer_enabled_at = now(),
          updated_at = now()
      WHERE id = p_game_id;
  ELSIF p_status = 'disabled' THEN
    UPDATE games
      SET buzzer_status = 'disabled',
          buzzer_enabled_at = NULL,
          updated_at = now()
      WHERE id = p_game_id;
  ELSIF p_status = 'resetting' THEN
    UPDATE games
      SET buzzer_status = 'disabled',
          buzzer_winner_player_id = NULL,
          buzzer_enabled_at = NULL,
          updated_at = now()
      WHERE id = p_game_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION mod_adjust_score(p_game_id uuid, p_mod_token uuid, p_player_id uuid, p_delta int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_game games%ROWTYPE;
BEGIN
  SELECT * INTO v_game FROM games WHERE id = p_game_id;
  IF NOT FOUND OR v_game.moderator_token != p_mod_token THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
  END IF;
  UPDATE players
    SET score = GREATEST(0, score + p_delta)
    WHERE id = p_player_id AND game_id = p_game_id;
END;
$$;

CREATE OR REPLACE FUNCTION mod_remove_player(p_game_id uuid, p_mod_token uuid, p_player_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_game games%ROWTYPE;
BEGIN
  SELECT * INTO v_game FROM games WHERE id = p_game_id;
  IF NOT FOUND OR v_game.moderator_token != p_mod_token THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
  END IF;
  DELETE FROM players WHERE id = p_player_id AND game_id = p_game_id;
END;
$$;

CREATE OR REPLACE FUNCTION heartbeat(p_player_id uuid, p_player_token uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE players
    SET last_seen = now(), connection_status = 'connected'
    WHERE id = p_player_id AND player_token = p_player_token;
END;
$$;

CREATE OR REPLACE FUNCTION mark_disconnect(p_player_id uuid, p_player_token uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE players
    SET connection_status = 'disconnected'
    WHERE id = p_player_id AND player_token = p_player_token;
END;
$$;

CREATE OR REPLACE FUNCTION mod_set_presentation(p_game_id uuid, p_mod_token uuid, p_path text, p_pages int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_game games%ROWTYPE;
BEGIN
  SELECT * INTO v_game FROM games WHERE id = p_game_id;
  IF NOT FOUND OR v_game.moderator_token != p_mod_token THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
  END IF;
  UPDATE games
    SET presentation_path = p_path,
        presentation_total_pages = p_pages,
        current_slide = 1,
        updated_at = now()
    WHERE id = p_game_id;
END;
$$;

GRANT EXECUTE ON FUNCTION generate_room_code() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION create_game(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION join_game(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_buzz(uuid, uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION mod_set_slide(uuid, uuid, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION mod_set_game_status(uuid, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION mod_set_buzzer(uuid, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION mod_adjust_score(uuid, uuid, uuid, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION mod_remove_player(uuid, uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION heartbeat(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION mark_disconnect(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION mod_set_presentation(uuid, uuid, text, int) TO anon, authenticated;
