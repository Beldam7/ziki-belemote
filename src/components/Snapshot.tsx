import { MY_ISSUES, OWNER, SNAPSHOT_DATE, ZIKI_BASE } from '../data/zikiSnapshot';

const STATUS_LABEL = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved' } as const;

export function Snapshot() {
  const goalPct = Math.min(100, Math.round((OWNER.points / OWNER.goal) * 100));
  return (
    <section className="panel" aria-labelledby="snap-title">
      <header className="panel-head">
        <div>
          <h2 id="snap-title">Your Ziki snapshot</h2>
          <p className="muted">
            Real data from ziki.dev, read on {new Date(SNAPSHOT_DATE).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}.
            It does not update on its own.
          </p>
        </div>
        <span className="tag source-ziki">From Ziki</span>
      </header>

      <div className="stats">
        <div className="stat">
          <span className="stat-value">{OWNER.points.toLocaleString()}</span>
          <span className="muted">points · goal {OWNER.goal} ({goalPct}%)</span>
        </div>
        {OWNER.breakdown.map((b) => (
          <div className="stat" key={b.label}>
            <span className="stat-value">{b.points.toLocaleString()}</span>
            <span className="muted">
              {b.label} ({b.entries})
            </span>
          </div>
        ))}
      </div>

      <div className="table-wrap">
        <table className="stack">
          <thead>
            <tr>
              <th>Issue</th>
              <th>Your part</th>
              <th>Status</th>
              <th>Severity</th>
              <th>PR</th>
            </tr>
          </thead>
          <tbody>
            {MY_ISSUES.map((i) => (
              <tr key={i.number}>
                <td data-label="Issue">
                  <a href={`${ZIKI_BASE}/issues/${i.number}`} target="_blank" rel="noreferrer">
                    #{i.number}
                  </a>{' '}
                  <span className="clip">{i.title}</span>
                </td>
                <td data-label="Your part">{i.role}</td>
                <td data-label="Status">
                  <span className={`tag status-${i.status}`}>{STATUS_LABEL[i.status]}</span>
                </td>
                <td data-label="Severity">{i.severity}</td>
                <td data-label="PR">
                  {i.pullRequest ? (
                    <a href={i.pullRequest} target="_blank" rel="noreferrer">
                      #{i.pullRequest.split('/').pop()}
                    </a>
                  ) : (
                    <span className="muted">None</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
