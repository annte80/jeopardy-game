import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from './supabase';
import type { Game, Player } from './types';
import { fetchGame, fetchPlayers, heartbeat } from './gameApi';

// Fast safety-net polling.
// Realtime should update instantly, but this guarantees the buzzer state
// reaches every screen even if Supabase Realtime misses an event.
const GAME_POLL_INTERVAL_MS = 750;
const PLAYER_POLL_INTERVAL_MS = 2000;
const RESUBSCRIBE_DELAY_MS = 1000;

// ---------- Game subscription ----------

export function useGame(gameId: string | null): {
  game: Game | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!gameId) {
      setGame(null);
      setLoading(false);
      return;
    }

    try {
      const freshGame = await fetchGame(gameId);

      if (freshGame) {
        setGame((previous) => {
          // Keep the newest database state.
          // This is especially important for buzzer_status and
          // buzzer_winner_player_id.
          return freshGame;
        });
      }

      setError(null);
    } catch (e) {
      console.error('useGame: refetch error', e);
      setError(e instanceof Error ? e.message : 'Failed to load game');
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    if (!gameId) {
      setGame(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let resubscribeTimer: ReturnType<typeof setTimeout> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const loadGame = async () => {
      try {
        const freshGame = await fetchGame(gameId);

        if (cancelled || !freshGame) return;

        setGame(freshGame);
        setError(null);
      } catch (e) {
        if (cancelled) return;

        console.error('useGame: fetch error', e);
        setError(
          e instanceof Error ? e.message : 'Failed to load game'
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    const subscribe = () => {
      if (cancelled) return;

      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }

      channel = supabase
        .channel(`game-state-${gameId}-${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'games',
            filter: `id=eq.${gameId}`,
          },
          (payload) => {
            if (cancelled) return;

            if (payload.eventType === 'UPDATE' && payload.new) {
              // Immediately apply the database update.
              setGame(payload.new as Game);
              setError(null);
            }

            if (payload.eventType === 'INSERT' && payload.new) {
              setGame(payload.new as Game);
              setError(null);
            }

            // DELETE should clear the game.
            if (payload.eventType === 'DELETE') {
              setGame(null);
            }
          }
        )
        .subscribe((status) => {
          if (cancelled) return;

          if (status === 'SUBSCRIBED') {
            console.log('Game realtime connected:', gameId);
            return;
          }

          if (
            status === 'CHANNEL_ERROR' ||
            status === 'TIMED_OUT' ||
            status === 'CLOSED'
          ) {
            console.warn(
              'Game realtime disconnected. Reconnecting...',
              status
            );

            if (resubscribeTimer) {
              clearTimeout(resubscribeTimer);
            }

            resubscribeTimer = setTimeout(() => {
              if (!cancelled) {
                subscribe();
              }
            }, RESUBSCRIBE_DELAY_MS);
          }
        });
    };

    setLoading(true);

    // Initial state.
    loadGame();

    // Realtime.
    subscribe();

    // VERY FAST fallback polling.
    // This makes buzzer state converge even if Realtime is unavailable.
    pollTimer = setInterval(() => {
      if (!cancelled) {
        loadGame();
      }
    }, GAME_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;

      if (pollTimer) {
        clearInterval(pollTimer);
      }

      if (resubscribeTimer) {
        clearTimeout(resubscribeTimer);
      }

      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [gameId]);

  return {
    game,
    loading,
    error,
    refetch,
  };
}

// ---------- Players subscription ----------

export function usePlayers(gameId: string | null): {
  players: Player[];
  loading: boolean;
  refetch: () => Promise<void>;
} {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!gameId) {
      setPlayers([]);
      setLoading(false);
      return;
    }

    try {
      const freshPlayers = await fetchPlayers(gameId);
      setPlayers(freshPlayers);
    } catch (e) {
      console.error('usePlayers: fetch error', e);
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    if (!gameId) {
      setPlayers([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let resubscribeTimer: ReturnType<typeof setTimeout> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const loadPlayers = async () => {
      try {
        const freshPlayers = await fetchPlayers(gameId);

        if (!cancelled) {
          setPlayers(freshPlayers);
        }
      } catch (e) {
        console.error('usePlayers: fetch error', e);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    const subscribe = () => {
      if (cancelled) return;

      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }

      channel = supabase
        .channel(`players-state-${gameId}-${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'players',
            filter: `game_id=eq.${gameId}`,
          },
          () => {
            if (!cancelled) {
              loadPlayers();
            }
          }
        )
        .subscribe((status) => {
          if (cancelled) return;

          if (
            status === 'CHANNEL_ERROR' ||
            status === 'TIMED_OUT' ||
            status === 'CLOSED'
          ) {
            if (resubscribeTimer) {
              clearTimeout(resubscribeTimer);
            }

            resubscribeTimer = setTimeout(() => {
              if (!cancelled) {
                subscribe();
              }
            }, RESUBSCRIBE_DELAY_MS);
          }
        });
    };

    setLoading(true);

    loadPlayers();
    subscribe();

    pollTimer = setInterval(() => {
      if (!cancelled) {
        loadPlayers();
      }
    }, PLAYER_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;

      if (pollTimer) {
        clearInterval(pollTimer);
      }

      if (resubscribeTimer) {
        clearTimeout(resubscribeTimer);
      }

      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [gameId]);

  return {
    players,
    loading,
    refetch,
  };
}

// ---------- Player heartbeat ----------

export function useHeartbeat(
  playerId: string | null,
  playerToken: string | null
): void {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!playerId || !playerToken) return;

    heartbeat(playerId, playerToken).catch((e) => {
      console.error('useHeartbeat: error', e);
    });

    intervalRef.current = setInterval(() => {
      heartbeat(playerId, playerToken).catch((e) => {
        console.error('useHeartbeat: error', e);
      });
    }, 10000);

    const handleUnload = () => {
      supabase.rpc('mark_disconnect', {
        p_player_id: playerId,
        p_player_token: playerToken,
      });
    };

    window.addEventListener('beforeunload', handleUnload);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [playerId, playerToken]);
}

// ---------- Connection status ----------

export function useConnectionStatus():
  | 'connected'
  | 'reconnecting'
  | 'disconnected' {
  const [status, setStatus] = useState<
    'connected' | 'reconnecting' | 'disconnected'
  >('connected');

  useEffect(() => {
    const channel = supabase
      .channel(`connection-monitor-${Date.now()}`)
      .subscribe((subStatus) => {
        if (subStatus === 'SUBSCRIBED') {
          setStatus('connected');
        } else if (
          subStatus === 'CHANNEL_ERROR' ||
          subStatus === 'TIMED_OUT' ||
          subStatus === 'CLOSED'
        ) {
          setStatus('reconnecting');
        }
      });

    const handleOnline = () => {
      setStatus('connected');
    };

    const handleOffline = () => {
      setStatus('disconnected');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return status;
}