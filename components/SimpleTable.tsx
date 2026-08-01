import type { ReactNode } from "react";

export function SimpleTable({
  caption,
  header,
  rows,
  firstColumnHeader = false,
}: {
  caption: string;
  header?: string[];
  rows: ReactNode[][];
  firstColumnHeader?: boolean;
}) {
  return (
    <div
      className="table-scroll"
      role="region"
      aria-label={`${caption}; scroll horizontally for more columns`}
      tabIndex={0}
    >
      <table className="simple">
        <caption className="sr-only">{caption}</caption>
        {header && (
          <thead>
            <tr>
              {header.map((h) => (
                <th key={h} scope="col">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) =>
                firstColumnHeader && j === 0 ? (
                  <th key={j} scope="row">
                    {cell}
                  </th>
                ) : (
                  <td key={j}>{cell}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
