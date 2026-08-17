import { useState, useRef } from 'react';
import { ArrowLeft, Upload, FileText, Loader2, Sparkles } from 'lucide-react';
import { useToast } from './Toast';
import type { ModeratorSession } from '@/lib/types';
import { createGame as createGameFn, uploadPresentation as uploadFn } from '@/lib/gameApi';

interface CreateGameProps {
  onBack: () => void;
  onCreated: (session: ModeratorSession) => void;
}

export function CreateGame({ onBack, onCreated }: CreateGameProps) {
  const [gameName, setGameName] = useState('');
  const [moderatorName, setModeratorName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const { show } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    const ext = selected.name.split('.').pop()?.toLowerCase();
    if (ext !== 'pdf' && ext !== 'pptx') {
      show('Please upload a PDF or PPTX file.', 'error');
      return;
    }
    if (ext === 'pptx') {
      show('PPTX detected. PDF is recommended for reliable rendering. You can still upload it.', 'info');
    }
    setFile(selected);
  };

  const handleCreate = async () => {
    if (!gameName.trim() || !moderatorName.trim()) {
      show('Please enter a game name and your name.', 'error');
      return;
    }
    if (!file) {
      show('Please upload a presentation file.', 'error');
      return;
    }

    setCreating(true);
    try {
      const session = await createGameFn(gameName.trim(), moderatorName.trim());

      setUploading(true);
      setUploadProgress('Uploading presentation...');
      try {
        await uploadFn(session.gameId, session.moderatorToken, file);
        setUploadProgress('Counting slides...');
      } catch (e) {
        show('Unable to upload presentation. Please try again.', 'error');
        setCreating(false);
        setUploading(false);
        return;
      }

      show('Game created successfully!', 'success');
      onCreated(session);
    } catch (e) {
      show(e instanceof Error ? e.message : 'Failed to create game', 'error');
      setCreating(false);
    }
  };

  const busy = creating || uploading;

  return (
    <div className="min-h-screen bg-gradient-game flex flex-col">
      <header className="flex items-center gap-4 px-6 py-5 md:px-12">
        <button
          onClick={onBack}
          disabled={busy}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>
        <h1 className="text-xl font-bold text-white">Create a New Game</h1>
      </header>

      <main className="flex-1 flex items-start justify-center px-6 py-8">
        <div className="w-full max-w-xl">
          <div className="glass rounded-3xl p-6 md:p-8 animate-slide-up">
            {/* Game Name */}
            <div className="mb-6">
              <label className="block text-amber-400 text-sm font-bold tracking-wider uppercase mb-2">
                Game Name
              </label>
              <input
                type="text"
                value={gameName}
                onChange={(e) => setGameName(e.target.value)}
                placeholder="Friday Night Jeopardy"
                disabled={busy}
                maxLength={50}
                className="w-full px-4 py-3 bg-slate-900/60 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Moderator Name */}
            <div className="mb-6">
              <label className="block text-amber-400 text-sm font-bold tracking-wider uppercase mb-2">
                Your Name (Game Master)
              </label>
              <input
                type="text"
                value={moderatorName}
                onChange={(e) => setModeratorName(e.target.value)}
                placeholder="Alex"
                disabled={busy}
                maxLength={30}
                className="w-full px-4 py-3 bg-slate-900/60 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none transition-colors"
              />
            </div>

            {/* File Upload */}
            <div className="mb-8">
              <label className="block text-amber-400 text-sm font-bold tracking-wider uppercase mb-2">
                Presentation Upload
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.pptx"
                onChange={handleFileSelect}
                disabled={busy}
                className="hidden"
              />
              {!file ? (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy}
                  className="w-full border-2 border-dashed border-slate-700 hover:border-blue-500/50 rounded-2xl py-12 flex flex-col items-center gap-3 transition-colors group"
                >
                  <div className="p-3 bg-slate-800 group-hover:bg-blue-600/20 rounded-xl transition-colors">
                    <Upload className="w-8 h-8 text-slate-500 group-hover:text-blue-400" />
                  </div>
                  <span className="text-slate-400 font-medium">Click to upload PDF or PPTX</span>
                  <span className="text-slate-600 text-sm">Your presentation is the source of truth</span>
                </button>
              ) : (
                <div className="flex items-center gap-3 px-4 py-3 bg-slate-900/60 border border-slate-700 rounded-xl">
                  <FileText className="w-6 h-6 text-amber-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold truncate">{file.name}</p>
                    <p className="text-slate-500 text-sm">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                  </div>
                  {!busy && (
                    <button
                      onClick={() => setFile(null)}
                      className="text-slate-500 hover:text-red-400 text-sm font-medium"
                    >
                      Remove
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Create Button */}
            <button
              onClick={handleCreate}
              disabled={busy || !gameName.trim() || !moderatorName.trim() || !file}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 disabled:cursor-not-allowed font-bold text-lg rounded-2xl transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-amber-500/20 disabled:shadow-none"
            >
              {busy ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {uploading ? uploadProgress : 'Creating game...'}
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Create Game
                </>
              )}
            </button>
          </div>

          <p className="text-center text-slate-600 text-sm mt-4">
            You'll get a room code and shareable link to invite your players.
          </p>
        </div>
      </main>
    </div>
  );
}
