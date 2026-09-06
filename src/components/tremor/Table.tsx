// Tremor Table [v1.0.0]
//
// Repris tel quel, à une chose près : les gris de Tailwind livrés par Tremor
// laissent la place aux jetons du thème (`border`, `ink`, `muted`), sinon le
// tableau arriverait avec sa propre échelle de gris à côté de celle du site.

import React from "react";

import { cx } from "@/lib/utils";

const TableRoot = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, forwardedRef) => (
    <div ref={forwardedRef}>
      {/* Le tableau défile de lui-même sur téléphone plutôt que d'élargir la page. */}
      <div className={cx("w-full overflow-auto whitespace-nowrap", className)} {...props}>
        {children}
      </div>
    </div>
  ),
);

TableRoot.displayName = "TableRoot";

const Table = React.forwardRef<HTMLTableElement, React.TableHTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, forwardedRef) => (
    <table
      ref={forwardedRef}
      className={cx("w-full caption-bottom border-b border-border", className)}
      {...props}
    />
  ),
);

Table.displayName = "Table";

const TableHead = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, forwardedRef) => (
  <thead ref={forwardedRef} className={cx(className)} {...props} />
));

TableHead.displayName = "TableHead";

const TableHeaderCell = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, forwardedRef) => (
  <th
    ref={forwardedRef}
    className={cx(
      "border-b border-border px-4 py-3.5 text-left text-sm font-semibold text-ink",
      className,
    )}
    {...props}
  />
));

TableHeaderCell.displayName = "TableHeaderCell";

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, forwardedRef) => (
  <tbody ref={forwardedRef} className={cx("divide-y divide-border", className)} {...props} />
));

TableBody.displayName = "TableBody";

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, forwardedRef) => (
    <tr
      ref={forwardedRef}
      className={cx(
        "[&_td:last-child]:pr-4 [&_th:last-child]:pr-4",
        "[&_td:first-child]:pl-4 [&_th:first-child]:pl-4",
        className,
      )}
      {...props}
    />
  ),
);

TableRow.displayName = "TableRow";

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, forwardedRef) => (
  <td ref={forwardedRef} className={cx("p-4 text-sm text-muted", className)} {...props} />
));

TableCell.displayName = "TableCell";

const TableFoot = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, forwardedRef) => (
  <tfoot
    ref={forwardedRef}
    className={cx("border-t border-border text-left font-medium text-ink", className)}
    {...props}
  />
));

TableFoot.displayName = "TableFoot";

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, forwardedRef) => (
  <caption
    ref={forwardedRef}
    className={cx("mt-3 px-3 text-center text-sm text-steel", className)}
    {...props}
  />
));

TableCaption.displayName = "TableCaption";

export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFoot,
  TableHead,
  TableHeaderCell,
  TableRoot,
  TableRow,
};
