import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaCheck, FaChevronRight, FaShieldAlt, FaInfoCircle, FaMinus
} from 'react-icons/fa';

// ─── Category color map ────────────────────────────────────────────────────────
const CAT_STYLES = {
  'Employees': { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500', border: 'border-orange-200', checkBg: 'bg-orange-600' },
  'Attendance': { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500', border: 'border-blue-200', checkBg: 'bg-blue-600' },
  'Leave': { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500', border: 'border-rose-200', checkBg: 'bg-rose-600' },
  'Financial': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', border: 'border-emerald-200', checkBg: 'bg-emerald-600' },
  'Permissions': { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500', border: 'border-purple-200', checkBg: 'bg-purple-600' },
  // Backward compatibility
  'Employee': { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500', border: 'border-orange-200', checkBg: 'bg-orange-600' },
  'Salary': { bg: 'bg-teal-50', text: 'text-teal-700', dot: 'bg-teal-500', border: 'border-teal-200', checkBg: 'bg-teal-600' },
  'Permission': { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500', border: 'border-purple-200', checkBg: 'bg-purple-600' },
};

const DEFAULT_STYLE = {
  bg: 'bg-slate-50', text: 'text-slate-700', dot: 'bg-slate-400',
  border: 'border-slate-200', checkBg: 'bg-slate-600',
};

const getCatStyle = (cat) => CAT_STYLES[cat] || DEFAULT_STYLE;

// ─── Mini checkbox ─────────────────────────────────────────────────────────────
const MiniCheck = ({ state, checkBg }) => {
  const base = 'w-[14px] h-[14px] rounded flex-shrink-0 flex items-center justify-center border transition-all duration-150';
  if (state === 'all') return <div className={`${base} ${checkBg} border-transparent`}><FaCheck size={7} className="text-white" /></div>;
  if (state === 'some') return <div className={`${base} ${checkBg} border-transparent`}><FaMinus size={7} className="text-white" /></div>;
  return <div className={`${base} border-slate-300 bg-white`} />;
};

// ─── Category row ──────────────────────────────────────────────────────────────
const CategoryRow = React.memo(({ cat, perms, selectedIds, onToggleCat, onTogglePerm, isOpen, onToggleOpen, readOnly = false }) => {
  const style = getCatStyle(cat);

  const selectedCount = useMemo(
    () => perms.filter(p => selectedIds.has(p.id)).length,
    [perms, selectedIds]
  );

  const state = selectedCount === 0 ? 'none' : selectedCount === perms.length ? 'all' : 'some';

  const badgeCls = state === 'all'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : state === 'some'
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-slate-50 text-slate-500 border-slate-200';

  const badgeLabel = state === 'all' ? 'All' : `${selectedCount}/${perms.length}`;

  return (
    <div className={`rounded-xl border overflow-hidden transition-all duration-200 ${isOpen ? 'border-slate-200 shadow-sm' : 'border-slate-100'}`}>
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none bg-white hover:bg-slate-50/70 transition-colors"
        onClick={onToggleOpen}
      >
        {/* Category checkbox — click stops propagation so it doesn't also toggle open */}
        {!readOnly && (
          <div
            onClick={e => { e.stopPropagation(); onToggleCat(cat, state); }}
            className="flex-shrink-0"
            title={state === 'all' ? 'Deselect all' : 'Select all'}
          >
            <MiniCheck state={state} checkBg={style.checkBg} />
          </div>
        )}

        {/* Dot */}
        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${style.dot}`} />

        {/* Name */}
        <span className="flex-1 text-sm font-semibold text-slate-700">{cat}</span>

        {/* Badge */}
        <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${badgeCls}`}>
          {badgeLabel}
        </span>

        {/* Chevron */}
        <motion.div animate={{ rotate: isOpen ? 90 : 0 }} transition={{ duration: 0.18 }}>
          <FaChevronRight className="text-slate-400 text-sm" />
        </motion.div>
      </div>

      {/* Permissions grid */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="perms"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 gap-1.5 p-2 bg-slate-50/60 border-t border-slate-100 sm:grid-cols-2">
              {perms.map(perm => {
                const isSelected = selectedIds.has(perm.id);
                return (
                  <div
                    key={perm.id}
                    onClick={!readOnly ? () => onTogglePerm(perm.id) : undefined}
                    className={`flex items-start gap-2 px-2 py-1.5 rounded-lg border transition-all duration-150 ${readOnly ? 'cursor-default' : 'cursor-pointer'} ${isSelected
                        ? `${style.bg} ${style.border}`
                        : 'bg-white border-slate-100 hover:border-slate-200 hover:bg-white'
                      }`}
                  >
                    {!readOnly && (
                      <div className={`mt-0.5 w-[13px] h-[13px] rounded flex-shrink-0 flex items-center justify-center border transition-all duration-150 ${isSelected ? `${style.checkBg} border-transparent` : 'border-slate-300 bg-white'
                        }`}>
                        {isSelected && <FaCheck size={7} className="text-white" />}
                      </div>
                    )}
                    {/* Labels */}
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-semibold leading-snug line-clamp-2 ${isSelected ? style.text : 'text-slate-700'}`}>
                        {perm.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

CategoryRow.displayName = 'CategoryRow';

// ─── Main CategoryPermissionSelector ──────────────────────────────────────────
/**
 * Props:
 *   allPermissions  — array from API: { id, code, name, action, category }[]
 *   selectedIds     — number[] (array of selected permission IDs)
 *   onChange        — (newIds: number[]) => void
 */
const CategoryPermissionSelector = ({ allPermissions = [], selectedIds = [], onChange, readOnly = false, listHeightClass = "max-h-[38vh]" }) => {
  // Build a Set for O(1) lookup
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  // Group permissions by category, preserving insertion order
  const grouped = useMemo(() => {
    const map = {};
    allPermissions.forEach(p => {
      if (!map[p.category]) map[p.category] = [];
      map[p.category].push(p);
    });
    return map;
  }, [allPermissions]);

  const categories = Object.keys(grouped);

  // Stats
  const totalCount = allPermissions.length;
  const selectedCount = selectedIds.length;
  const allSelected = selectedCount === totalCount && totalCount > 0;
  const noneSelected = selectedCount === 0;

  // Toggle a single permission
  const handleTogglePerm = useCallback((permId) => {
    const next = new Set(selectedSet);
    if (next.has(permId)) next.delete(permId);
    else next.add(permId);
    onChange([...next]);
  }, [selectedSet, onChange]);

  // Toggle an entire category
  const handleToggleCat = useCallback((cat, currentState) => {
    const ids = grouped[cat].map(p => p.id);
    const next = new Set(selectedSet);
    if (currentState === 'all') {
      ids.forEach(id => next.delete(id));
    } else {
      ids.forEach(id => next.add(id));
    }
    onChange([...next]);
  }, [grouped, selectedSet, onChange]);

  // Select / clear all
  const handleSelectAll = () => onChange(allPermissions.map(p => p.id));
  const handleClearAll = () => onChange([]);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Section header */}
      <div className="flex flex-col gap-4 border-b border-slate-200 bg-gradient-to-r from-indigo-50/80 via-white to-emerald-50/60 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
          <FaShieldAlt size={13} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900 sm:text-base">
              {readOnly ? 'Assigned permissions' : 'Choose permissions'}
            </h3>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${allSelected
                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                : noneSelected
                  ? 'bg-slate-50 text-slate-500 border-slate-100'
                  : 'bg-indigo-50 text-indigo-700 border-indigo-100'
              }`}>
              {selectedCount} / {totalCount}
            </span>
          </div>
          <p className="mt-1 text-xs font-medium text-slate-500">{totalCount} access areas available</p>
        </div>
        </div>
        {/* Toolbar */}
        <div className="flex items-center gap-2 sm:flex-shrink-0">
          {!readOnly && (
            <>
              <button
                type="button"
                onClick={handleSelectAll}
                className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-bold text-indigo-700 shadow-sm transition hover:bg-indigo-50"
              >
                All
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 shadow-sm transition hover:bg-slate-50"
              >
                None
              </button>
            </>
          )}
        </div>
      </div>

      {/* Category list */}
      <div className={`grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 sm:p-5 ${listHeightClass} overflow-y-auto custom-scrollbar bg-white`}>
        {allPermissions.length === 0 ? (
          <div className="col-span-full py-10 text-center text-sm italic text-slate-400">
            No permissions available
          </div>
        ) : allPermissions.map((permission) => {
            const style = getCatStyle(permission.category);
            const isSelected = selectedSet.has(permission.id);

            return (
              <button
                key={permission.id}
                type="button"
                disabled={readOnly}
                onClick={() => handleTogglePerm(permission.id)}
                className={`group relative flex min-h-[132px] flex-col items-start justify-between rounded-2xl border p-4 text-left transition-all ${isSelected
                    ? `${style.bg} ${style.border} shadow-md ring-2 ring-indigo-100`
                    : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md'
                  } ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
              >
                <div className="flex w-full items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} />
                    <span className={`text-xs font-bold uppercase tracking-[0.16em] ${isSelected ? style.text : 'text-slate-500'}`}>
                      {permission.category || 'General'}
                    </span>
                  </div>
                  {!readOnly && (
                    <span className={`flex h-6 w-6 items-center justify-center rounded-lg border transition ${isSelected
                        ? `${style.checkBg} border-transparent text-white`
                        : 'border-slate-300 bg-white text-transparent group-hover:border-indigo-300'
                      }`}>
                      <FaCheck size={10} />
                    </span>
                  )}
                </div>
                <div className="mt-4">
                  <p className={`text-sm font-bold leading-snug ${isSelected ? style.text : 'text-slate-800'}`}>
                    {permission.description}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-white/80 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      {permission.code}
                    </span>
                    {permission.action && (
                      <span className="rounded-md bg-slate-900/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                        {permission.action}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
      </div>

      {/* Footer hint */}
      {!readOnly && (
        <div className="px-3 py-2 bg-indigo-50/40 border-t border-indigo-100/60">
          <p className="text-[10.5px] text-indigo-700 flex items-start gap-1.5">
            <FaInfoCircle className="text-indigo-400 flex-shrink-0 mt-0.5" size={10} />
            Select a permission card to add or remove access. Use All or None to update the full package.
          </p>
        </div>
      )}
    </div>
  );
};

export default CategoryPermissionSelector;
