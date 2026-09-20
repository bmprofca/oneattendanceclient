import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
    FaChevronLeft, 
    FaChevronRight, 
    FaAngleDoubleLeft, 
    FaAngleDoubleRight,
    FaLevelDownAlt 
} from 'react-icons/fa';
import SelectField from './SelectField';

const Pagination = ({
    currentPage,
    totalItems,
    itemsPerPage,
    onPageChange,
    onLimitChange,
    availableLimits = [10, 20, 50, 100],
    className = '',
    showInfo = true,
}) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
    const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);
    
    const [jumpPage, setJumpPage] = useState('');

    useEffect(() => {
        setJumpPage(String(currentPage));
    }, [currentPage]);

    const handleJump = (e) => {
        e.preventDefault();
        const page = Number.parseInt(jumpPage, 10);
        if (page && page >= 1 && page <= totalPages) {
            onPageChange(page);
        } else {
            setJumpPage(String(currentPage));
        }
    };

    const getPageNumbers = () => {
        const delta = 2;
        const range = [];
        const rangeWithDots = [];
        let l;

        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
                range.push(i);
            }
        }

        range.forEach((i) => {
            if (l) {
                if (i - l === 2) {
                    rangeWithDots.push(l + 1);
                } else if (i - l !== 1) {
                    rangeWithDots.push('...');
                }
            }
            rangeWithDots.push(i);
            l = i;
        });

        return rangeWithDots;
    };

    if (totalItems === 0) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`w-full lg:flex lg:justify-between lg:items-center bg-white rounded-xl border border-slate-200 mt-6 p-3 sm:p-4 ${className}`.trim()}
        >
            {/* ── ROW 1 (mobile): Info + Page controls side by side ── */}
            <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">

                {/* Showing X–Y of Z — hidden on very small if needed, but kept visible */}
                {showInfo && (
                    <p className="text-xs sm:text-sm text-slate-600 font-medium whitespace-nowrap shrink-0">
                        Showing{' '}
                        <span className="text-slate-900 font-semibold">{startItem}–{endItem}</span>
                        {' '}of{' '}
                        <span className="text-slate-900 font-semibold">{totalItems}</span>
                    </p>
                )}

                {/* Page number buttons */}
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => onPageChange(1)}
                        disabled={currentPage === 1}
                        className="p-1.5 rounded-lg border border-slate-100 text-slate-400 hover:bg-slate-50 hover:text-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        title="First Page"
                    >
                        <FaAngleDoubleLeft size={11} />
                    </button>

                    <button
                        onClick={() => onPageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="p-1.5 rounded-lg border border-slate-100 text-slate-400 hover:bg-slate-50 hover:text-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        title="Previous Page"
                    >
                        <FaChevronLeft size={11} />
                    </button>

                    <div className="flex items-center gap-0.5 px-0.5">
                        {getPageNumbers().map((page, idx) =>
                            page === '...' ? (
                                <span key={`dots-${idx}`} className="px-1 text-slate-400 text-xs">...</span>
                            ) : (
                                <button
                                    key={page}
                                    onClick={() => onPageChange(page)}
                                    className={`
                                        min-w-[28px] h-7 sm:min-w-[36px] sm:h-9 rounded-lg text-xs sm:text-sm font-bold transition-all
                                        ${currentPage === page
                                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                                            : 'text-slate-600 hover:bg-slate-100 hover:text-indigo-600'
                                        }
                                    `}
                                >
                                    {page}
                                </button>
                            )
                        )}
                    </div>

                    <button
                        onClick={() => onPageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="p-1.5 rounded-lg border border-slate-100 text-slate-400 hover:bg-slate-50 hover:text-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        title="Next Page"
                    >
                        <FaChevronRight size={11} />
                    </button>

                    <button
                        onClick={() => onPageChange(totalPages)}
                        disabled={currentPage === totalPages}
                        className="p-1.5 rounded-lg border border-slate-100 text-slate-400 hover:bg-slate-50 hover:text-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        title="Last Page"
                    >
                        <FaAngleDoubleRight size={11} />
                    </button>
                </div>
            </div>

            {/* ── ROW 2 (mobile): Show limit + Go to ── */}
            <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-100 sm:mt-0 sm:pt-0 sm:border-0 sm:hidden">

                {/* Show limit */}
                {onLimitChange && (
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-500 font-medium">Show:</span>
                        <div className="relative min-w-[80px]">
                            <SelectField
                                value={{ value: itemsPerPage, label: String(itemsPerPage) }}
                                onChange={(selectedOption) => onLimitChange(Number(selectedOption.value))}
                                options={availableLimits.map(limit => ({ value: limit, label: String(limit) }))}
                                menuPlacement="auto"
                            />
                        </div>
                    </div>
                )}

                {/* Go to page */}
                <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-500 font-medium">Go to:</span>
                    <form onSubmit={handleJump} className="relative group">
                        <input
                            type="text"
                            inputMode="numeric"
                            value={jumpPage}
                            onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9]/g, '');
                                setJumpPage(val);
                            }}
                            className="w-14 bg-white border border-slate-200 rounded-lg px-2 py-1 pr-7 text-xs font-bold text-slate-700 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-center"
                        />
                        <button
                            type="submit"
                            className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-all opacity-0 group-focus-within:opacity-100"
                        >
                            <FaLevelDownAlt size={8} className="rotate-90" />
                        </button>
                    </form>
                    <span className="text-xs text-slate-500">of <span className="text-slate-900 font-bold">{totalPages}</span></span>
                </div>
            </div>

            {/* ── Desktop layout (sm+): original single row ── */}
            <div className="hidden sm:flex items-center justify-between gap-4 mt-3 pt-3 border-t border-slate-100 lg:mt-0 lg:pt-0">
                {onLimitChange && (
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-500 font-medium">Show:</span>
                        <div className="relative min-w-[90px]">
                            <SelectField
                                value={{ value: itemsPerPage, label: String(itemsPerPage) }}
                                onChange={(selectedOption) => onLimitChange(Number(selectedOption.value))}
                                options={availableLimits.map(limit => ({ value: limit, label: String(limit) }))}
                                menuPlacement="auto"
                            />
                        </div>
                    </div>
                )}
                <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500 font-medium">Go to:</span>
                    <form onSubmit={handleJump} className="relative group">
                        <input
                            type="text"
                            inputMode="numeric"
                            value={jumpPage}
                            onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9]/g, '');
                                setJumpPage(val);
                            }}
                            placeholder="Page No"
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 pr-10 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-center"
                        />
                        <button
                            type="submit"
                            className="absolute right-1 top-1/2 -translate-y-1/2 p-1 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-all opacity-0 group-focus-within:opacity-100"
                        >
                            <FaLevelDownAlt size={10} className="rotate-90" />
                        </button>
                    </form>
                    <span className="text-sm text-slate-500 font-medium">of <span className="text-slate-900 font-bold">{totalPages}</span> pages</span>
                </div>
            </div>
        </motion.div>
    );
};

