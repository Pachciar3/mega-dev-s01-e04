import type { DigestRow, NightDigest } from '../digest/types.js';

// Missing data renders as "—", never as an empty cell (styleguide).
const dash = (v: string | null) => v ?? '—';

// Flags a row that needs a look: any fail, or 3 or more retries (plan § 2a).
export function flagFor(row: DigestRow): string | null {
  const flags: string[] = [];
  if (row.fails > 0) flags.push(`fail ×${row.fails}`);
  if (row.retries >= 3) flags.push(`retry ×${row.retries}`);
  return flags.length > 0 ? flags.join(' · ') : null;
}

export function DigestPage({ digest }: { digest: NightDigest }) {
  return (
    <>
      <h1>digest · {digest.night}</h1>
      {digest.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last</th>
              <th>last error</th>
              <th>first</th>
              <th>last time</th>
              <th>flag</th>
            </tr>
          </thead>
          <tbody>
            {digest.rows.map((row) => {
              const flag = flagFor(row);
              return (
                <tr>
                  <td>{row.job}</td>
                  <td>{dash(row.owner)}</td>
                  <td>{row.runs}</td>
                  <td>{row.retries}</td>
                  <td>{row.lastStatus}</td>
                  <td>{dash(row.lastError)}</td>
                  <td>{row.firstAt}</td>
                  <td>{row.lastAt}</td>
                  <td>{flag ? <span class="warn">{flag}</span> : <span class="mute">—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {digest.badLines > 0 && (
        <p class="mute">{digest.badLines} unreadable line(s) skipped</p>
      )}
    </>
  );
}
