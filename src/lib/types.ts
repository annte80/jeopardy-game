export type GameStatus =
  | 'lobby'
  | 'playing'
  | 'ended';

export type BuzzerStatus =
  | 'disabled'
  | 'enabled'
  | 'locked';

export type ConnectionStatus =
  | 'connected'
  | 'disconnected';

export interface Game {
  id: string;
  room_code: string;
  game_name: string;
  moderator_name: string;
  moderator_token: string;
  presentation_path: string | null;
  presentation_total_pages: number | null;
  current_slide: number;
  game_status: GameStatus;
  buzzer_status: BuzzerStatus;
    buzzer_winner_player_id: string | null;
  buzzer_enabled_at: string | null;
  buzz_order: string[];
  // Used hyperlinks on the main 10+ link slide
  used_main_slide_links: string[];

  created_at: string;
  updated_at: string;
}

export interface Player {
  id: string;
  game_id: string;
  player_name: string;
  player_number: number;
  score: number;
  connection_status: ConnectionStatus;
  player_token: string;

  // Player profile picture URL
  player_avatar_url: string | null;

  joined_at: string;
  last_seen: string;
}

export interface ModeratorSession {
  gameId: string;
  moderatorToken: string;
  roomCode: string;
  gameName: string;
  moderatorName: string;
}

export interface PlayerSession {
  playerId: string;
  gameId: string;
  playerToken: string;
  playerName: string;
  playerNumber: number;
  roomCode: string;

  // Player profile picture URL
  playerAvatarUrl: string | null;
}

export interface ChatMessage {
  id: string;
  sender_type: 'player' | 'moderator';
  sender_id: string | null;
  sender_name: string;
  body: string;
  created_at: string;
}
