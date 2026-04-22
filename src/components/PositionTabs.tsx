import { useAppStore } from '../store/useAppStore';
import { PositionCard } from './PositionCard';

export function PositionTabs() {
  const activePositions = useAppStore((state) => state.activePositions);
  const t = useAppStore((state) => state.t)();

  const shortPositions = activePositions.filter(p => !p.isLocked);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6">
        {shortPositions.length === 0 ? (
          <div className="bg-aux-bg border border-text-main/5 p-24 text-center">
            <p className="text-text-muted/30 font-black uppercase tracking-[0.2em] text-xl leading-snug max-w-md mx-auto mb-4">
              {t('noActivePositions')}
            </p>
            <p className="text-text-muted/10 font-bold uppercase tracking-[0.1em] text-[10px]">
              {t('noActivePositionsDesc')}
            </p>
          </div>
        ) : (
          shortPositions.map(pos => <PositionCard key={pos.id} position={pos} />)
        )}
      </div>
    </div>
  );
}

export function LongTermView() {
  const activePositions = useAppStore((state) => state.activePositions);
  const longPositions = activePositions.filter(p => p.isLocked);
  const t = useAppStore((state) => state.t)();

  return (
    <div className="space-y-12">
      {longPositions.length > 0 && (
        <div className="p-8 border border-purple-600/20 bg-purple-600/5 space-y-2">
           <h3 className="text-xs font-black uppercase tracking-widest text-purple-600">{t('long_term')}</h3>
           <p className="text-[10px] text-purple-600/40 font-bold leading-relaxed whitespace-pre-line tracking-tight italic">
             {t('long_term_desc')}
           </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {longPositions.length === 0 ? (
          <div className="bg-aux-bg border border-text-main/5 p-24 text-center">
             <p className="text-text-muted/30 font-black uppercase tracking-[0.2em] text-xl leading-snug max-w-md mx-auto mb-4">
              {t('noActivePositions')}
            </p>
            <p className="text-text-muted/10 font-bold uppercase tracking-[0.1em] text-[10px]">
              {t('noActivePositionsDesc')}
            </p>
          </div>
        ) : (
          longPositions.map(pos => <PositionCard key={pos.id} position={pos} />)
        )}
      </div>
    </div>
  );
}
