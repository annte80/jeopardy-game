import { Wifi, WifiOff, Loader2 } from 'lucide-react';

interface ConnectionIndicatorProps {
  status: 'connected' | 'reconnecting' | 'disconnected';
  compact?: boolean;
}

export function ConnectionIndicator({ status, compact = false }: ConnectionIndicatorProps) {
  const config = {
    connected: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', dot: 'bg-emerald-400', label: 'Connected', icon: Wifi },
    reconnecting: { color: 'text-amber-400', bg: 'bg-amber-500/10', dot: 'bg-amber-400', label: 'Reconnecting...', icon: Loader2 },
    disconnected: { color: 'text-red-400', bg: 'bg-red-500/10', dot: 'bg-red-400', label: 'Disconnected', icon: WifiOff },
  };

  const c = config[status];
  const Icon = c.icon;

  if (compact) {
    return (
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${c.bg} ${c.color}`}>
        <span className={`w-2 h-2 rounded-full ${c.dot} ${status === 'reconnecting' ? 'animate-pulse' : ''}`} />
        <span className="text-xs font-semibold">{c.label}</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${c.bg} ${c.color}`}>
      <Icon className={`w-4 h-4 ${status === 'reconnecting' ? 'animate-spin' : ''}`} />
      <span className="text-sm font-semibold">{c.label}</span>
    </div>
  );
}
