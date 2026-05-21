import type { RatingEventWeightRow } from '../../model/ratingEventWeight.js';

interface RatingEventWeightTableProps {
  rows: readonly RatingEventWeightRow[];
}

function toSigned(value: number, digits = 3): string {
  return value >= 0 ? `+${value.toFixed(digits)}` : value.toFixed(digits);
}

function toUnit(value: number): string {
  return value.toFixed(3);
}

export function RatingEventWeightTable({ rows }: RatingEventWeightTableProps) {
  return (
    <div className="card rating-event-weight-table">
      <div className="card__title-row">
        <strong>Rating Event Weight</strong>
      </div>
      <p className="muted rating-event-weight-table__helper">
        Trust comes from the rater; confidence comes from the current island/cohort read; current-context leverage is 1 - confidence.
      </p>
      {rows.length === 0 ? (
        <p className="muted">No rating events available for this island.</p>
      ) : (
        <div className="report-table-wrap rating-event-weight-table__wrap">
          <table className="report-table">
            <thead>
              <tr>
                <th scope="col">User</th>
                <th scope="col" className="report-table__cell--right">Rating</th>
                <th scope="col">Cohort</th>
                <th scope="col" className="report-table__cell--right">Trust proxy</th>
                <th scope="col" className="report-table__cell--right">Current confidence</th>
                <th scope="col" className="report-table__cell--right">Current-context leverage</th>
                <th scope="col" className="report-table__cell--right">Event weight</th>
                <th scope="col" className="report-table__cell--right">Directional contribution</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.eventId}-${row.cohortId}`}>
                  <td>{row.userId}</td>
                  <td className="report-table__cell--right">{toSigned(row.rating, 2)}</td>
                  <td>{row.cohortId}</td>
                  <td className="report-table__cell--right">{toUnit(row.trustWeight)}</td>
                  <td className="report-table__cell--right">{toUnit(row.currentContextConfidence)}</td>
                  <td className="report-table__cell--right">{toUnit(row.uncertaintyLeverage)}</td>
                  <td className="report-table__cell--right">{toUnit(row.eventWeight)}</td>
                  <td className="report-table__cell--right">{toSigned(row.directionalContribution)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
