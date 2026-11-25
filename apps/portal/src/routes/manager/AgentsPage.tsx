import { useCallback, useEffect, useState } from 'react';
import { CountyPicker } from '../../components/CountyPicker.js';
import { api } from '../../lib/api.js';
import { formatNairobi } from '../../lib/format.js';
import type {
  AgentView,
  County,
  PendingRegistration,
} from '../../lib/types.js';

function messageOf(caught: unknown): string {
  return caught instanceof Error ? caught.message : 'Something went wrong';
}

// Manager: approve new agents (choosing their counties, D31), change an
// agent's counties, or disable an agent. Rejecting a registration is the
// same as disabling it. The server enforces every rule.
export function AgentsPage() {
  const [pending, setPending] = useState<PendingRegistration[] | null>(null);
  const [agents, setAgents] = useState<AgentView[] | null>(null);
  const [counties, setCounties] = useState<County[]>([]);
  const [error, setError] = useState<string | null>(null);
  // The row being edited: a pending registration id or an agent userId.
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, a, c] = await Promise.all([
        api<PendingRegistration[]>('/agents/registrations'),
        api<AgentView[]>('/agents'),
        api<County[]>('/counties'),
      ]);
      setPending(p);
      setAgents(a);
      setCounties(c);
      setError(null);
    } catch (caught) {
      setError(messageOf(caught));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      setEditing(null);
      await load();
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  function startEdit(id: string, current: string[]) {
    setEditing(id);
    setDraft(current);
  }

  const approve = (userId: string) =>
    run(() =>
      api(`/agents/${userId}/approve`, {
        method: 'POST',
        body: { countyIds: draft },
      }),
    );
  const saveCounties = (userId: string) =>
    run(() =>
      api(`/agents/${userId}/counties`, {
        method: 'PUT',
        body: { countyIds: draft },
      }),
    );
  const enable = (userId: string) =>
    run(() => api(`/agents/${userId}/enable`, { method: 'POST' }));
  const disable = (userId: string, label: string) => {
    if (!window.confirm(`${label}? They will no longer be able to sign in.`)) {
      return Promise.resolve();
    }
    return run(() => api(`/agents/${userId}/disable`, { method: 'POST' }));
  };

  const editor = (onSave: () => Promise<unknown>, saveLabel: string) => (
    <div className="editor">
      <CountyPicker counties={counties} selected={draft} onChange={setDraft} />
      <div className="actions">
        <button
          type="button"
          className="primary"
          disabled={busy || draft.length === 0}
          onClick={() => void onSave()}
        >
          {saveLabel}
        </button>
        <button type="button" className="link" onClick={() => setEditing(null)}>
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <section>
      <h1>Agents</h1>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {(!pending || !agents) && !error && <p className="status">Loading…</p>}

      {pending && (
        <>
          <h2>Waiting for approval ({pending.length})</h2>
          {pending.length === 0 && (
            <p className="muted">No new registrations.</p>
          )}
          <ul className="list">
            {pending.map((person) => (
              <li key={person.id} className="item">
                <div className="row">
                  <div>
                    <strong>{person.name}</strong>
                    <br />
                    <span className="muted">
                      {person.phone} · registered{' '}
                      {formatNairobi(person.createdAt)}
                    </span>
                  </div>
                  {editing !== person.id && (
                    <div className="actions">
                      <button
                        type="button"
                        className="primary"
                        onClick={() => startEdit(person.id, [])}
                      >
                        Choose counties
                      </button>
                      <button
                        type="button"
                        className="link"
                        disabled={busy}
                        onClick={() =>
                          void disable(person.id, `Reject ${person.name}`)
                        }
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
                {editing === person.id &&
                  editor(() => approve(person.id), 'Approve agent')}
              </li>
            ))}
          </ul>
        </>
      )}

      {agents && (
        <>
          <h2>Agents ({agents.length})</h2>
          {agents.length === 0 && <p className="muted">No agents yet.</p>}
          <ul className="list">
            {agents.map((agent) => (
              <li key={agent.userId} className="item">
                <div className="row">
                  <div>
                    <strong>{agent.displayName}</strong>{' '}
                    {(!agent.active || agent.status !== 'ACTIVE') && (
                      <span className="badge cancelled">Disabled</span>
                    )}
                    <br />
                    <span className="muted">{agent.phone}</span>
                    <br />
                    <span className="muted">
                      {agent.counties.length > 0
                        ? agent.counties.map((c) => c.name).join(', ')
                        : 'No counties'}
                    </span>
                  </div>
                  {editing !== agent.userId && (
                    <div className="actions">
                      <button
                        type="button"
                        className="link"
                        onClick={() =>
                          startEdit(
                            agent.userId,
                            agent.counties.map((c) => c.id),
                          )
                        }
                      >
                        Edit counties
                      </button>
                      {agent.active && agent.status === 'ACTIVE' && (
                        <button
                          type="button"
                          className="link"
                          disabled={busy}
                          onClick={() =>
                            void disable(
                              agent.userId,
                              `Disable ${agent.displayName}`,
                            )
                          }
                        >
                          Disable
                        </button>
                      )}
                      {(!agent.active || agent.status !== 'ACTIVE') && (
                        <button
                          type="button"
                          className="link"
                          disabled={busy}
                          onClick={() => void enable(agent.userId)}
                        >
                          Re-enable
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {editing === agent.userId &&
                  editor(() => saveCounties(agent.userId), 'Save counties')}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
