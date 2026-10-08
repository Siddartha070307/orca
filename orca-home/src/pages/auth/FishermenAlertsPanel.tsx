/**
 * FishermenAlertsPanel — administrator Alert Sending page for fishermen.
 *
 * Reproduces the reference vessel.zip alert page (SendAlertModal + AlertHistory)
 * but wired into ORCA's existing stack:
 *   - transport: authService (cookie-only `orca_token`, credentials: 'include')
 *   - authorisation: server-side `require_admin` on every endpoint
 *   - delivery: ORCA's existing SMS dissemination gateway
 *     (app.dissemination.sms_client.sms_gateway, 160-char GSM enforced)
 *   - audit: the additive `alerts` table
 *
 * The live SMS preview mirrors the backend template composition exactly, so the
 * administrator reviews the precise text that will be dispatched.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BellRing,
  Send,
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
  Radio,
  FileText,
  Phone,
  Clock
} from 'lucide-react';
import {
  authService,
  AdminAlertDispatch,
  AdminAlertHistoryItem,
  SafeUser
} from '../../services/authService';

/** Alert types + templates — kept byte-identical to auth_routes.ALERT_TEMPLATES. */
const ALERT_TEMPLATES: Record<string, string> = {
  CYCLONE:
    'ORCA ALERT: Severe cyclone near your fishing area. Strong winds/high waves. Move to safe harbor now. CG:1554',
  HIGH_WAVE:
    'ORCA ALERT: High waves detected near your position. Avoid going further offshore, move toward safe area.',
  STRONG_WIND:
    'ORCA ALERT: Strong winds in your fishing area. Follow the safe route and return toward shore if advised.',
  VESSEL_GEOFENCE:
    'ORCA ALERT: Your vessel is in a restricted/unsafe marine zone. Verify position and follow authorized navigation guidance.',
  RETURN_TO_SHORE:
    'ORCA ALERT: Weather deteriorating offshore. Return to the nearest safe landing port immediately.',
  EMERGENCY:
    'ORCA ALERT: Maritime hazard in your operating sector. Heed emergency broadcast, contact Coast Guard 1554 if in distress.',
  GENERAL: 'ORCA ALERT: {{message}} Please follow safety instructions.'
};

const ALERT_TYPE_OPTIONS = [
  'HIGH_WAVE',
  'STRONG_WIND',
  'CYCLONE',
  'VESSEL_GEOFENCE',
  'RETURN_TO_SHORE',
  'EMERGENCY',
  'GENERAL'
] as const;

const TYPE_LABELS: Record<string, string> = {
  HIGH_WAVE: 'High Wave',
  STRONG_WIND: 'Strong Wind',
  CYCLONE: 'Cyclone',
  VESSEL_GEOFENCE: 'Vessel Geofence',
  RETURN_TO_SHORE: 'Return To Shore',
  EMERGENCY: 'Emergency',
  GENERAL: 'General Advisory'
};

const GSM_LIMIT = 160;

function maskPhone(phone?: string | null): string {
  if (!phone) return '—';
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 4 ? `+${digits.slice(0, 2)}******${digits.slice(-4)}` : phone;
}

/** Mirrors `_build_alert_message()` on the backend (template → note → vessel → 160 cap). */
function buildAlertPreview(
  alertType: string,
  note: string,
  vesselName?: string | null
): { text: string; rawLength: number } {
  const template = ALERT_TEMPLATES[alertType] || ALERT_TEMPLATES.GENERAL;
  const trimmed = note.trim();
  let text: string;

  if (alertType === 'GENERAL') {
    text = template.replace('{{message}}', trimmed || 'Maritime safety advisory in effect.');
  } else {
    text = trimmed ? `${template} Note: ${trimmed}` : template;
  }
  if (vesselName) {
    text = `${text} Vessel: ${vesselName}.`;
  }
  return { text: text.slice(0, GSM_LIMIT), rawLength: text.length };
}

