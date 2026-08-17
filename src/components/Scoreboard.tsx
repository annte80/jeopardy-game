import { Trophy } from 'lucide-react';
import type { Player } from '@/lib/types';

interface ScoreboardProps {
  players: Player[];
  highlightPlayerId?: string | null;
  title?: string;
}

export function Scoreboard({
  players,
  highlightPlayerId = null,
  title = 'Scoreboard',
}: ScoreboardProps) {
  const sortedPlayers = [...players].sort(
    (a, b) => b.score - a.score
  );

  return (
    <div className="glass rounded-2xl p-3">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="w-4 h-4 text-amber-400" />

        <h3 className="text-white font-bold text-sm">
          {title}
        </h3>
      </div>

      {/* Players */}
      <div className="flex flex-col gap-2">
        {sortedPlayers.length === 0 ? (
          <p className="text-slate-600 text-sm text-center py-4">
            No players yet
          </p>
        ) : (
          sortedPlayers.map((player, index) => {
            const highlighted =
              player.id === highlightPlayerId;

            const playerRowClass = highlighted
              ? 'bg-amber-500/10 border border-amber-500/40'
              : 'bg-slate-900/40 border border-slate-800';

            const nameClass = highlighted
              ? 'text-amber-300'
              : 'text-white';

            const scoreClass = highlighted
              ? 'text-amber-400'
              : 'text-white';

            return (
              <div
                key={player.id}
                className={
                  'flex items-center gap-2 p-2 rounded-xl transition-all ' +
                  playerRowClass
                }
              >
                {/* Position */}
                <div className="w-5 flex-shrink-0 text-center">
                  {index === 0 ? (
                    <span className="text-amber-400 text-sm font-black">
                      1
                    </span>
                  ) : (
                    <span className="text-slate-600 text-xs font-bold">
                      {index + 1}
                    </span>
                  )}
                </div>

                {/* Avatar */}
                <div className="w-9 h-9 flex-shrink-0 rounded-full overflow-hidden border-2 border-slate-700 bg-slate-800">
                  {player.player_avatar_url ? (
                    <img
                      src={player.player_avatar_url}
                      alt={player.player_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white text-sm font-bold">
                      {player.player_name
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <p
                    className={
                      'text-sm font-semibold truncate ' +
                      nameClass
                    }
                  >
                    {player.player_name}
                  </p>

                  <p className="text-slate-600 text-[10px]">
                    Player {player.player_number}
                  </p>
                </div>

                {/* Score */}
                <div className="flex-shrink-0 text-right">
                  <span
                    className={
                      'text-sm font-black tabular-nums ' +
                      scoreClass
                    }
                  >
                    ${player.score}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}