import { Wifi, WifiOff, UserMinus } from 'lucide-react';
import type { Player } from '@/lib/types';

interface PlayerListProps {
  players: Player[];
  onRemovePlayer?: (playerId: string) => void | Promise<void>;
  showRemove?: boolean;
}

export function PlayerList({
  players,
  onRemovePlayer,
  showRemove = false,
}: PlayerListProps) {
  return (
    <div className="flex flex-col gap-2">
      {players.length === 0 ? (
        <div className="text-center py-6">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-800 flex items-center justify-center">
            <span className="text-slate-500 text-xl">?</span>
          </div>

          <p className="text-slate-500 text-sm">
            No players yet
          </p>
        </div>
      ) : (
        players.map((player) => {
          const connected =
            player.connection_status === 'connected';

          return (
            <div
              key={player.id}
              className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-900/50 border border-slate-800"
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-slate-700 bg-slate-800">
                  {player.player_avatar_url ? (
                    <img
                      src={player.player_avatar_url}
                      alt={player.player_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white font-bold">
                      {player.player_name
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Connection indicator */}
                <span
                  className={
                    'absolute -bottom-0.5 -right-0.5 ' +
                    'w-3 h-3 rounded-full border-2 border-slate-900 ' +
                    (connected
                      ? 'bg-emerald-400'
                      : 'bg-slate-600')
                  }
                />
              </div>

              {/* Player info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-white text-sm font-semibold truncate">
                    {player.player_name}
                  </span>

                  <span className="text-slate-600 text-xs">
                    P{player.player_number}
                  </span>
                </div>

                <div className="flex items-center gap-1 mt-0.5">
                  {connected ? (
                    <>
                      <Wifi className="w-3 h-3 text-emerald-400" />

                      <span className="text-emerald-400 text-[10px]">
                        Connected
                      </span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-3 h-3 text-slate-600" />

                      <span className="text-slate-600 text-[10px]">
                        Disconnected
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Remove player */}
              {showRemove && onRemovePlayer && (
                <button
                  type="button"
                  onClick={() =>
                    void onRemovePlayer(player.id)
                  }
                  className="flex-shrink-0 p-2 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title={`Remove ${player.player_name}`}
                >
                  <UserMinus className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}