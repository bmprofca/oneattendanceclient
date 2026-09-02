import React from 'react';
import { FaTh, FaListUl } from 'react-icons/fa';

const colorClasses = {
  active: 'bg-blue-600 text-white shadow-md',
  inactive: 'text-gray-600 hover:text-blue-600 hover:bg-blue-50',
};

const iconByView = {
  table: FaListUl,
  card: FaTh,
};

export default function ManagementViewSwitcher({
  viewMode,
  onChange,
  className = '',
}) {
  const buttonClass = (mode) =>
    `px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
      viewMode === mode ? colorClasses.active : colorClasses.inactive
    }`;

  const TableIcon = iconByView.table;
  const CardIcon = iconByView.card;

  return (
    <div className={`flex justify-end w-auto shrink-0 ${className}`.trim()}>
      <div className="inline-flex items-center gap-1 p-1 bg-slate-50 rounded-xl border border-slate-200">
        <button type="button" onClick={() => onChange('table')} className={buttonClass('table')}>
          <TableIcon size={14} />
        </button>
        <button type="button" onClick={() => onChange('card')} className={buttonClass('card')}>
          <CardIcon size={14} />
        </button>
      </div>
    </div>
  );
}
