import { useEffect, useState } from 'react';
import { formatTime, useNow, useTranslation } from '@skeleton/core';
import type { ClinicDerived } from '../clinic.types';
import { Logo } from '../components/Logo';
import { TokenLabel } from '../components/TokenLabel';
import { displayClinicName } from '../components/format';

const CONTROL =
  'inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-white/30 px-4 text-base font-semibold text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';

/**
 * Full-screen "Now Serving" board for a waiting-room TV or tablet.
 * Shows token numbers only (no patient names: they are private), the current
 * token as large as the screen allows and the next three. The App keeps it
 * fresh by polling local data, so it follows the reception phone's actions
 * from another tab or through sync, with no internet needed.
 */
export function DisplayScreen({ derived, onExit }: { derived: ClinicDerived; onExit: () => void }) {
  const { t } = useTranslation();
  const now = useNow(15_000);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement != null);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const current = derived.queue.serving[0];
  const next = derived.queue.waiting.slice(0, 3);
  const canFullscreen = typeof document.documentElement.requestFullscreen === 'function';

  return (
    <div className="flex min-h-screen flex-col bg-gray-950 text-white">
      <header className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <Logo className="h-10 w-10 shrink-0" />
          <h1 className="min-w-0 break-words text-2xl font-bold">{displayClinicName(derived.settings, t)}</h1>
        </div>
        <div className="flex items-center gap-2">
          <span dir="ltr" className="font-sans text-3xl font-bold tabular-nums text-brand-200">
            {formatTime(now.toISOString())}
          </span>
          {canFullscreen && !isFullscreen && (
            <button type="button" className={CONTROL} onClick={() => void document.documentElement.requestFullscreen()}>
              {t('clinic.display.fullscreen')}
            </button>
          )}
          <button type="button" className={CONTROL} onClick={onExit}>
            {t('clinic.display.exit')}
          </button>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
        <h2 className="text-3xl font-semibold text-brand-200">{t('clinic.display.nowServing')}</h2>
        {current ? (
          <div aria-live="polite" className="animate-pop-in" key={current.id}>
            <TokenLabel label={current.label} size="none" className="text-[clamp(5rem,26vw,22rem)] leading-none text-white" />
          </div>
        ) : (
          <p className="text-2xl text-gray-300">{t('clinic.display.pleaseWait')}</p>
        )}
      </main>

      <section aria-labelledby="display-next" className="border-t border-white/10 px-6 py-6">
        <h2 id="display-next" className="mb-3 text-center text-2xl font-semibold text-brand-200">
          {t('clinic.display.next')}
        </h2>
        {next.length === 0 ? (
          <p className="text-center text-xl text-gray-300">{t('clinic.display.noOneNext')}</p>
        ) : (
          <ol className="grid grid-cols-3 gap-3">
            {next.map((token) => (
              <li key={token.id} className="rounded-2xl bg-white/10 py-4 text-center">
                <TokenLabel label={token.label} size="none" className="text-[clamp(1.75rem,8vw,5rem)] text-white" />
              </li>
            ))}
          </ol>
        )}
        <p className="mt-4 text-center text-sm text-gray-400">{t('clinic.display.updates')}</p>
      </section>
    </div>
  );
}
