import { FormEvent, ReactNode, useMemo, useRef, useState } from 'react';
import { ArrowUp, Download, Loader2, MessageSquare, Sparkles } from 'lucide-react';
import { sendChatMessage, ChatMessage, ChatResponse, ChatTable } from '@/services/api/chatService';

const SUGGESTIONS = [
  'When did the scooter leave today?',
  'When did the SUV come and go yesterday?',
  'How many people were seen yesterday evening?',
  'Report for the last 7 days',
];

const fmt = (v: string | number | null): string => (v === null ? '—' : String(v));

function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-zinc-100">
          {p.slice(2, -2)}
        </strong>
      );
    }
    if (p.startsWith('`') && p.endsWith('`')) {
      return (
        <code key={i} className="rounded bg-zinc-800/80 px-1 py-0.5 font-mono text-[0.85em] text-sky-300">
          {p.slice(1, -1)}
        </code>
      );
    }
    return p;
  });
}

function Markdown({ content }: { content: string }) {
  const blocks: ReactNode[] = [];
  let list: ReactNode[] | null = null;
  let key = 0;
  const flush = () => {
    if (list) {
      blocks.push(
        <ul key={key++} className="my-1.5 space-y-1 list-none">
          {list}
        </ul>,
      );
      list = null;
    }
  };
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trimEnd();
    if (line.startsWith('## ')) {
      flush();
      blocks.push(
        <h2 key={key++} className="mt-3 mb-1 text-sm font-semibold tracking-wide text-zinc-100">
          {line.slice(3)}
        </h2>,
      );
    } else if (line.startsWith('# ')) {
      flush();
      blocks.push(
        <h1 key={key++} className="mb-2 text-base font-bold text-zinc-50">
          {line.slice(2)}
        </h1>,
      );
    } else if (line.startsWith('- ')) {
      (list = list ?? []).push(
        <li key={key++} className="flex gap-2 text-sm text-zinc-300">
          <span className="mt-[7px] h-1 w-1 flex-shrink-0 rounded-full bg-zinc-500" />
          <span>{renderInline(line.slice(2))}</span>
        </li>,
      );
    } else if (line.trim() === '') {
      flush();
    } else {
      flush();
      blocks.push(
        <p key={key++} className="my-1 text-sm leading-relaxed text-zinc-300">
          {renderInline(line)}
        </p>,
      );
    }
  }
  flush();
  return <div className="space-y-0.5">{blocks}</div>;
}

function TableView({ table }: { table: ChatTable }) {
  return (
    <div className="mt-2 overflow-x-auto">
      {table.caption && (
        <div className="mb-1 text-[11px] uppercase tracking-wider text-zinc-500">{table.caption}</div>
      )}
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {table.headers.map((h, i) => (
              <th
                key={i}
                className="border-b border-zinc-800 bg-zinc-900/40 px-2.5 py-1.5 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, ri) => (
            <tr key={ri} className="border-b border-zinc-800/50 last:border-0">
              {row.map((cell, ci) => (
                <td key={ci} className="px-2.5 py-1.5 text-zinc-300">
                  {fmt(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function toMarkdownFile(res: ChatResponse): string {
  const lines: string[] = [res.answer.content, ''];
  for (const t of res.tables) {
    if (t.caption) lines.push(`## ${t.caption}`);
    lines.push(`| ${t.headers.join(' | ')} |`);
    lines.push(`|${t.headers.map(() => '---').join('|')}|`);
    for (const row of t.rows) lines.push(`| ${row.map((c) => fmt(c)).join(' | ')} |`);
    lines.push('');
  }
  lines.push('---');
  lines.push(`Window: ${res.evidence.window}`);
  if (res.evidence.cameras.length) lines.push(`Cameras: ${res.evidence.cameras.join(', ')}`);
  lines.push(`Detections: ${res.evidence.detections} · Events: ${res.evidence.events}`);
  if (res.caveat) lines.push(`Note: ${res.caveat}`);
  return lines.join('\n');
}

interface UiMessage extends ChatMessage {
  response?: ChatResponse;
  error?: string;
  pending?: boolean;
}

export default function AskPage() {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const lastAssistant = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === 'assistant' && m.response && !m.pending) return m;
    }
    return null;
  }, [messages]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || sending) return;
    setInput('');
    setSending(true);
    const history: ChatMessage[] = messages
      .filter((m) => !m.pending)
      .map((m) => ({ role: m.role, content: m.content }));
    const userMsg: UiMessage = { role: 'user', content };
    const pendingMsg: UiMessage = { role: 'assistant', content: '', pending: true };
    setMessages((prev) => [...prev, userMsg, pendingMsg]);
    try {
      const response = await sendChatMessage(content, history);
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: 'assistant', content: response.answer.content, response };
        return copy;
      });
    } catch (err) {
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          role: 'assistant',
          content: '',
          error: err instanceof Error ? err.message : 'Request failed',
        };
        return copy;
      });
    } finally {
      setSending(false);
    }
  };

  const download = () => {
    if (!lastAssistant?.response) return;
    const blob = new Blob([toMarkdownFile(lastAssistant.response)], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sentryvision-report-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col px-4 pt-6 pb-28">
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <MessageSquare className="h-4 w-4" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-zinc-50">Ask</h1>
          <p className="text-xs text-zinc-500">Chat with your recorded detection data</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <div className="mt-10 space-y-3">
            <div className="flex items-start gap-2.5 text-zinc-500">
              <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <p className="text-sm leading-relaxed">
                Ask about vehicles coming and going, humans seen at certain times, or ask for a
                report over a period. All answers are computed from your recorded detections.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-zinc-800 bg-zinc-900/40 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            {m.pending ? (
              <div className="flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Thinking…
              </div>
            ) : m.error ? (
              <div className="max-w-[85%] rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {m.error}
              </div>
            ) : m.role === 'user' ? (
              <div className="max-w-[85%] rounded-2xl bg-primary/15 px-4 py-2.5 text-sm text-zinc-100">
                {m.content}
              </div>
            ) : (
              <div className="w-full max-w-[95%] rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 backdrop-blur-sm">
                <Markdown content={m.content} />
                {m.response?.tables.map((t, ti) => <TableView key={ti} table={t} />)}
                {m.response && (
                  <div className="mt-3 space-y-1.5 border-t border-zinc-800/70 pt-2.5">
                    <div className="text-[11px] leading-relaxed text-zinc-500">
                      {m.response.evidence.detections} detections · {m.response.evidence.events}{' '}
                      events · window: {m.response.evidence.window}
                      {m.response.evidence.cameras.length > 0 &&
                        ` · cameras: ${m.response.evidence.cameras.join(', ')}`}
                    </div>
                    {m.response.caveat && (
                      <div className="text-[11px] leading-relaxed text-zinc-600">{m.response.caveat}</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2">
        {lastAssistant?.response && lastAssistant.response.tool === 'period_report' && (
          <button
            onClick={download}
            className="flex h-10 flex-shrink-0 items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 text-xs text-zinc-400 transition-colors hover:text-zinc-200"
            aria-label="Download report"
          >
            <Download className="h-4 w-4" />
            .md
          </button>
        )}
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            send(input);
          }}
          className="flex flex-1 items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 focus-within:border-zinc-600"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. when did the scooter leave today?"
            className="h-9 w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
            aria-label="Send"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}