import { useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  KeyRound,
  User,
  Camera,
  Check,
} from 'lucide-react';
import { joinGame as joinGameFn } from '@/lib/gameApi';
import { useToast } from './Toast';
import type { PlayerSession } from '@/lib/types';

interface JoinGameProps {
  initialRoomCode?: string;
  onBack: () => void;
  onJoined: (session: PlayerSession) => void;
}

// One built-in avatar only.
const DEFAULT_AVATAR = '/avatars/avatar-1.png';

export function JoinGame({
  initialRoomCode = '',
  onBack,
  onJoined,
}: JoinGameProps) {
  const [step, setStep] = useState<'code' | 'name'>(
    initialRoomCode ? 'name' : 'code'
  );

  const [roomCode, setRoomCode] = useState(initialRoomCode);
  const [playerName, setPlayerName] = useState('');
  const [joining, setJoining] = useState(false);

  const [selectedAvatar, setSelectedAvatar] =
    useState(DEFAULT_AVATAR);

  const [uploadedAvatar, setUploadedAvatar] =
    useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { show } = useToast();

  // ---------------------------------------------------------------------------
  // ROOM CODE
  // ---------------------------------------------------------------------------

  const handleCodeNext = () => {
    const code = roomCode.trim().toUpperCase();

    if (code.length < 4) {
      show('Please enter a valid room code.', 'error');
      return;
    }

    setRoomCode(code);
    setStep('name');
  };

  // ---------------------------------------------------------------------------
  // AVATAR
  // ---------------------------------------------------------------------------

  const handleSelectDefaultAvatar = () => {
    setSelectedAvatar(DEFAULT_AVATAR);
    setUploadedAvatar(null);
  };

  const handleUploadClick = () => {
    if (joining) return;
    fileInputRef.current?.click();
  };

  const handleAvatarUpload = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];

    if (!file) return;

    const allowedTypes = [
      'image/png',
      'image/jpeg',
      'image/jpg',
    ];

    if (!allowedTypes.includes(file.type)) {
      show('Please upload a PNG or JPG image.', 'error');
      e.target.value = '';
      return;
    }

    const maxSize = 5 * 1024 * 1024;

    if (file.size > maxSize) {
      show(
        'Avatar image must be smaller than 5 MB.',
        'error'
      );
      e.target.value = '';
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        show('Failed to load avatar image.', 'error');
        return;
      }

      setUploadedAvatar(reader.result);
      setSelectedAvatar(reader.result);
    };

    reader.onerror = () => {
      show('Failed to load avatar image.', 'error');
    };

    reader.readAsDataURL(file);

    e.target.value = '';
  };

  // ---------------------------------------------------------------------------
  // JOIN
  // ---------------------------------------------------------------------------

  const handleJoin = async () => {
    if (!playerName.trim()) {
      show('Please enter your name.', 'error');
      return;
    }

    if (!selectedAvatar) {
      show('Please choose an avatar.', 'error');
      return;
    }

    setJoining(true);

    try {
      const session = await joinGameFn(
        roomCode.trim(),
        playerName.trim(),
        selectedAvatar
      );

      show(
        `You are in as Player ${session.playerNumber}!`,
        'success'
      );

      onJoined(session);
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : 'Failed to join game';

      show(msg, 'error');

      if (msg.toLowerCase().includes('not found')) {
        setStep('code');
      }
    } finally {
      setJoining(false);
    }
  };

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gradient-game flex flex-col">
      <header className="flex items-center gap-4 px-6 py-5 md:px-12">
        <button
          onClick={onBack}
          disabled={joining}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>

        <h1 className="text-xl font-bold text-white">
          Join Game
        </h1>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-md">
          <div className="glass rounded-3xl p-6 md:p-8 animate-slide-up">
            {step === 'code' ? (
              <>
                <div className="text-center mb-6">
                  <div className="inline-flex p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl mb-4">
                    <KeyRound className="w-8 h-8 text-amber-400" />
                  </div>

                  <h2 className="text-2xl font-bold text-white mb-2">
                    Enter Room Code
                  </h2>

                  <p className="text-slate-400 text-sm">
                    Ask your Game Master for the 4-letter code.
                  </p>
                </div>

                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) =>
                    setRoomCode(
                      e.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, '')
                    )
                  }
                  placeholder="7K4P"
                  maxLength={4}
                  disabled={joining}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCodeNext();
                    }
                  }}
                  className="w-full px-4 py-4 bg-slate-900/60 border border-slate-700 rounded-xl text-white text-center text-3xl font-mono font-black tracking-[0.5em] placeholder-slate-700 focus:border-amber-500 focus:outline-none transition-colors uppercase"
                  autoFocus
                />

                <button
                  onClick={handleCodeNext}
                  disabled={roomCode.trim().length < 4}
                  className="w-full mt-6 flex items-center justify-center gap-2 px-6 py-3.5 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-bold rounded-2xl transition-all hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed"
                >
                  Continue
                  <ArrowRight className="w-5 h-5" />
                </button>
              </>
            ) : (
              <>
                <div className="text-center mb-6">
                  <div className="inline-flex p-3 bg-blue-500/10 border border-blue-500/30 rounded-2xl mb-4">
                    <User className="w-8 h-8 text-blue-400" />
                  </div>

                  <h2 className="text-2xl font-bold text-white mb-2">
                    Enter Your Name
                  </h2>

                  <p className="text-slate-400 text-sm">
                    Joining room{' '}
                    <span className="font-mono font-bold text-amber-400">
                      {roomCode}
                    </span>
                  </p>
                </div>

                {/* Avatar preview */}
                <div className="flex justify-center mb-5">
                  <div className="relative">
                    <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-slate-700 bg-slate-900 shadow-2xl">
                      <img
                        src={selectedAvatar}
                        alt="Selected avatar"
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleUploadClick}
                      disabled={joining}
                      className="absolute bottom-0 right-0 w-9 h-9 flex items-center justify-center rounded-full bg-blue-600 hover:bg-blue-500 text-white border-4 border-slate-900 transition-colors disabled:opacity-50"
                      title="Upload avatar"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />

                {/* Avatar options */}
                <div className="mb-6">
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">
                    Choose Avatar
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Default avatar */}
                    <button
                      type="button"
                      onClick={handleSelectDefaultAvatar}
                      disabled={joining}
                      className={`relative aspect-square max-h-32 rounded-2xl overflow-hidden border-2 transition-all ${
                        !uploadedAvatar
                          ? 'border-blue-500 ring-2 ring-blue-500/30 scale-[1.02]'
                          : 'border-slate-700 hover:border-slate-500'
                      }`}
                    >
                      <img
                        src={DEFAULT_AVATAR}
                        alt="Default avatar"
                        className="w-full h-full object-cover"
                      />

                      {!uploadedAvatar && (
                        <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                          <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        </div>
                      )}

                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1.5">
                        <span className="text-white text-xs font-semibold">
                          Default
                        </span>
                      </div>
                    </button>

                    {/* Upload */}
                    <button
                      type="button"
                      onClick={handleUploadClick}
                      disabled={joining}
                      className={`relative aspect-square max-h-32 rounded-2xl overflow-hidden border-2 border-dashed transition-all ${
                        uploadedAvatar
                          ? 'border-blue-500 ring-2 ring-blue-500/30 scale-[1.02]'
                          : 'border-slate-700 hover:border-blue-500 hover:bg-blue-500/5'
                      }`}
                    >
                      {uploadedAvatar ? (
                        <>
                          <img
                            src={uploadedAvatar}
                            alt="Uploaded avatar"
                            className="absolute inset-0 w-full h-full object-cover"
                          />

                          <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                            <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center">
                              <Check className="w-4 h-4 text-white" />
                            </div>
                          </div>

                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1.5">
                            <span className="text-white text-xs font-semibold">
                              Custom
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                          <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center">
                            <Camera className="w-5 h-5 text-slate-400" />
                          </div>

                          <span className="text-slate-400 text-xs font-semibold">
                            Upload Image
                          </span>
                        </div>
                      )}
                    </button>
                  </div>

                  <p className="text-slate-600 text-[11px] text-center mt-3">
                    PNG or JPG · Max 5 MB
                  </p>
                </div>

                {/* Name */}
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) =>
                    setPlayerName(e.target.value)
                  }
                  placeholder="Your name"
                  maxLength={20}
                  disabled={joining}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleJoin();
                    }
                  }}
                  className="w-full px-4 py-4 bg-slate-900/60 border border-slate-700 rounded-xl text-white text-lg placeholder-slate-600 focus:border-blue-500 focus:outline-none transition-colors"
                  autoFocus
                />

                {/* Join */}
                <button
                  onClick={handleJoin}
                  disabled={
                    joining ||
                    !playerName.trim() ||
                    !selectedAvatar
                  }
                  className="w-full mt-6 flex items-center justify-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold rounded-2xl transition-all hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed"
                >
                  {joining ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Joining...
                    </>
                  ) : (
                    <>
                      Join Game
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>

                {/* Change room */}
                <button
                  onClick={() => setStep('code')}
                  disabled={joining}
                  className="w-full mt-3 text-slate-500 hover:text-slate-300 text-sm font-medium transition-colors"
                >
                  Change room code
                </button>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}