// Hook — unchanged
export const usePagination = (initialPage = 1, initialLimit = 10) => {
    const [pagination, setPagination] = useState({
        page: initialPage,
        limit: initialLimit,
        total: 0,
        total_pages: 1,
        is_last_page: true
    });

    const updatePagination = useCallback((data) => {
        setPagination(prev => {
            const page = data.page ?? prev.page;
            const limit = data.limit ?? prev.limit;
            const total = data.total ?? prev.total;
            const total_pages = data.total_pages ?? ((Math.ceil(total / limit) || 1));
            const next = {
                page,
                limit,
                total,
                total_pages,
                is_last_page: data.is_last_page ?? (page >= total_pages)
            };

            if (
                prev.page === next.page &&
                prev.limit === next.limit &&
                prev.total === next.total &&
                prev.total_pages === next.total_pages &&
                prev.is_last_page === next.is_last_page
            ) {
                return prev;
            }

            return next;
        });
    }, []);

    const goToPage = useCallback((page) => {
        setPagination(prev => {
            if (prev.page === page) return prev;
            return { ...prev, page };
        });
    }, []);

    const changeLimit = useCallback((limit) => {
        setPagination(prev => {
            if (prev.limit === limit) return prev;
            return { ...prev, limit, page: 1 };
        });
    }, []);

    const resetPagination = useCallback(() => {
        setPagination({ page: initialPage, limit: initialLimit, total: 0, total_pages: 1, is_last_page: true });
    }, [initialPage, initialLimit]);

    return { pagination, updatePagination, goToPage, changeLimit, resetPagination };
};

export default Pagination;
