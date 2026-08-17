import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  LogOut,
  Crown,
} from 'lucide-react';

import {
  usePlayers,
  useHeartbeat,
  useConnectionStatus,
} from '@/lib/hooks';

import { PresentationViewer } from './PresentationViewer';
import { Buzzer } from './Buzzer';
import { Scoreboard } from './Scoreboard';
import { ConnectionIndicator } from './ConnectionIndicator';
import { ConfirmationDialog } from './ConfirmationDialog';
import { setMuted, isMuted } from '@/lib/sound';

import type { PlayerSession, Game } from '@/lib/types';

interface PlayerGameViewProps {
  session: PlayerSession;
  game: Game;
  onLeave: () => void;
}

export function PlayerGameView({
  session,
  game,
  onLeave,
}: PlayerGameViewProps) {
  const { players } = usePlayers(session.gameId);
  const connectionStatus = useConnectionStatus();

  const [muted, setMutedState] = useState(isMuted());
  const [confirmLeave, setConfirmLeave] = useState(false);

  const presentationRef = useRef<HTMLDivElement>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);

  useHeartbeat(session.playerId, session.playerToken);

  const buzzerActive =
    game?.buzzer_status === 'enabled' ||
    game?.buzzer_status === 'locked';

  // ------------------------------------------------------------
  // FULLSCREEN TRACKING
  // ------------------------------------------------------------

  useEffect(() => {
    const handler = () => {
      setIsFullscreen(
        document.fullscreenElement === presentationRef.current
      );
    };

    document.addEventListener('fullscreenchange', handler);

    return () => {
      document.removeEventListener('fullscreenchange', handler);
    };
  }, []);

  // ------------------------------------------------------------
  // MUTE
  // ------------------------------------------------------------

  const toggleMute = () => {
    const next = !muted;

    setMuted(next);
    setMutedState(next);
  };

  // ------------------------------------------------------------
  // FULLSCREEN
  // ------------------------------------------------------------

  const toggleFullscreen = useCallback(() => {
    const element = presentationRef.current;

    if (!element) {
      return;
    }

    if (!document.fullscreenElement) {
      element.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  // ------------------------------------------------------------
  // KEYBOARD SHORTCUTS
  //
  // F = fullscreen
  // Space = buzzer (handled by Buzzer.tsx)
  //
  // IMPORTANT:
  // We deliberately DO NOT intercept Space here.
  // The Buzzer component must receive Space normally.
  // ------------------------------------------------------------

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // F / f controls fullscreen.
      if (
        event.code !== 'KeyF' &&
        event.key.toLowerCase() !== 'f'
      ) {
        return;
      }

      // Do not steal F from text inputs or editable elements.
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;

      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT'
      ) {
        return;
      }

      if (target?.isContentEditable) {
        return;
      }

      // Don't allow browser/PDF controls to interpret F.
      event.preventDefault();
      event.stopPropagation();

      toggleFullscreen();
    };

    window.addEventListener(
      'keydown',
      handleKeyDown,
      true
    );

    return () => {
      window.removeEventListener(
        'keydown',
        handleKeyDown,
        true
      );
    };
  }, [toggleFullscreen]);

  // ------------------------------------------------------------
  // CURRENT PLAYER
  // ------------------------------------------------------------

  const me = players.find(
    (p) => p.id === session.playerId
  );

  return (
    <div className="min-h-screen bg-gradient-game flex flex-col">

      {/* ======================================================
          TOP BAR
          ====================================================== */}

      <header className="flex items-center justify-between px-3 py-2 md:px-4 md:py-3 border-b border-slate-800 bg-slate-950/50 backdrop-blur-sm flex-shrink-0">

        <div className="flex items-center gap-2">
          <Crown className="w-4 h-4 text-amber-400" />

          <span className="text-white font-bold text-sm md:text-base">
            {game.game_name}
          </span>
        </div>

        <div className="flex items-center gap-2">

          <ConnectionIndicator
            status={connectionStatus}
            compact
          />

          <button
            onClick={toggleMute}
            className="p-1.5 text-slate-400 hover:text-white transition-colors"
            type="button"
          >
            {muted ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>

          <button
            onClick={() => setConfirmLeave(true)}
            className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
            type="button"
          >
            <LogOut className="w-4 h-4" />
          </button>

        </div>
      </header>

      {/* ======================================================
          PLAYER INFO
          ====================================================== */}

      <div className="flex items-center justify-between px-3 py-2 md:px-4 bg-slate-900/40 border-b border-slate-800 flex-shrink-0">

        <div className="flex items-center gap-2">

          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold">
            {session.playerNumber}
          </span>

          <span className="text-white font-semibold text-sm">
            {session.playerName}
          </span>

        </div>

        <span className="text-amber-400 font-bold text-lg tabular-nums">
          ${me?.score || 0}
        </span>

      </div>

      {/* ======================================================
          MAIN
          ====================================================== */}

      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">

        {/* ====================================================
            PRESENTATION / PDF
            ==================================================== */}

        <div
          ref={presentationRef}
          className="relative flex flex-1 min-h-0 bg-black"
        >

          {/* ==================================================
              PDF
              ================================================== */}

          {game.presentation_path ? (
            <PresentationViewer
              path={game.presentation_path}
              currentPage={game.current_slide}
              totalPages={game.presentation_total_pages}
              showFullscreenButton={false}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <p className="text-slate-500">
                Waiting for presentation...
              </p>
            </div>
          )}

          {/* ==================================================
              FULLSCREEN NOTIFICATION HOST

              IMPORTANT:
              This is INSIDE presentationRef.

              Therefore, when presentationRef enters browser
              fullscreen, this notification host remains inside
              the fullscreen document.
              ================================================== */}

          <div
            id="buzzer-fullscreen-notification"
            className="absolute inset-0 pointer-events-none z-[99999]"
          />

          {/* ==================================================
              FULLSCREEN BUTTON

              F also controls fullscreen.
              ================================================== */}

          {!isFullscreen && (
            <button
              onClick={toggleFullscreen}
              className="absolute top-2 right-2 p-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors backdrop-blur-sm z-20"
              title="Fullscreen (F)"
              type="button"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          )}

          {isFullscreen && (
            <button
              onClick={toggleFullscreen}
              className="absolute top-2 right-2 p-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors backdrop-blur-sm z-[100000]"
              title="Exit fullscreen (F)"
              type="button"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          )}

        </div>

        {/* ====================================================
            BUZZER

            SPACE IS HANDLED BY Buzzer.tsx.
            We intentionally do NOT intercept Space above.
            ==================================================== */}

        <div className="flex-shrink-0 border-t border-slate-800 bg-slate-950/30 px-3">

          <Buzzer
            gameId={session.gameId}
            playerId={session.playerId}
            playerToken={session.playerToken}
            playerName={session.playerName}
            playerNumber={session.playerNumber}
            buzzerStatus={game.buzzer_status}
            winnerPlayerId={game.buzzer_winner_player_id}
            players={players}
            soundEnabled={!muted}
          />

        </div>

        {/* ====================================================
            SCOREBOARD
            ==================================================== */}

        {!buzzerActive && (
          <div className="flex-shrink-0 p-3">

            <Scoreboard
              players={players}
              highlightPlayerId={
                game.buzzer_winner_player_id
              }
              compact
              title="Scores"
            />

          </div>
        )}

      </main>

      {/* ======================================================
          LEAVE DIALOG
          ====================================================== */}

      <ConfirmationDialog
        open={confirmLeave}
        title="Leave the game?"
        message="You will exit the game. You can rejoin with the same room code if the game hasn't started yet."
        confirmLabel="Leave"
        destructive
        onConfirm={onLeave}
        onCancel={() => setConfirmLeave(false)}
      />

    </div>
  );
}