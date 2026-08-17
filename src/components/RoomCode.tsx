import { useState } from 'react';
import { Copy, Check, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface RoomCodeProps {
  code: string;
  joinUrl: string;
  showQR?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function RoomCode({ code, joinUrl, showQR = true, size = 'md' }: RoomCodeProps) {
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);

  const sizeClasses = {
    sm: 'text-2xl py-2 px-4',
    md: 'text-4xl py-4 px-8',
    lg: 'text-6xl py-6 px-12',
  };

  const copyCode = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const copyLink = () => {
    navigator.clipboard.writeText(joinUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-center">
        <p className="text-amber-400 text-sm font-bold tracking-widest uppercase mb-2">Room Code</p>
        <button
          onClick={copyCode}
          className={`font-mono font-black tracking-[0.3em] text-white bg-slate-800/80 border-2 border-amber-500/30 rounded-2xl ${sizeClasses[size]} hover:border-amber-500/60 transition-all hover:scale-105 active:scale-95`}
        >
          {code}
          <span className="ml-3 inline-flex items-center gap-1 text-amber-400 text-sm font-normal tracking-normal">
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </span>
        </button>
      </div>

      <div className="w-full max-w-md">
        <p className="text-slate-500 text-xs font-bold tracking-widest uppercase mb-2 text-center">Join Link</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-xl text-slate-300 text-sm truncate">
            {joinUrl}
          </div>
          <button
            onClick={copyLink}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-sm transition-colors flex items-center gap-1.5"
          >
            {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copiedLink ? 'Copied' : 'Copy'}
          </button>
          {showQR && (
            <button
              onClick={() => setShowQRModal(true)}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-xl font-semibold text-sm transition-colors"
              title="Show QR code"
            >
              <QrCode className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {showQRModal && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in p-4"
          onClick={() => setShowQRModal(false)}
        >
          <div
            className="bg-white p-6 rounded-2xl shadow-2xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-slate-900 text-center font-bold mb-4">Scan to Join</p>
            <QRCodeSVG value={joinUrl} size={240} level="M" />
            <p className="text-slate-500 text-center text-sm mt-4 font-mono">{code}</p>
            <button
              onClick={() => setShowQRModal(false)}
              className="mt-4 w-full py-2 bg-slate-900 text-white rounded-xl font-semibold text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
