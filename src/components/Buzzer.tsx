import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Lock,
  Trophy,
} from 'lucide-react';

import type { BuzzerStatus, Player } from '@/lib/types';
import { claimBuzz } from '@/lib/gameApi';
import {
  playBuzzPress,
  playBuzzEnabled,
  playBuzzWin,
} from '@/lib/sound';

interface BuzzerProps {
  gameId: string;
  playerId: string;
  playerToken: string;
  playerName: string;
  playerNumber: number;
  buzzerStatus: BuzzerStatus;
  winnerPlayerId: string | null;
  players: Player[];
  soundEnabled: boolean;
}

const BUZZER_SIZE = 'w-28 h-28 sm:w-36 sm:h-36';

const RESULT_NOTIFICATION_MS = 5000;

export function Buzzer({
  gameId,
  playerId,
  playerToken,
  playerName,
  playerNumber,
  buzzerStatus,
  winnerPlayerId,
  players,
  soundEnabled,
}: BuzzerProps) {
  const [buzzing, setBuzzing] = useState(false);
  const [buzzSent, setBuzzSent] = useState(false);

  const [localResult, setLocalResult] = useState<{
    won: boolean;
    winnerPlayerId: string | null;
  } | null>(null);

  const [showResultNotification, setShowResultNotification] =
    useState(false);

  const lastBuzzRef = useRef(0);

  const playedWinSoundRef = useRef(false);

  const notifiedWinnerRef = useRef<string | null>(null);

  const notificationTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  // ------------------------------------------------------------
  // Buzzer enabled sound
  // ------------------------------------------------------------

  useEffect(() => {
    if (soundEnabled && buzzerStatus === 'enabled') {
      playBuzzEnabled();
    }
  }, [buzzerStatus, soundEnabled]);

  // ------------------------------------------------------------
  // Reset when buzzer is disabled
  // ------------------------------------------------------------

  useEffect(() => {
    if (buzzerStatus === 'disabled') {
      setBuzzSent(false);
      setLocalResult(null);
      setShowResultNotification(false);

      playedWinSoundRef.current = false;
      notifiedWinnerRef.current = null;

      if (notificationTimerRef.current) {
        clearTimeout(notificationTimerRef.current);
        notificationTimerRef.current = null;
      }
    }
  }, [buzzerStatus]);

  // ------------------------------------------------------------
  // Effective winner
  // ------------------------------------------------------------

  const effectiveWinnerId =
    localResult?.winnerPlayerId ?? winnerPlayerId;

  const effectiveLocked =
    buzzerStatus === 'locked' || localResult !== null;

  const winner = players.find(
    (p) => p.id === effectiveWinnerId
  );

  const isWinner =
    effectiveWinnerId === playerId;

  const lostAfterBuzzing =
    buzzSent &&
    localResult !== null &&
    !localResult.won;

  const enabled =
    buzzerStatus === 'enabled' &&
    !effectiveLocked;

  // ------------------------------------------------------------
  // Win sound
  // ------------------------------------------------------------

  useEffect(() => {
    if (
      soundEnabled &&
      effectiveLocked &&
      isWinner &&
      !playedWinSoundRef.current
    ) {
      playBuzzWin();
      playedWinSoundRef.current = true;
    }
  }, [
    soundEnabled,
    effectiveLocked,
    isWinner,
  ]);

  // ------------------------------------------------------------
  // Fullscreen notification
  // ------------------------------------------------------------

  const triggerResultNotification = useCallback(() => {
    if (!effectiveWinnerId) return;

    if (
      notifiedWinnerRef.current === effectiveWinnerId
    ) {
      return;
    }

    notifiedWinnerRef.current =
      effectiveWinnerId;

    setShowResultNotification(true);

    if (notificationTimerRef.current) {
      clearTimeout(
        notificationTimerRef.current
      );
    }

    notificationTimerRef.current =
      setTimeout(() => {
        setShowResultNotification(false);
        notificationTimerRef.current = null;
      }, RESULT_NOTIFICATION_MS);
  }, [effectiveWinnerId]);

  // ------------------------------------------------------------
  // Realtime result
  // ------------------------------------------------------------

  useEffect(() => {
    if (
      buzzerStatus === 'locked' &&
      winnerPlayerId
    ) {
      triggerResultNotification();
    }
  }, [
    buzzerStatus,
    winnerPlayerId,
    triggerResultNotification,
  ]);

  // ------------------------------------------------------------
  // Immediate RPC result
  // ------------------------------------------------------------

  useEffect(() => {
    if (
      localResult?.winnerPlayerId
    ) {
      triggerResultNotification();
    }
  }, [
    localResult,
    triggerResultNotification,
  ]);

  // ------------------------------------------------------------
  // Cleanup
  // ------------------------------------------------------------

  useEffect(() => {
    return () => {
      if (notificationTimerRef.current) {
        clearTimeout(
          notificationTimerRef.current
        );
      }
    };
  }, []);

  // ------------------------------------------------------------
  // Buzz
  // ------------------------------------------------------------

  const handleBuzz = useCallback(async () => {
    if (
      !enabled ||
      buzzing ||
      buzzSent
    ) {
      return;
    }

    const now = Date.now();

    if (
      now - lastBuzzRef.current < 500
    ) {
      return;
    }

    lastBuzzRef.current = now;

    setBuzzing(true);
    setBuzzSent(true);

    if (soundEnabled) {
      playBuzzPress();
    }

    try {
      const result = await claimBuzz(
        gameId,
        playerId,
        playerToken
      );

      setLocalResult(result);
    } catch (error) {
      console.error(
        'Buzzer claim failed:',
        error
      );

      setBuzzSent(false);
    } finally {
      setBuzzing(false);
    }
  }, [
    enabled,
    buzzing,
    buzzSent,
    soundEnabled,
    gameId,
    playerId,
    playerToken,
  ]);

  // ------------------------------------------------------------
  // SPACEBAR
  //
  // IMPORTANT:
  // The listener uses CAPTURE PHASE.
  //
  // This lets us intercept Space before the PDF viewer receives
  // the keyboard event. Space therefore activates the buzzer
  // instead of exiting/changing PDF fullscreen.
  // ------------------------------------------------------------

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.code !== 'Space' &&
        e.key !== ' '
      ) {
        return;
      }

      const target =
        e.target as HTMLElement | null;

      const tag = target?.tagName;

      // Don't interfere with real form controls.
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        tag === 'BUTTON' ||
        tag === 'A'
      ) {
        return;
      }

      if (target?.isContentEditable) {
        return;
      }

      // CRITICAL:
      // Stop Space from reaching the PDF viewer.
      e.preventDefault();
      e.stopPropagation();

      // Ignore key-repeat when Space is held.
      if (e.repeat) {
        return;
      }

      handleBuzz();
    };

    // true = CAPTURE PHASE
    window.addEventListener(
      'keydown',
      handler,
      true
    );

    return () => {
      window.removeEventListener(
        'keydown',
        handler,
        true
      );
    };
  }, [handleBuzz]);

  // ------------------------------------------------------------
  // FULLSCREEN RESULT NOTIFICATION
  //
  // Render the notification inside the element that lives inside
  // the presentation fullscreen container.
  // ------------------------------------------------------------

  const resultNotification =
    showResultNotification &&
    effectiveWinnerId &&
    winner ? (
      <div
        className="
          absolute
          inset-0
          z-[999999]
          flex
          items-center
          justify-center
          pointer-events-none
          px-4
        "
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />

        {/* Result card */}
        <div
          className={`
            relative
            w-full
            max-w-3xl
            rounded-3xl
            border-4
            p-8
            sm:p-12
            text-center
            shadow-2xl
            animate-in
            zoom-in-95
            duration-200
            ${
              isWinner
                ? `
                  bg-emerald-950/95
                  border-emerald-400
                  shadow-emerald-500/40
                `
                : `
                  bg-slate-950/95
                  border-amber-400/70
                  shadow-amber-500/30
                `
            }
          `}
        >
          {isWinner ? (
            <>
              <Trophy
                className="
                  w-16
                  h-16
                  sm:w-24
                  sm:h-24
                  text-amber-300
                  mx-auto
                  mb-5
                  animate-bounce
                "
              />

              <p
                className="
                  text-emerald-300
                  font-black
                  text-4xl
                  sm:text-7xl
                  tracking-tight
                  text-glow-gold
                "
              >
                YOU BUZZED FIRST!
              </p>

              <p
                className="
                  mt-4
                  text-white
                  text-xl
                  sm:text-3xl
                  font-bold
                "
              >
                You were the fastest!
              </p>
            </>
          ) : (
            <>
              <XCircle
                className="
                  w-16
                  h-16
                  sm:w-24
                  sm:h-24
                  text-red-400
                  mx-auto
                  mb-5
                "
              />

              <p
                className="
                  text-red-300
                  font-black
                  text-4xl
                  sm:text-7xl
                  tracking-tight
                "
              >
                TOO SLOW!
              </p>

              <p
                className="
                  mt-5
                  text-white
                  text-xl
                  sm:text-3xl
                  font-bold
                "
              >
                <span className="text-amber-300">
                  {winner.player_name}
                </span>{' '}
                buzzed first!
              </p>

              <p
                className="
                  mt-3
                  text-slate-400
                  text-base
                  sm:text-xl
                "
              >
                Player {winner.player_number}
              </p>
            </>
          )}
        </div>
      </div>
    ) : null;

  // ------------------------------------------------------------
  // PORTAL NOTIFICATION INTO PDF FULLSCREEN ELEMENT
  // ------------------------------------------------------------

  const fullscreenNotificationHost =
    typeof document !== 'undefined'
      ? document.getElementById(
          'buzzer-fullscreen-notification'
        )
      : null;

  const fullscreenNotification =
    fullscreenNotificationHost &&
    resultNotification
      ? createPortal(
          resultNotification,
          fullscreenNotificationHost
        )
      : null;

  // ------------------------------------------------------------
  // DISABLED
  // ------------------------------------------------------------

  if (buzzerStatus === 'disabled') {
    return (
      <>
        {fullscreenNotification}

        <div className="w-full flex flex-col items-center gap-2 py-3">
          <div
            className={`
              ${BUZZER_SIZE}
              flex
              items-center
              justify-center
              rounded-full
              bg-slate-800/50
              border-4
              border-slate-700
              no-select
            `}
          >
            <div className="text-center px-2">
              <Lock className="w-6 h-6 text-slate-600 mx-auto mb-1" />

              <p className="text-slate-500 font-bold text-xs sm:text-sm leading-tight">
                BUZZER DISABLED
              </p>
            </div>
          </div>

          <p className="text-slate-600 text-xs">
            Wait for the host to enable buzzers
          </p>
        </div>
      </>
    );
  }

  // ------------------------------------------------------------
  // LOCKED
  // ------------------------------------------------------------

  if (effectiveLocked) {
    if (isWinner) {
      return (
        <>
          {fullscreenNotification}

          <div className="w-full flex flex-col items-center gap-2 py-3 animate-celebrate">
            <div
              className={`
                ${BUZZER_SIZE}
                flex
                items-center
                justify-center
                rounded-full
                bg-emerald-500/20
                border-4
                border-emerald-500
                no-select
                animate-pulse-glow
              `}
            >
              <div className="text-center px-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-1" />

                <p className="text-emerald-300 font-black text-sm sm:text-base text-glow-gold leading-tight">
                  YOU BUZZED FIRST!
                </p>
              </div>
            </div>

            <p className="text-emerald-400/70 text-xs">
              Wait for the host
            </p>
          </div>
        </>
      );
    }

    if (lostAfterBuzzing) {
      return (
        <>
          {fullscreenNotification}

          <div className="w-full flex flex-col items-center gap-2 py-3 animate-shake">
            <div
              className={`
                ${BUZZER_SIZE}
                flex
                items-center
                justify-center
                rounded-full
                bg-red-500/10
                border-4
                border-red-500/60
                no-select
              `}
            >
              <div className="text-center px-2">
                <XCircle className="w-8 h-8 text-red-400 mx-auto mb-1" />

                <p className="text-red-300 font-black text-sm sm:text-base leading-tight">
                  TOO SLOW!
                </p>
              </div>
            </div>

            <p className="text-slate-400 text-xs">
              {winner
                ? `${winner.player_name} buzzed first`
                : 'Someone beat you to it'}
            </p>
          </div>
        </>
      );
    }

    return (
      <>
        {fullscreenNotification}

        <div className="w-full flex flex-col items-center gap-2 py-3">
          <div
            className={`
              ${BUZZER_SIZE}
              flex
              items-center
              justify-center
              rounded-full
              bg-slate-800/50
              border-4
              border-slate-600
              no-select
            `}
          >
            <div className="text-center px-2">
              <XCircle className="w-6 h-6 text-slate-500 mx-auto mb-1" />

              <p className="text-white font-bold text-xs sm:text-sm leading-tight">
                {winner
                  ? `${winner.player_name.toUpperCase()} BUZZED FIRST`
                  : 'BUZZER LOCKED'}
              </p>
            </div>
          </div>

          <p className="text-slate-500 text-xs">
            Player {winner?.player_number || '?'}
          </p>
        </div>
      </>
    );
  }

  // ------------------------------------------------------------
  // ENABLED
  // ------------------------------------------------------------

  return (
    <>
      {fullscreenNotification}

      <div className="w-full flex flex-col items-center gap-2 py-3">
        <div className="text-center mb-1">
          <p className="text-amber-400 font-bold text-sm sm:text-base tracking-wider animate-pulse">
            QUESTION IS ACTIVE
          </p>

          <p className="text-slate-400 text-xs">
            Wait for it... then BUZZ! (or press SPACE)
          </p>
        </div>

        <button
          onClick={handleBuzz}
          disabled={buzzing || buzzSent}
          className={`
            ${BUZZER_SIZE}
            rounded-full
            border-4
            no-select
            transition-all
            active:scale-95
            ${
              buzzSent
                ? `
                  bg-slate-800
                  border-slate-600
                  cursor-not-allowed
                `
                : `
                  bg-gradient-to-b
                  from-red-500
                  to-red-700
                  border-red-400
                  hover:from-red-400
                  hover:to-red-600
                  animate-pulse-glow
                  active:animate-shake
                `
            }
          `}
        >
          <div className="text-center px-1">
            {buzzing ? (
              <Loader2 className="w-8 h-8 text-white mx-auto animate-spin" />
            ) : buzzSent ? (
              <>
                <CheckCircle2 className="w-8 h-8 text-slate-400 mx-auto mb-1" />

                <p className="text-slate-400 font-black text-sm sm:text-base">
                  BUZZ SENT
                </p>
              </>
            ) : (
              <>
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/20 mx-auto mb-1 flex items-center justify-center">
                  <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/30" />
                </div>

                <p className="text-white font-black text-lg sm:text-xl text-glow-red">
                  BUZZ
                </p>
              </>
            )}
          </div>
        </button>

        <p className="text-slate-500 text-xs">
          Player {playerNumber} — {playerName}
        </p>
      </div>
    </>
  );
}

