import { supabase } from './supabase';
import type {
  Game,
  Player,
  ModeratorSession,
  PlayerSession,
  ChatMessage,
} from './types';

const MOD_SESSION_KEY = 'jeopardy_mod_session';
const PLAYER_SESSION_KEY = 'jeopardy_player_session';

// ---------- Session persistence ----------

export function saveModeratorSession(
  session: ModeratorSession
): void {
  localStorage.setItem(
    MOD_SESSION_KEY,
    JSON.stringify(session)
  );
}

export function getModeratorSession(): ModeratorSession | null {
  const raw = localStorage.getItem(MOD_SESSION_KEY);

  if (!raw) return null;

  try {
    return JSON.parse(raw) as ModeratorSession;
  } catch {
    return null;
  }
}

export function clearModeratorSession(): void {
  localStorage.removeItem(MOD_SESSION_KEY);
}

export function savePlayerSession(
  session: PlayerSession
): void {
  localStorage.setItem(
    PLAYER_SESSION_KEY,
    JSON.stringify(session)
  );
}

export function getPlayerSession(): PlayerSession | null {
  const raw = localStorage.getItem(PLAYER_SESSION_KEY);

  if (!raw) return null;

  try {
    return JSON.parse(raw) as PlayerSession;
  } catch {
    return null;
  }
}

export function clearPlayerSession(): void {
  localStorage.removeItem(PLAYER_SESSION_KEY);
}

// ---------- Game creation ----------

export async function createGame(
  gameName: string,
  moderatorName: string
): Promise<ModeratorSession> {
  const { data, error } = await supabase.rpc(
    'create_game',
    {
      p_game_name: gameName,
      p_moderator_name: moderatorName,
    }
  );

  if (error) {
    throw new Error(error.message);
  }

  if (!data || data.length === 0) {
    throw new Error('Failed to create game');
  }

  const row = data[0];

  const session: ModeratorSession = {
    gameId: row.id,
    moderatorToken: row.moderator_token,
    roomCode: row.room_code,
    gameName: row.game_name,
    moderatorName: row.moderator_name,
  };

  saveModeratorSession(session);

  return session;
}

// ---------- Player avatar upload ----------

export async function uploadPlayerAvatar(
  gameId: string,
  playerId: string,
  file: File
): Promise<string> {
  let extension: string;

  if (file.type === 'image/png') {
    extension = 'png';
  } else if (
    file.type === 'image/jpeg' ||
    file.type === 'image/jpg'
  ) {
    extension = 'jpg';
  } else {
    throw new Error(
      'Please upload a PNG or JPG image.'
    );
  }

  const maxSize = 5 * 1024 * 1024;

  if (file.size > maxSize) {
    throw new Error(
      'Profile picture must be smaller than 5 MB.'
    );
  }

  const fileName =
    gameId +
    '/' +
    playerId +
    '.' +
    extension;

  const { error: uploadError } =
    await supabase.storage
      .from('player-avatars')
      .upload(fileName, file, {
        upsert: true,
        contentType: file.type,
        cacheControl: '3600',
      });

  if (uploadError) {
    console.error(
      'Avatar upload error:',
      uploadError
    );

    throw new Error(
      'Unable to upload profile picture. Please try again.'
    );
  }

  const { data } =
    supabase.storage
      .from('player-avatars')
      .getPublicUrl(fileName);

  if (!data?.publicUrl) {
    throw new Error(
      'Unable to create profile picture URL.'
    );
  }

  return data.publicUrl;
}

// ---------- Convert data URL to File ----------

async function dataUrlToFile(
  dataUrl: string,
  fileName: string
): Promise<File> {
  const response = await fetch(dataUrl);

  if (!response.ok) {
    throw new Error(
      'Failed to process uploaded avatar.'
    );
  }

  const blob = await response.blob();

  return new File(
    [blob],
    fileName,
    {
      type: blob.type || 'image/jpeg',
    }
  );
}

// ---------- Player join ----------

