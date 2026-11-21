import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { JoinResult, SyncMode } from '../sync/cloud';
import { normalizeWorkspaceCode } from '../sync/workspace';
import { Button } from './Button';
import { Card } from './Card';
import { ConfirmDialog } from './ConfirmDialog';
import { Notice } from './Notice';
import { QrCode } from './QrCode';
import { TextField } from './TextField';

/** What Settings needs to show and change this device's sync workspace. */
export interface DeviceSync {
  mode: SyncMode;
  /** This device's workspace code. */
  workspaceCode: string;
  /** Link encoded in the QR code; opening it on another device offers to join. */
  joinUrl: string;
  /** Join another workspace (after the user confirmed). */
  join: (code: string) => Promise<JoinResult>;
  /** A code that arrived in a `#join=` link: the section asks to join it straight away. */
  initialCode?: string | null;
}

export interface SyncDevicesSectionProps {
  sync: DeviceSync;
  /** Called after a successful join, e.g. to reload the screens. */
  onJoined?: () => void | Promise<void>;
}

type Message = 'copied' | 'copyFailed' | 'joined' | 'same' | 'failed';

/** Static explanation text (not a live region: only results of actions are announced). */
const CALLOUT = 'rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-800';

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the old way
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

/**
 * "Sync devices" for Settings, shared by every app: shows this device's sync
 * code (copy button and QR code) and lets the user join another device's code
 * after a confirmation. In local-only mode it explains that sync is off.
 */
export function SyncDevicesSection({ sync, onJoined }: SyncDevicesSectionProps) {
  const { t } = useTranslation();
  const headingId = useId();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // A code from a scanned QR link: ask straight away (once per code).
  const handledInitial = useRef<string | null>(null);
  const { initialCode, workspaceCode } = sync;
  useEffect(() => {
    const incoming = initialCode ? normalizeWorkspaceCode(initialCode) : null;
    if (!incoming || handledInitial.current === incoming) return;
    handledInitial.current = incoming;
    setCode(incoming);
    if (incoming === workspaceCode) setMessage('same');
    else setConfirming(incoming);
  }, [initialCode, workspaceCode]);

  const heading = (
    <h3 id={headingId} className="text-base font-semibold text-gray-800">
      {t('syncDevices.title')}
    </h3>
  );

  if (sync.mode === 'local') {
    return (
      <section aria-labelledby={headingId} className="space-y-3">
        {heading}
        <p className={CALLOUT}>{t('syncDevices.localOnly')}</p>
      </section>
    );
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    const clean = normalizeWorkspaceCode(code);
    if (!clean) {
      setError(t('syncDevices.invalid'));
      return;
    }
    setError(null);
    if (clean === sync.workspaceCode) {
      setMessage('same');
      return;
    }
    setConfirming(clean);
  }

  async function confirmJoin() {
    if (!confirming || busy) return;
    setBusy(true);
    try {
      const result = await sync.join(confirming);
      setMessage(result === 'same' ? 'same' : 'joined');
      setCode('');
      await onJoined?.();
    } catch {
      setMessage('failed');
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  }

  const tone = message === 'failed' || message === 'copyFailed' ? 'error' : message === 'same' ? 'info' : 'success';

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      {heading}
      <p className="text-sm text-gray-600">{t('syncDevices.intro')}</p>

      <Card className="space-y-3">
        <p className="text-sm font-medium text-gray-700">{t('syncDevices.codeLabel')}</p>
        <p dir="ltr" className="select-all break-all text-start font-mono text-base font-semibold text-gray-900">
          {sync.workspaceCode}
        </p>
        <Button
          variant="secondary"
          onClick={() => {
            void copyText(sync.workspaceCode).then((ok) => setMessage(ok ? 'copied' : 'copyFailed'));
          }}
        >
          {t('syncDevices.copy')}
        </Button>
        <div className="flex justify-center">
          <QrCode value={sync.joinUrl} label={t('syncDevices.qrLabel')} />
        </div>
        <p className="text-sm text-gray-600">{t('syncDevices.qrHint')}</p>
        <p className={CALLOUT}>{t('syncDevices.secretWarning')}</p>
      </Card>

      {message && <Notice tone={tone}>{t(`syncDevices.${message}`)}</Notice>}

      <form onSubmit={submit} noValidate className="space-y-3">
        <TextField
          label={t('syncDevices.joinLabel')}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          dir="ltr"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={60}
          error={error ?? undefined}
        />
        <Button type="submit" variant="neutral" disabled={busy}>
          {t('syncDevices.joinButton')}
        </Button>
      </form>

      <ConfirmDialog
        open={confirming !== null}
        title={t('syncDevices.confirmTitle')}
        message={t('syncDevices.confirmMessage')}
        confirmLabel={t('syncDevices.confirmYes')}
        cancelLabel={t('syncDevices.cancel')}
        busy={busy}
        onCancel={() => setConfirming(null)}
        onConfirm={() => void confirmJoin()}
      />
    </section>
  );
}
