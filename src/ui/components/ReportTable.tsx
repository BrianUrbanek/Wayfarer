import type { ReactNode } from 'react';

export interface ReportTableColumn<Row> {
  key: string;
  label: string;
  render: (row: Row) => ReactNode;
  align?: 'left' | 'right' | 'center';
}

interface ReportTableProps<Row> {
  columns: ReportTableColumn<Row>[];
  rows: Row[];
  getRowKey: (row: Row) => string;
  onRowClick?: (row: Row) => void;
  emptyTitle: string;
  emptyDescription: string;
  className?: string;
}

export function ReportTable<Row>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  emptyTitle,
  emptyDescription,
  className
}: ReportTableProps<Row>) {
  if (rows.length === 0) {
    return (
      <div className="empty-state">
        <strong>{emptyTitle}</strong>
        <p>{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className="report-table-wrap">
      <table className={`report-table${className ? ` ${className}` : ''}`}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={`report-table__cell report-table__cell--${column.align ?? 'left'}`}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = getRowKey(row);

            return (
              <tr
                key={key}
                className={onRowClick ? 'report-table__row report-table__row--clickable' : 'report-table__row'}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((column) => (
                  <td
                    key={`${key}-${column.key}`}
                    className={`report-table__cell report-table__cell--${column.align ?? 'left'}`}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