export async function joinGame(
  roomCode: string,
  playerName: string,
  playerAvatarUrl: string | null = null
): Promise<PlayerSession> {
  const normalizedRoomCode =
    roomCode.trim().toUpperCase();

  let finalAvatarUrl: string | null =
    playerAvatarUrl;

  const isUploadedImage =
    typeof playerAvatarUrl === 'string' &&
    playerAvatarUrl.startsWith('data:image/');

  if (
    finalAvatarUrl &&
    !isUploadedImage
  ) {
    // Built-in avatar such as:
    // /avatars/avatar-1.png
  }

  const { data, error } =
    await supabase.rpc(
      'join_game',
      {
        p_room_code: normalizedRoomCode,
        p_player_name: playerName,
        p_player_avatar_url:
          isUploadedImage
            ? null
            : finalAvatarUrl,
      }
    );

  if (error) {
    if (
      error.message.includes(
        'already being used'
      )
    ) {
      throw new Error(
        'That player name is already being used.'
      );
    }

    if (
      error.message
        .toLowerCase()
        .includes('not found')
    ) {
      throw new Error(
        'Game not found.'
      );
    }

    if (
      error.message
        .toLowerCase()
        .includes('ended')
    ) {
      throw new Error(
        'This game has ended.'
      );
    }

    if (
      error.message
        .toLowerCase()
        .includes('already started')
    ) {
      throw new Error(
        'This game has already started.'
      );
    }

    if (
      error.message
        .toLowerCase()
        .includes('3 players')
    ) {
      throw new Error(
        'This game already has 3 players.'
      );
    }

    throw new Error(error.message);
  }

  if (!data || data.length === 0) {
    throw new Error(
      'Failed to join game'
    );
  }

  const row = data[0];

  if (isUploadedImage) {
    try {
      const file =
        await dataUrlToFile(
          playerAvatarUrl!,
          'avatar'
        );

      finalAvatarUrl =
        await uploadPlayerAvatar(
          row.game_id,
          row.id,
          file
        );

      const { error: updateError } =
        await supabase
          .from('players')
          .update({
            player_avatar_url:
              finalAvatarUrl,
          })
          .eq('id', row.id);

      if (updateError) {
        console.error(
          'Avatar URL update error:',
          updateError
        );

        throw new Error(
          'Player joined, but the profile picture could not be saved.'
        );
      }
    } catch (avatarError) {
      console.error(
        'Avatar processing error:',
        avatarError
      );

      throw new Error(
        avatarError instanceof Error
          ? avatarError.message
          : 'Player joined, but the profile picture could not be uploaded.'
      );
    }
  }

  const session: PlayerSession = {
    playerId: row.id,
    gameId: row.game_id,
    playerToken: row.player_token,
    playerName: row.player_name,
    playerNumber: row.player_number,
    roomCode: normalizedRoomCode,
    playerAvatarUrl:
      finalAvatarUrl,
  };

  savePlayerSession(session);

  return session;
}

// ---------- Data fetching ----------

export async function fetchGame(
  gameId: string
): Promise<Game | null> {
  const { data, error } =
    await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as Game | null;
}

export async function fetchGameByRoomCode(
  roomCode: string
): Promise<Game | null> {
  const { data, error } =
    await supabase
      .from('games')
      .select('*')
      .eq(
        'room_code',
        roomCode.trim().toUpperCase()
      )
      .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as Game | null;
}

export async function fetchPlayers(
  gameId: string
): Promise<Player[]> {
  const { data, error } =
    await supabase
      .from('players')
      .select('*')
      .eq('game_id', gameId)
      .order('player_number', {
        ascending: true,
      });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as Player[];
}

// ---------- Chat ----------

export async function fetchMessages(
  gameId: string
): Promise<ChatMessage[]> {
  const { data, error } =
    await supabase
      .from('messages')
      .select('*')
      .eq('game_id', gameId)
      .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as ChatMessage[];
}

export async function sendChatMessage(
  gameId: string,
  senderToken: string,
  body: string
): Promise<ChatMessage> {
  const { data, error } =
    await supabase.rpc('send_chat_message', {
      p_game_id: gameId,
      p_sender_token: senderToken,
      p_body: body,
    });

  if (error) {
    throw new Error(error.message);
  }

  return (data as ChatMessage[])[0];
}

// ---------- Presentation upload ----------

export async function uploadPresentation(
  gameId: string,
  moderatorToken: string,
  file: File
): Promise<{
  path: string;
  totalPages: number | null;
}> {
  const fileExt =
    file.name
      .split('.')
      .pop()
      ?.toLowerCase() || 'pdf';

  const fileName =
    gameId +
    '/presentation.' +
    fileExt;

  const { error: uploadError } =
    await supabase.storage
      .from('presentations')
      .upload(
        fileName,
        file,
        {
          upsert: true,
        }
      );

  if (uploadError) {
    throw new Error(
      'Unable to upload presentation. Please try again.'
    );
  }

  let totalPages: number | null =
    null;

  if (fileExt === 'pdf') {
    try {
      const arrayBuffer =
        await file.arrayBuffer();

      const pdfjs =
        await import('pdfjs-dist');

      pdfjs.GlobalWorkerOptions.workerSrc =
        new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url
        ).toString();

      const pdf =
        await pdfjs
          .getDocument({
            data: arrayBuffer,
          })
          .promise;

      totalPages =
        pdf.numPages;
    } catch {
      totalPages = null;
    }
  }

  const {
    error: rpcError,
  } = await supabase.rpc(
    'mod_set_presentation',
    {
      p_game_id: gameId,
      p_mod_token: moderatorToken,
      p_path: fileName,
      p_pages: totalPages,
    }
  );

  if (rpcError) {
    throw new Error(
      'Failed to save presentation info.'
    );
  }

  return {
    path: fileName,
    totalPages,
  };
}

