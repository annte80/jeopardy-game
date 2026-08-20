import { useState } from 'react';
import { Users, Play, AlertTriangle, Loader2, ArrowLeft, Crown } from 'lucide-react';
import { useGame, usePlayers, useHeartbeat, useConnectionStatus } from '@/lib/hooks';
import { RoomCode } from './RoomCode';
import { PlayerList } from './PlayerList';
import { ConnectionIndicator } from './ConnectionIndicator';
import { useToast } from './Toast';
import { modSetGameStatus, modRemovePlayer } from '@/lib/gameApi';
import type { ModeratorSession, PlayerSession } from '@/lib/types';

interface ModeratorLobbyProps {
  session: ModeratorSession;
  onStart: () => void;
  onLeave: () => void;
}

export function ModeratorLobby({ session, onStart, onLeave }: ModeratorLobbyProps) {
  const { game, loading } = useGame(session.gameId);
  console.log('MOD LOBBY:', { loading, game });
  const { players, refetch } = usePlayers(session.gameId);
  const connectionStatus = useConnectionStatus();
  const [starting, setStarting] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const { show } = useToast();

  const joinUrl = `${window.location.origin}/join/${session.roomCode}`;
  const playerCount = players.length;
  const hasPresentation = !!game?.presentation_path;

  const handleStart = async () => {
    setStarting(true);
    try {
      await modSetGameStatus(session.gameId, session.moderatorToken, 'playing');
      show('Game started!', 'success');
      onStart();
    } catch (e) {
      show(e instanceof Error ? e.message : 'Failed to start game', 'error');
    } finally {
      setStarting(false);
    }
  };

  const handleRemovePlayer = async (playerId: string) => {
    try {
      await modRemovePlayer(session.gameId, session.moderatorToken, playerId);
      show('Player removed.', 'info');
      refetch();
    } catch (e) {
      show(e instanceof Error ? e.message : 'Failed to remove player', 'error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-game flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-game flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 md:px-8 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Crown className="w-5 h-5 text-amber-400" />
          <h1 className="text-white font-bold text-lg">{session.gameName}</h1>
        </div>
        <div className="flex items-center gap-3">
          <ConnectionIndicator status={connectionStatus} compact />
          <button
            onClick={() => setConfirmLeave(true)}
            className="text-slate-500 hover:text-red-400 text-sm font-medium transition-colors"
          >
            Leave
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center px-6 py-8">
        <div className="w-full max-w-2xl flex flex-col items-center gap-8">
          {/* Room code */}
          <div className="w-full animate-slide-up">
            <RoomCode code={session.roomCode} joinUrl={joinUrl} size="lg" />
          </div>

          <p className="text-slate-400 text-sm">
            Share this link with your players.
          </p>

          {/* Player slots */}
          <div className="w-full">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-blue-400" />
              <h2 className="text-white font-bold text-lg">Players</h2>
              <span className="text-slate-500 text-sm">({playerCount}/8)</span>
            </div>
            <PlayerList
              players={players}
              onRemovePlayer={handleRemovePlayer}
              showRemove
            />
          </div>

          {/* Warnings */}
          {!hasPresentation && (
            <div className="flex items-center gap-2 text-amber-400 text-sm bg-amber-500/10 px-4 py-2 rounded-xl border border-amber-500/30">
              <AlertTriangle className="w-4 h-4" />
              No presentation uploaded yet.
            </div>
          )}
          {hasPresentation && playerCount < 3 && (
            <div className="flex items-center gap-2 text-amber-400 text-sm bg-amber-500/10 px-4 py-2 rounded-xl border border-amber-500/30">
              <AlertTriangle className="w-4 h-4" />
              Need at least 3 players to start ({playerCount}/3 joined).
            </div>
          )}

          {/* Start button */}
          <button
            onClick={() => {
              if (playerCount < 3) {
                show('At least 3 players must join before starting.', 'error');
                return;
              }
              if (!hasPresentation) {
                show('Please upload a presentation before starting.', 'error');
                return;
              }
              handleStart();
            }}
            disabled={starting || playerCount < 3 || !hasPresentation}
            className="w-full max-w-sm flex items-center justify-center gap-2 px-8 py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold text-lg rounded-2xl transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-emerald-500/20 disabled:shadow-none disabled:cursor-not-allowed"
          >
            {starting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Play className="w-5 h-5" />
            )}
            Start Game
          </button>
        </div>
      </main>

      {/* Confirm leave */}
      {confirmLeave && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-in">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-3 bg-red-500/15 text-red-400 rounded-xl">
                <ArrowLeft className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-1">Leave the game?</h3>
                <p className="text-slate-400 text-sm">
                  Players will be disconnected. This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmLeave(false)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-semibold hover:bg-slate-700"
              >
                Stay
              </button>
              <button
                onClick={onLeave}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-500"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Player Lobby ----------

interface PlayerLobbyProps {
  session: PlayerSession;
  onLeave: () => void;
}

export function PlayerLobby({ session, onLeave }: PlayerLobbyProps) {
  const { game, loading } = useGame(session.gameId);
  const { players } = usePlayers(session.gameId);
  const connectionStatus = useConnectionStatus();
  const { show } = useToast();

  useHeartbeat(session.playerId, session.playerToken);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-game flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  // If game moved to playing, the parent will switch views via game subscription
  return (
    <div className="min-h-screen bg-gradient-game flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <h1 className="text-white font-bold text-lg">{game?.game_name || 'Jeopardy Night'}</h1>
        <ConnectionIndicator status={connectionStatus} compact />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="w-full max-w-md flex flex-col items-center gap-6">
          {/* You are in */}
          <div className="text-center animate-celebrate">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-500/15 border-2 border-emerald-500/40 rounded-full mb-4">
              <span className="text-3xl font-black text-emerald-400">{session.playerNumber}</span>
            </div>
            <h2 className="text-3xl font-bold text-white mb-1">YOU ARE IN</h2>
            <p className="text-slate-400 text-lg">
              {session.playerName} — Player {session.playerNumber}
            </p>
          </div>

          <div className="w-full">
            <p className="text-center text-slate-400 mb-4 animate-pulse">
              Waiting for the Game Master to start...
            </p>
          </div>

          {/* Other players */}
          <div className="w-full">
            <h3 className="text-slate-500 text-sm font-bold tracking-wider uppercase mb-3">Players in Room</h3>
            <PlayerList players={players} />
          </div>

          <button
            onClick={() => {
              onLeave();
              show('Left the game.', 'info');
            }}
            className="text-slate-500 hover:text-red-400 text-sm font-medium transition-colors mt-4"
          >
            Leave game
          </button>
        </div>
      </main>
    </div>
  );
}
