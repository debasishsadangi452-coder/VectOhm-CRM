import React, { useState } from 'react';
import { ExternalLink, KeyRound, Loader2, Share2, Unplug } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import { ApiError, resolveApiAssetUrl } from '@/lib/api/client';
import {
  useJobBoardConnections,
  useConnectJobBoard,
  useDisconnectJobBoard,
} from '@/hooks/use-job-board-connections';
import {
  useAggregatorConnection,
  useConnectAggregator,
  useDisconnectAggregator,
} from '@/hooks/use-aggregator-connection';
import { JOB_BOARD_LABELS, type JobBoard } from '@/lib/api/recruitment';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { BulkEmailSenderSection } from '@/components/bulk-email-sender-section';

// The 8 boards that take stored credentials -- Indeed (public feed) and
// Google for Jobs (structured data) have no credential concept, see the
// "always live" cards below. Mirrors CONNECTABLE_BOARDS in
// server/src/modules/job-board-syndication/job-board-connection.service.ts.
const CONNECTABLE_BOARDS: JobBoard[] = [
  'LINKEDIN',
  'NAUKRI',
  'GLASSDOOR',
  'ZIPRECRUITER',
  'MONSTER',
  'DICE',
  'SIMPLYHIRED',
  'CAREERBUILDER',
];

export const SettingsView: React.FC = () => {
  return (
    <div className="flex-1 min-w-0 p-6 space-y-6 overflow-y-auto">
      <BulkEmailSenderSection />
      <AggregatorConnectionPanel />
      <JobBoardConnectionsPanel />
    </div>
  );
};

// A single commercial job-distribution aggregator (Broadbean, Appcast,
// JobTarget, etc.) that fans one posting out to many boards -- the
// alternative to negotiating a direct partnership with each board below,
// which realistically requires an ATS vendor's volume rather than one
// company's. Connecting one here only stores its credentials for now (see
// AggregatorClient in server/src/modules/job-board-syndication/adapters) --
// wiring an actual vendor's request/response shape into the board adapters
// is a separate step once one is chosen.
function AggregatorConnectionPanel() {
  const currentUser = useAuthStore((s) => s.user);
  const canManage =
    currentUser?.role.name === 'ADMIN' ||
    (currentUser?.role.name === 'MANAGER' && currentUser?.department?.name === 'Recruitment');

  const { data: status, isLoading } = useAggregatorConnection();
  const connect = useConnectAggregator();
  const disconnect = useDisconnectAggregator();
  const [provider, setProvider] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await connect.mutateAsync({ provider: provider.trim(), baseUrl: baseUrl.trim(), apiKey: apiKey.trim() });
      setProvider('');
      setBaseUrl('');
      setApiKey('');
      toast.success('Job distribution aggregator connected');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not connect');
    }
  }

  async function handleDisconnect() {
    setError(null);
    try {
      await disconnect.mutateAsync();
      toast.success('Job distribution aggregator disconnected');
    } catch {
      setError('Could not disconnect');
    }
  }

  return (
    <Card className="bg-white border-slate-200/90 rounded-2xl shadow-2xs p-4 space-y-3">
      <div className="flex items-start gap-2.5">
        <div className="size-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
          <Share2 className="size-4" />
        </div>
        <div>
          <h3 className="text-sm font-extrabold text-slate-900">Job Distribution Aggregator</h3>
          <p className="text-[11px] text-slate-500 font-medium max-w-2xl">
            A paid distribution service (Broadbean, Appcast, JobTarget, etc.) posts to LinkedIn, Monster,
            CareerBuilder, Dice, Glassdoor, ZipRecruiter and more from one connection -- no direct
            partnership with each board required. Connecting one here stores its credentials; a developer
            still needs to wire up that vendor's specific API before postings actually go out through it.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="size-3.5 animate-spin" /> Loading…
        </div>
      ) : status?.connected ? (
        <div className="border border-slate-200 rounded-xl p-3 space-y-2 bg-white max-w-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800">{status.provider}</span>
            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] font-bold">
              Connected
            </Badge>
          </div>
          <p className="text-[10px] text-slate-500 font-medium truncate">{status.baseUrl}</p>
          {!canManage ? (
            <p className="text-[10px] text-slate-400 font-medium">
              Set up by {status.connectedByName ?? 'a manager'}
            </p>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDisconnect}
              disabled={disconnect.isPending}
              className="h-7 text-[10px] font-bold text-red-600 hover:text-red-700 px-2 gap-1"
            >
              {disconnect.isPending ? <Loader2 className="size-3 animate-spin" /> : <Unplug className="size-3" />}
              Disconnect
            </Button>
          )}
        </div>
      ) : !canManage ? (
        <p className="text-[10px] text-slate-400 font-medium">
          Not connected. Ask a Recruitment manager to connect one.
        </p>
      ) : (
        <form onSubmit={handleConnect} className="grid grid-cols-1 sm:grid-cols-3 gap-2 max-w-2xl items-end">
          <div className="space-y-1">
            <Label htmlFor="aggregator-provider" className="text-[10px] font-bold text-slate-600">
              Provider name
            </Label>
            <Input
              id="aggregator-provider"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              placeholder="e.g. Broadbean"
              required
              className="h-7 text-[11px] rounded-lg"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="aggregator-base-url" className="text-[10px] font-bold text-slate-600">
              API base URL
            </Label>
            <Input
              id="aggregator-base-url"
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.example.com"
              required
              className="h-7 text-[11px] rounded-lg"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="aggregator-api-key" className="text-[10px] font-bold text-slate-600">
              API key
            </Label>
            <Input
              id="aggregator-api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="API key"
              required
              className="h-7 text-[11px] rounded-lg"
            />
          </div>
          <div className="sm:col-span-3">
            <Button type="submit" size="sm" disabled={connect.isPending} className="h-7 text-[10px] font-bold rounded-lg">
              {connect.isPending ? <Loader2 className="size-3 animate-spin" /> : 'Connect'}
            </Button>
          </div>
        </form>
      )}
      {error && <p className="text-[10px] text-red-600 font-medium">{error}</p>}
    </Card>
  );
}