export function getPresentationUrl(
  path: string
): string {
  const { data } =
    supabase.storage
      .from('presentations')
      .getPublicUrl(path);

  return data.publicUrl;
}

// ---------- Moderator actions ----------

export async function modSetSlide(
  gameId: string,
  moderatorToken: string,
  slide: number
): Promise<void> {
  const { error } =
    await supabase.rpc(
      'mod_set_slide',
      {
        p_game_id: gameId,
        p_mod_token: moderatorToken,
        p_slide: slide,
      }
    );

  if (error) {
    throw new Error(error.message);
  }
}

// ---------- MAIN SLIDE LINK TRACKING ----------

export async function modMarkMainSlideLinkUsed(
  gameId: string,
  moderatorToken: string,
  linkId: string
): Promise<void> {
  const { error } =
    await supabase.rpc(
      'mod_mark_main_slide_link_used',
      {
        p_game_id: gameId,
        p_mod_token: moderatorToken,
        p_link_id: linkId,
      }
    );

  if (error) {
    throw new Error(error.message);
  }
}

export async function modSetGameStatus(
  gameId: string,
  moderatorToken: string,
  status:
    | 'lobby'
    | 'playing'
    | 'ended'
): Promise<void> {
  const { error } =
    await supabase.rpc(
      'mod_set_game_status',
      {
        p_game_id: gameId,
        p_mod_token: moderatorToken,
        p_status: status,
      }
    );

  if (error) {
    throw new Error(error.message);
  }
}

export async function modSetBuzzer(
  gameId: string,
  moderatorToken: string,
  status:
    | 'enabled'
    | 'disabled'
    | 'resetting'
): Promise<void> {
  const { error } =
    await supabase.rpc(
      'mod_set_buzzer',
      {
        p_game_id: gameId,
        p_mod_token: moderatorToken,
        p_status: status,
      }
    );

  if (error) {
    throw new Error(error.message);
  }
}

export async function modAdjustScore(
  gameId: string,
  moderatorToken: string,
  playerId: string,
  delta: number
): Promise<void> {
  const { error } =
    await supabase.rpc(
      'mod_adjust_score',
      {
        p_game_id: gameId,
        p_mod_token: moderatorToken,
        p_player_id: playerId,
        p_delta: delta,
      }
    );

  if (error) {
    throw new Error(error.message);
  }
}

export async function modRemovePlayer(
  gameId: string,
  moderatorToken: string,
  playerId: string
): Promise<void> {
  const { error } =
    await supabase.rpc(
      'mod_remove_player',
      {
        p_game_id: gameId,
        p_mod_token: moderatorToken,
        p_player_id: playerId,
      }
    );

  if (error) {
    throw new Error(error.message);
  }
}

// ---------- Buzzer ----------

export async function claimBuzz(
  gameId: string,
  playerId: string,
  playerToken: string
): Promise<{
  won: boolean;
  winnerPlayerId: string | null;
  rank: number | null;
  buzzOrder: string[];
}> {
  console.log(
    'BUZZER: sending claim',
    {
      gameId,
      playerId,
    }
  );

  const {
    data,
    error,
  } = await supabase.rpc(
    'claim_buzz',
    {
      p_game_id: gameId,
      p_player_id: playerId,
      p_player_token: playerToken,
    }
  );

  console.log(
    'BUZZER: response',
    {
      data,
      error,
    }
  );

  if (error) {
    console.error(
      'BUZZER RPC ERROR:',
      error
    );

    throw new Error(
      `Buzzer failed: ${error.message}`
    );
  }

  if (
    !data ||
    data.length === 0
  ) {
    console.error(
      'BUZZER: no response from claim_buzz'
    );

    throw new Error(
      'Buzzer returned no result'
    );
  }

  const row = data[0];

  console.log(
    'BUZZER: result',
    {
      won: row.won,
      winnerPlayerId:
        row.winner_player_id,
      buzzerStatus:
        row.buzzer_status,
    }
  );

    return {
    won: Boolean(row.won),
    winnerPlayerId:
      row.winner_player_id ??
      null,
    rank: row.rank ?? null,
    buzzOrder: row.buzz_order ?? [],
  };
}

// ---------- Player heartbeat ----------

export async function heartbeat(
  playerId: string,
  playerToken: string
): Promise<void> {
  await supabase.rpc(
    'heartbeat',
    {
      p_player_id: playerId,
      p_player_token: playerToken,
    }
  );
}

export async function markDisconnect(
  playerId: string,
  playerToken: string
): Promise<void> {
  await supabase.rpc(
    'mark_disconnect',
    {
      p_player_id: playerId,
      p_player_token: playerToken,
    }
  );
}
