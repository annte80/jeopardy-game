import { useState, useEffect } from 'react';
import { Trophy, Medal, Home, Loader2, Crown } from 'lucide-react';
import { usePlayers } from '@/lib/hooks';
import type { ModeratorSession, PlayerSession } from '@/lib/types';

interface GameEndScreenProps {
  gameId: string;
  gameName: string;
  roomCode: string;
  isModerator: boolean;
  onNewGame?: () => void;
  onLeave: () => void;
}

export function GameEndScreen({
  gameId,
  gameName,
  roomCode: _roomCode,
  isModerator,
  onNewGame,
  onLeave,
}: GameEndScreenProps) {
  const { players, loading } = usePlayers(gameId);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 300);
    return () => clearTimeout(timer);
  }, []);

  const sorted = [...players].sort((a, b) => b.score - a.score);
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="min-h-screen bg-gradient-hero flex flex-col">
      {/* Background glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-[150px] animate-pulse" />
      </div>

      <header className="relative z-10 flex items-center justify-center px-6 py-5">
        <div className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-amber-400" />
          <span className="text-white font-bold">{gameName}</span>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-8">
        {loading ? (
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
        ) : (
          <div className={`w-full max-w-2xl flex flex-col items-center gap-8 transition-all ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            {/* Title */}
            <div className="text-center animate-celebrate">
              <Trophy className="w-20 h-20 text-amber-400 mx-auto mb-4 text-glow-gold" />
              <h1 className="text-4xl md:text-6xl font-black text-white mb-2">
                FINAL <span className="text-amber-400 text-glow-gold">SCORES</span>
              </h1>
              <p className="text-slate-400 text-lg">The game has ended</p>
            </div>

            {/* Scoreboard */}
            <div className="w-full flex flex-col gap-3">
              {sorted.map((p, idx) => (
                <div
                  key={p.id}
                  className={`flex items-center gap-4 px-6 py-5 rounded-2xl border transition-all animate-slide-up ${
                    idx === 0
                      ? 'bg-amber-500/15 border-amber-500/50 scale-105 shadow-lg shadow-amber-500/10'
                      : 'bg-slate-900/60 border-slate-700'
                  }`}
                  style={{ animationDelay: `${0.3 + idx * 0.15}s` }}
                >
                  <div className="text-4xl">{medals[idx] || ''}</div>
                  <div className="flex-1">
                    <p className="text-white font-bold text-xl">{p.player_name}</p>
                    <p className="text-slate-400 text-sm">Player {p.player_number}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {idx === 0 && <Medal className="w-6 h-6 text-amber-400" />}
                    <span className="text-amber-400 text-3xl font-black tabular-nums">
                      ${p.score.toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
              {sorted.length === 0 && (
                <p className="text-slate-500 text-center py-8">No players in this game.</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              {isModerator && onNewGame && (
                <button
                  onClick={onNewGame}
                  className="flex items-center justify-center gap-2 px-8 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-lg rounded-2xl transition-all hover:scale-105 active:scale-95 shadow-lg shadow-amber-500/20"
                >
                  <Trophy className="w-5 h-5" />
                  Create New Game
                </button>
              )}
              <button
                onClick={onLeave}
                className="flex items-center justify-center gap-2 px-8 py-3.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-lg rounded-2xl transition-all hover:scale-105 active:scale-95"
              >
                <Home className="w-5 h-5" />
                Back to Home
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