function JobBoardConnectionsPanel() {
  const currentUser = useAuthStore((s) => s.user);
  const canManage =
    currentUser?.role.name === 'ADMIN' ||
    (currentUser?.role.name === 'MANAGER' && currentUser?.department?.name === 'Recruitment');

  const { data: connections = [], isLoading } = useJobBoardConnections();

  return (
    <Card className="bg-white border-slate-200/90 rounded-2xl shadow-2xs p-4 space-y-3">
      <div className="flex items-start gap-2.5">
        <div className="size-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
          <KeyRound className="size-4" />
        </div>
        <div>
          <h3 className="text-sm font-extrabold text-slate-900">Job Board Connections</h3>
          <p className="text-[11px] text-slate-500 font-medium max-w-2xl">
            Store API credentials for each board so they're ready to go the moment we get partner API
            access. Postings stay simulated on these boards until then -- their listings link to our
            own careers page in the meantime, so applications still land here regardless.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="size-3.5 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {CONNECTABLE_BOARDS.map((board) => (
            <JobBoardConnectionCard
              key={board}
              board={board}
              status={connections.find((c) => c.board === board)}
              canManage={!!canManage}
              feedHref={board === 'LINKEDIN' ? resolveApiAssetUrl('/job-board-feeds/linkedin.xml') : undefined}
            />
          ))}
          <AlwaysActiveCard
            label="Indeed"
            description="No credentials needed — postings appear automatically via a public XML feed."
            href={resolveApiAssetUrl('/job-board-feeds/indeed.xml')!}
          />
          <AlwaysActiveCard
            label="Google for Jobs"
            description="No credentials needed — Google indexes the structured data already on our careers page."
            href="/careers"
          />
        </div>
      )}
    </Card>
  );
}

function AlwaysActiveCard({ label, description, href }: { label: string; description: string; href: string }) {
  return (
    <div className="border border-dashed border-slate-200 rounded-xl p-3 bg-slate-50/60 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-800">{label}</span>
        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] font-bold">
          Always active
        </Badge>
      </div>
      <p className="text-[10px] text-slate-500 font-medium">{description}</p>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="text-[10px] font-bold text-blue-600 hover:underline inline-flex items-center gap-1"
      >
        {href === '/careers' ? 'View careers page' : 'View feed'} <ExternalLink className="size-2.5" />
      </a>
    </div>
  );
}

function JobBoardConnectionCard({
  board,
  status,
  canManage,
  feedHref,
}: {
  board: JobBoard;
  status: { connected: boolean; connectedByName: string | null } | undefined;
  canManage: boolean;
  // Free organic feed (LinkedIn's Job Wrapping, etc.) -- independent of the
  // paid partner API key below, so it's worth surfacing even before/without
  // ever connecting one.
  feedHref?: string;
}) {
  const connectBoard = useConnectJobBoard();
  const disconnectBoard = useDisconnectJobBoard();
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const label = JOB_BOARD_LABELS[board];

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await connectBoard.mutateAsync({ board, apiKey: apiKey.trim() });
      setApiKey('');
      toast.success(`${label} connected`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not connect');
    }
  }

  async function handleDisconnect() {
    setError(null);
    try {
      await disconnectBoard.mutateAsync(board);
    } catch {
      setError('Could not disconnect');
    }
  }

  return (
    <div className="border border-slate-200 rounded-xl p-3 space-y-2 bg-white">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-800">{label}</span>
        {status?.connected ? (
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] font-bold">Connected</Badge>
        ) : (
          <Badge className="bg-slate-100 text-slate-500 border-slate-200 text-[9px] font-bold">Not connected</Badge>
        )}
      </div>

      {!canManage ? (
        <p className="text-[10px] text-slate-400 font-medium">
          {status?.connected ? `Set up by ${status.connectedByName ?? 'a manager'}` : 'Ask a Recruitment manager to connect this.'}
        </p>
      ) : status?.connected ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleDisconnect}
          disabled={disconnectBoard.isPending}
          className="h-7 text-[10px] font-bold text-red-600 hover:text-red-700 px-2 gap-1"
        >
          {disconnectBoard.isPending ? <Loader2 className="size-3 animate-spin" /> : <Unplug className="size-3" />}
          Disconnect
        </Button>
      ) : (
        <form onSubmit={handleConnect} className="space-y-1.5">
          <Label htmlFor={`board-key-${board}`} className="sr-only">
            {label} API key
          </Label>
          <Input
            id={`board-key-${board}`}
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="API key"
            required
            className="h-7 text-[11px] rounded-lg"
          />
          <Button type="submit" size="sm" disabled={connectBoard.isPending} className="h-7 text-[10px] font-bold w-full rounded-lg">
            {connectBoard.isPending ? <Loader2 className="size-3 animate-spin" /> : 'Connect'}
          </Button>
        </form>
      )}
      {feedHref && (
        <a
          href={feedHref}
          target="_blank"
          rel="noreferrer"
          className="text-[10px] font-bold text-blue-600 hover:underline inline-flex items-center gap-1"
        >
          View free feed <ExternalLink className="size-2.5" />
        </a>
      )}
      {error && <p className="text-[10px] text-red-600 font-medium">{error}</p>}
    </div>
  );
}