// ============================================================
// BUZZER STATUS — MODERATOR
// ============================================================

interface BuzzerStatusProps {
  buzzerStatus: BuzzerStatus;
  winnerPlayerId: string | null;
  players: Player[];
}

export function BuzzerStatus({
  buzzerStatus,
  winnerPlayerId,
  players,
}: BuzzerStatusProps) {
  const winner = players.find(
    (p) => p.id === winnerPlayerId
  );

  if (buzzerStatus === 'disabled') {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl">
        <Lock className="w-5 h-5 text-slate-500" />

        <span className="text-slate-400 font-semibold">
          Buzzer Disabled
        </span>
      </div>
    );
  }

  if (buzzerStatus === 'enabled') {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/40 rounded-xl animate-pulse">
        <div className="w-3 h-3 rounded-full bg-amber-400 animate-pulse" />

        <span className="text-amber-400 font-bold">
          Buzzers Enabled — Waiting for buzz...
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-emerald-500/10 border border-emerald-500/40 rounded-xl animate-celebrate">
      <CheckCircle2 className="w-5 h-5 text-emerald-400" />

      <span className="text-emerald-300 font-bold">
        {winner
          ? `${winner.player_name} (Player ${winner.player_number}) buzzed first!`
          : 'Buzzer locked'}
      </span>
    </div>
  );
}