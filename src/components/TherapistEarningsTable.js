import { peso } from "@/lib/format";

// rows: output of earningsByTherapist()
export default function TherapistEarningsTable({ rows }) {
  const totals = rows.reduce(
    (t, r) => ({ sessions: t.sessions + r.sessions, gross: t.gross + r.gross, commission: t.commission + r.commission }),
    { sessions: 0, gross: 0, commission: 0 },
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-xs">
        <thead className="text-[10px] uppercase tracking-wider text-muted">
          <tr>
            <th className="py-2">Therapist</th>
            <th className="py-2">Sessions</th>
            <th className="py-2">Gross sales</th>
            <th className="py-2">Rate</th>
            <th className="py-2">Commission</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="py-2.5 font-medium">{r.therapist}</td>
              <td className="py-2.5">{r.sessions}</td>
              <td className="py-2.5">{peso(r.gross)}</td>
              <td className="py-2.5 text-muted">{Math.round(r.rate * 100)}%</td>
              <td className="py-2.5 font-semibold text-forest">{peso(r.commission)}</td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td className="py-2.5">Total</td>
            <td className="py-2.5">{totals.sessions}</td>
            <td className="py-2.5">{peso(totals.gross)}</td>
            <td className="py-2.5" />
            <td className="py-2.5 text-forest">{peso(totals.commission)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