function formatTimestamp(iso: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export const FishermenAlertsPanel: React.FC = () => {
  // Recipient directory
  const [fishermen, setFishermen] = useState<SafeUser[]>([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [directoryLoading, setDirectoryLoading] = useState(false);

  // Alert form
  const [alertType, setAlertType] = useState<string>('HIGH_WAVE');
  const [note, setNote] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [sending, setSending] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<AdminAlertDispatch | null>(null);

  // Banners
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Alert history
  const [history, setHistory] = useState<AdminAlertHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACCEPTED' | 'FAILED'>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | string>('ALL');

  const selected = useMemo(
    () => fishermen.find((f) => f.id === selectedId) || null,
    [fishermen, selectedId]
  );

  const preview = useMemo(
    () => buildAlertPreview(alertType, note, (selected?.profile as any)?.vessel_name),
    [alertType, note, selected]
  );

  const filteredFishermen = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return fishermen;
    return fishermen.filter((f) => {
      const vessel = String((f.profile as any)?.vessel_name || '');
      const location = String((f.profile as any)?.location || '');
      return (
        f.full_name.toLowerCase().includes(term) ||
        (f.phone_number || '').includes(term) ||
        vessel.toLowerCase().includes(term) ||
        location.toLowerCase().includes(term)
      );
    });
  }, [fishermen, search]);

  const filteredHistory = useMemo(
    () =>
      history.filter(
        (a) =>
          (statusFilter === 'ALL' || a.status === statusFilter) &&
          (typeFilter === 'ALL' || a.alert_type === typeFilter)
      ),
    [history, statusFilter, typeFilter]
  );

  const fetchDirectory = useCallback(async () => {
    setDirectoryLoading(true);
    setErrorMessage(null);
    try {
      const data = await authService.listFishermen();
      setFishermen(data.fishermen || []);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to load the fisherman directory.');
    } finally {
      setDirectoryLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await authService.listFishermanAlerts();
      setHistory(data.alerts || []);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to load alert history.');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDirectory();
    void fetchHistory();
  }, [fetchDirectory, fetchHistory]);

  const handleSend = async () => {
    if (!selected || !confirmed || sending) return;

    setSending(true);
    setMessage(null);
    setErrorMessage(null);
    setDispatchResult(null);
    try {
      const result = await authService.sendFishermanAlert({
        recipient_user_id: selected.id,
        alert_type: alertType,
        custom_message: note.trim() || undefined
      });
      setDispatchResult(result);
      setMessage(
        `Alert ${result.alert_id} dispatched to ${selected.full_name} (${result.recipient_masked}) via ${result.provider} — ${result.char_count} chars.`
      );
      setNote('');
      setConfirmed(false);
      await fetchHistory();
    } catch (err: any) {
      setErrorMessage(err?.message || 'The alert could not be dispatched.');
    } finally {
      setSending(false);
    }
  };

  const inputClass =
    'w-full px-3 py-2 rounded-lg bg-[#03141F] border border-slate-700 text-white text-xs outline-none transition-colors placeholder:text-slate-400 focus:border-[#16C7C7] focus-visible:ring-2 focus-visible:ring-[#16C7C7]/60 disabled:opacity-50 disabled:cursor-not-allowed';
  const labelClass = 'block text-[11px] font-mono font-semibold text-slate-300 mb-1';

  return (
    <section aria-label="Fisherman alerts">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div>
          <h2 className="text-lg font-extrabold text-white font-heading flex items-center gap-2">
            <BellRing className="w-5 h-5 text-[#F5B942]" />
            <span>Fisherman Alert Sending</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Dispatch marine safety alerts to registered fishermen over ORCA&apos;s SMS dissemination
            channel
          </p>
        </div>

        <button
          onClick={() => {
            void fetchDirectory();
            void fetchHistory();
          }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#082A36] border border-[#16C7C7]/30 text-[#28D7E5] text-xs font-semibold cursor-pointer hover:bg-[#16C7C7]/15 transition-colors"
          title="Refresh directory and alert history"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${directoryLoading || historyLoading ? 'animate-spin' : ''}`}
          />
          <span>Refresh</span>
        </button>
      </div>

      {/* Status banners */}
      {message && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#36D399] shrink-0" />
          <span>{message}</span>
        </div>
      )}
      {errorMessage && (
        <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Compose area: recipient picker + alert form */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-8">
        {/* Recipient picker */}
        <div className="lg:col-span-2 rounded-2xl ocean-glass border border-slate-700/80 overflow-hidden shadow-lg flex flex-col">
          <div className="px-4 py-3 bg-[#061F2C] border-b border-slate-700 flex items-center justify-between gap-2">
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-200">
              Recipients
            </span>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                placeholder="Search name, vessel, port..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search fisherman recipients"
                className="pl-7 pr-2 py-1.5 w-44 rounded-lg bg-[#03141F] border border-slate-700 text-white text-[11px] outline-none focus:border-[#16C7C7] focus-visible:ring-2 focus-visible:ring-[#16C7C7]/60 placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/80">
            {directoryLoading && fishermen.length === 0 ? (
              <div className="text-center py-10 text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#16C7C7]" />
                <p className="text-[11px] font-mono">Loading recipients...</p>
              </div>
            ) : filteredFishermen.length === 0 ? (
              <div className="text-center py-10 text-slate-400 px-4">
                <Phone className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                <p className="text-xs font-semibold text-slate-300">No fishermen found</p>
                <p className="text-[11px] font-mono mt-1">
                  Register fishermen in the Fishermen Registry tab first.
                </p>
              </div>
            ) : (
              filteredFishermen.map((f) => {
                const isActive = f.is_active;
                const isSelected = f.id === selectedId;
                return (
                  <button
                    key={f.id}
                    type="button"
                    disabled={!isActive}
                    aria-pressed={isSelected}
                    onClick={() => setSelectedId(isSelected ? null : f.id)}
                    className={`w-full text-left px-4 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#16C7C7] disabled:cursor-not-allowed disabled:opacity-50 ${
                      isSelected
                        ? 'bg-[#16C7C7]/15 border-l-2 border-[#16C7C7]'
                        : 'border-l-2 border-transparent hover:bg-[#061F2C]/70'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-100 truncate">
                        {f.full_name}
                      </span>
                      {!isActive && (
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 shrink-0">
                          DEACTIVATED
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400 font-mono">
                      <span>{maskPhone(f.phone_number)}</span>
                      {(f.profile as any)?.vessel_name && (
                        <span className="truncate">• {(f.profile as any).vessel_name}</span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Alert form */}
        <div className="lg:col-span-3 rounded-2xl ocean-glass border border-slate-700/80 p-5 shadow-lg">
          <h3 className="text-xs uppercase tracking-wider font-bold text-slate-200 flex items-center gap-2 mb-4">
            <Send className="w-3.5 h-3.5 text-[#F5B942]" />
            Send Alert
          </h3>

          {/* Target summary (mirrors reference target metadata card) */}
          <div className="mb-4 p-3 rounded-xl bg-[#061F2C] border border-slate-700/80">
            {selected ? (
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-xs">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <Phone className="w-3.5 h-3.5 text-[#16C7C7]" />
                  <span className="font-mono">{maskPhone(selected.phone_number)}</span>
                </span>
                <span className="text-slate-300">
                  <span className="text-slate-500">Fisherman: </span>
                  {selected.full_name}
                </span>
                <span className="text-slate-300">
                  <span className="text-slate-500">Vessel: </span>
                  {(selected.profile as any)?.vessel_name || '—'}
                </span>
                <span className="text-slate-300">
                  <span className="text-slate-500">Port: </span>
                  {(selected.profile as any)?.location || '—'}
                </span>
              </div>
            ) : (
              <p className="text-xs text-slate-400 font-mono">
                Select a fisherman from the recipients list to target this alert.
              </p>
            )}
          </div>

          {/* Alert type */}
          <div className="mb-4">
            <label htmlFor="alert-type" className={labelClass}>
              Alert Type
            </label>
            <select
              id="alert-type"
              value={alertType}
              onChange={(e) => setAlertType(e.target.value)}
              className={inputClass}
            >
              {ALERT_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]} ({t})
                </option>
              ))}
            </select>
          </div>

          {/* Operator note */}
          <div className="mb-4">
            <label htmlFor="alert-note" className={labelClass}>
              Operator Note (optional, appended to the template)
            </label>
            <textarea
              id="alert-note"
              rows={2}
              maxLength={120}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Avoid Mandapam sector until 18:00 IST."
              className={`${inputClass} resize-none`}
            />
            <p className="text-[10px] font-mono text-slate-400 mt-1">{note.length}/120 characters</p>
          </div>

          {/* Exact SMS preview */}
          <div className="mb-4">
            <span className={labelClass}>
              <span className="inline-flex items-center gap-1.5">
                <Radio className="w-3 h-3 text-[#16C7C7]" />
                Exact SMS Preview
              </span>
            </span>
            <div className="p-3 rounded-xl bg-[#03141F] border border-[#16C7C7]/30">
              <p className="text-xs text-slate-100 font-mono leading-relaxed break-words">
                {preview.text}
              </p>
              <p
                className={`text-[10px] font-mono mt-2 ${
                  preview.rawLength > GSM_LIMIT ? 'text-amber-300' : 'text-emerald-300'
                }`}
              >
                {preview.rawLength > GSM_LIMIT
                  ? `${preview.rawLength} chars composed — truncated to ${GSM_LIMIT} for the GSM SMS limit`
                  : `${preview.text.length}/${GSM_LIMIT} characters`}
              </p>
            </div>
          </div>

          {/* Decision-support disclaimer (from the reference) */}
          <div className="mb-4 p-3 rounded-xl bg-amber-950/40 border border-amber-500/30 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-200 leading-relaxed">
              Decision-support advisory only. This alert does not replace official instructions from
              the Coast Guard or local authorities.
            </p>
          </div>

          {/* Confirmation checkbox */}
          <label className="flex items-start gap-2.5 text-xs text-slate-200 cursor-pointer mb-4">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 accent-[#16C7C7] cursor-pointer"
            />
            <span>
              I have reviewed the exact SMS text above and confirm dispatch to the selected
              fisherman.
            </span>
          </label>

          <button
            type="button"
            onClick={handleSend}
            disabled={!selected || !confirmed || sending}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#F5B942] hover:bg-[#FFD271] text-slate-950 text-xs font-bold cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
            <span>{sending ? 'Dispatching…' : 'Send Alert'}</span>
          </button>

          {/* Dispatch result (mirrors reference result display) */}
          {dispatchResult && (
            <div className="mt-4 p-3 rounded-xl bg-[#061F2C] border border-[#16C7C7]/35 text-xs space-y-1">
              <p className="flex items-center gap-2 text-[#28D7E5] font-semibold">
                <CheckCircle2 className="w-4 h-4 text-[#36D399]" />
                {dispatchResult.alert_id} — {dispatchResult.status}
              </p>
              <p className="text-slate-300 font-mono">
                Recipient: {dispatchResult.recipient_masked} • Gateway: {dispatchResult.provider} •{' '}
                {dispatchResult.char_count} chars
              </p>
              <p className="text-slate-400 font-mono break-words">
                “{dispatchResult.message_preview}”
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Alert history (reference AlertHistoryPage, restyled to the admin console) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <h3 className="text-xs uppercase tracking-wider font-bold text-slate-200 flex items-center gap-2">
          <FileText className="w-3.5 h-3.5 text-[#16C7C7]" />
          Alert History
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-mono text-slate-400">Status:</span>
          {(['ALL', 'ACCEPTED', 'FAILED'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-all cursor-pointer ${
                statusFilter === s
                  ? 'bg-[#F5B942] text-slate-950 font-bold'
                  : 'bg-[#061F2C] border border-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              {s}
            </button>
          ))}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label="Filter alert history by type"
            className="px-2 py-1 rounded-lg bg-[#03141F] border border-slate-700 text-slate-200 text-[11px] font-mono outline-none focus:border-[#16C7C7] focus-visible:ring-2 focus-visible:ring-[#16C7C7]/60"
          >
            <option value="ALL">ALL TYPES</option>
            {ALERT_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button
            onClick={() => void fetchHistory()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#082A36] border border-[#16C7C7]/30 text-[#28D7E5] text-[11px] font-semibold cursor-pointer hover:bg-[#16C7C7]/15 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${historyLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {historyLoading && history.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#16C7C7]" />
          <p className="text-xs font-mono">Loading alert history...</p>
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className="rounded-2xl ocean-glass border border-slate-800 p-10 text-center text-slate-400">
          <BellRing className="w-10 h-10 mx-auto mb-3 text-slate-600" />
          <p className="text-sm font-semibold text-slate-300">No alerts dispatched yet</p>
          <p className="text-xs font-mono mt-1 text-slate-400">
            Dispatched alerts appear here with their gateway delivery status.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl ocean-glass border border-slate-700/80 overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#061F2C] text-[10px] uppercase tracking-wider text-slate-200 border-b border-slate-700">
                <tr>
                  <th className="px-4 py-3 font-semibold">Sent At</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Recipient</th>
                  <th className="px-4 py-3 font-semibold">Vessel</th>
                  <th className="px-4 py-3 font-semibold">Message</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Chars</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredHistory.map((a) => (
                  <tr key={a.id} className="hover:bg-[#061F2C]/70 transition-colors align-top">
                    <td className="px-4 py-3 font-mono text-slate-400 whitespace-nowrap">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-slate-500" />
                        {formatTimestamp(a.created_at)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded bg-[#03141F] border border-slate-700 text-[10px] font-mono font-semibold text-[#28D7E5] whitespace-nowrap">
                        {a.alert_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-slate-200">{a.recipient_name || '—'}</div>
                      <div className="font-mono text-slate-500 text-[11px]">
                        {a.recipient_masked}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                      {a.vessel_name || '—'}
                    </td>
                    <td className="px-4 py-3 max-w-md">
                      <p className="line-clamp-2 text-slate-400 font-mono text-[11px]">
                        {a.message}
                      </p>
                      <p className="text-[10px] font-mono text-slate-600 mt-0.5">{a.id}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                          a.status === 'ACCEPTED'
                            ? 'bg-emerald-950/70 border border-emerald-500/40 text-emerald-300'
                            : a.status === 'FAILED'
                              ? 'bg-red-950/70 border border-red-500/40 text-red-300'
                              : 'bg-amber-950/70 border border-amber-500/40 text-amber-300'
                        }`}
                      >
                        {a.status}
                      </span>
                      {a.failure_reason && (
                        <p className="text-[10px] text-red-400 mt-1 max-w-[10rem]">
                          {a.failure_reason}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-400">{a.char_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
};
