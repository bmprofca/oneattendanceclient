import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FaSearch, FaSpinner, FaChevronDown, FaUserCircle, FaTimes } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import apiCall from '../../utils/api';
import ProfileAvatar from './ProfileAvatar';

const AVATAR_GRADIENTS = [
    'from-blue-500 to-indigo-600',
    'from-purple-500 to-pink-600',
    'from-green-500 to-teal-600',
    'from-orange-500 to-amber-500',
    'from-rose-500 to-red-600',
    'from-cyan-500 to-blue-500',
];

const avatarGradient = (id) => AVATAR_GRADIENTS[id % AVATAR_GRADIENTS.length];

const getInitials = (name = '') =>
    name.trim().split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

export default function EmployeeSelect({ value, onChange, placeholder = "Select an employee...", error, disabled=false, initialEmployee = null, isOptionDisabled = () => false }) {
    const [isOpen, setIsOpen] = useState(false);
    const [employees, setEmployees] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loading, setLoading] = useState(false);
    
    const dropdownRef = useRef(null);
    const listRef = useRef(null);

    // Selected Employee Object for display
    const [selectedEmployee, setSelectedEmployee] = useState(null);

    // Debounce search
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchQuery);
            setPage(1); // Reset page on new search
        }, 300);
        return () => clearTimeout(handler);
    }, [searchQuery]);

    // Fetch employees
    const fetchEmployees = useCallback(async (currentPage, search, append = false) => {
        if (!hasMore && append) return;
        setLoading(true);
        try {
            const company = JSON.parse(localStorage.getItem('company'));
            const params = new URLSearchParams({
                page: currentPage.toString(),
                limit: '20'
            });
            if (search) params.append('search', search);

            const response = await apiCall(`/employees/list?${params}`, 'GET', null, company?.id);
            const result = await response.json();

            if (result.success) {
                const fetchedData = result.data || [];
                setEmployees(prev => append ? [...prev, ...fetchedData] : fetchedData);
                
                const meta = result.meta || result.pagination || {};
                const isLastPage = meta.is_last_page ?? (currentPage >= (meta.total_pages || 1));
                setHasMore(!isLastPage);
            }
        } catch (e) {
            console.error('Failed to load employees', e);
        } finally {
            setLoading(false);
        }
    }, [hasMore]);

    // Initial load and search changes
    useEffect(() => {
        if (isOpen) {
            fetchEmployees(page, debouncedSearch, page > 1);
        }
    }, [isOpen, debouncedSearch, page]);

    // Fetch selected employee detail if value is present but not in list
    useEffect(() => {
        if (!value) {
            setSelectedEmployee(null);
            return;
        }

        if (selectedEmployee && String(selectedEmployee.id) === String(value)) return;

        const existing = employees.find(e => String(e.id) === String(value));
        if (existing) {
            setSelectedEmployee(existing);
            return;
        }

        if (initialEmployee && String(initialEmployee.id) === String(value)) {
            setSelectedEmployee(initialEmployee);
        }
    }, [value, employees, initialEmployee, selectedEmployee]);

    // Click outside handler
    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Infinite scroll handler
    const handleScroll = () => {
        if (!listRef.current || loading || !hasMore) return;
        const { scrollTop, scrollHeight, clientHeight } = listRef.current;
        if (scrollHeight - scrollTop <= clientHeight + 50) {
            setPage(prev => prev + 1);
        }
    };

    const handleSelect = (emp) => {
        setSelectedEmployee(emp);
        onChange(emp.id, emp);
        setIsOpen(false);
        setSearchQuery('');
    };

    const handleClear = (e) => {
        e.stopPropagation();
        setSelectedEmployee(null);
        onChange('', null);
        setSearchQuery('');
    };

    return (
        <div className="relative w-full" ref={dropdownRef}>
            {/* Trigger Button */}
            <div 
                onClick={() => {
                    if (!disabled) setIsOpen(!isOpen);
                }}
                className={`w-full px-4 py-2.5 bg-gray-50 border ${error ? 'border-red-300 ring-1 ring-red-100' : 'border-gray-200 hover:border-gray-300'} rounded-xl text-sm outline-none focus-within:ring-4 focus-within:ring-indigo-500/10 focus-within:border-indigo-500 transition-all flex items-center justify-between ${disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
            >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    {selectedEmployee ? (
                        <div className="flex items-center gap-2">
                            <ProfileAvatar
                                record={selectedEmployee}
                                name={selectedEmployee.name}
                                className={`w-6 h-6 rounded-full bg-gradient-to-br ${avatarGradient(selectedEmployee.id)} flex items-center justify-center text-white text-[10px] font-bold shrink-0 overflow-hidden`}
                            >
                                {getInitials(selectedEmployee.name)}
                            </ProfileAvatar>
                            <span className="font-semibold text-gray-800 truncate">{selectedEmployee.name}</span>
                            <span className="text-xs text-gray-400 font-mono hidden sm:inline">({selectedEmployee.employee_code})</span>
                        </div>
                    ) : (
                        <span className="text-gray-400">{placeholder}</span>
                    )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {selectedEmployee && !disabled && (
                        <button type="button" onClick={handleClear} className="text-gray-400 hover:text-gray-600 p-1">
                            <FaTimes size={12} />
                        </button>
                    )}
                    <FaChevronDown className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} size={12} />
                </div>
            </div>

            {/* Dropdown Menu */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div 
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        transition={{ duration: 0.15 }}
                        className="absolute z-50 w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden flex flex-col"
                        style={{ maxHeight: '300px' }}
                    >
                        {/* Search Input */}
                        <div className="p-3 border-b border-gray-50 flex-shrink-0 bg-gray-50/50">
                            <div className="relative">
                                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
                                <input
                                    type="text"
                                    placeholder="Search employees..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all min-h-[42px]"
                                    onClick={(e) => e.stopPropagation()}
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* Employee List */}
                        <div 
                            ref={listRef}
                            onScroll={handleScroll}
                            className="overflow-y-auto flex-1 p-2 custom-scrollbar"
                        >
                            {employees.length === 0 && !loading ? (
                                <div className="py-8 text-center">
                                    <FaUserCircle className="text-gray-200 text-4xl mx-auto mb-2" />
                                    <p className="text-sm text-gray-500">No employees found</p>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {employees.map(emp => (
                                        (() => {
                                            const optionDisabled = isOptionDisabled(emp);
                                            return <div
                                            key={emp.id}
                                            title={optionDisabled ? 'You cannot select your own profile' : 'Select employee'}
                                            aria-disabled={optionDisabled}
                                            onClick={() => {
                                                if (!optionDisabled) handleSelect(emp);
                                            }}
                                            className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${optionDisabled
                                                ? 'cursor-not-allowed border border-amber-100 bg-amber-50/60 opacity-70'
                                                : `cursor-pointer ${String(value) === String(emp.id) ? 'bg-blue-50 border border-blue-100' : 'hover:bg-gray-50 border border-transparent'}`}`}
                                        >
                                            <ProfileAvatar
                                                record={emp}
                                                name={emp.name}
                                                className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarGradient(emp.id)} flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm overflow-hidden`}
                                            >
                                                {getInitials(emp.name)}
                                            </ProfileAvatar>
                                            <div className="min-w-0 flex-1">
                                                <p className={`text-sm truncate ${String(value) === String(emp.id) ? 'font-bold text-blue-700' : 'font-semibold text-gray-800'}`}>
                                                    {emp.name}
                                                </p>
                                                <p className="text-[11px] text-gray-500 font-mono truncate">
                                                    {emp.employee_code} &middot; <span className="uppercase text-[9px] font-sans tracking-wider">
                                                        {typeof emp.designation === 'object' && emp.designation !== null ? emp.designation.label : (emp.designation?.replace(/_/g, ' ') || 'N/A')}
                                                    </span>
                                                </p>
                                            </div>
                                            {optionDisabled && <span className="text-[10px] font-semibold text-amber-700">Your profile</span>}
                                        </div>;
                                        })()
                                    ))}
                                    {loading && (
                                        <div className="py-4 flex justify-center">
                                            <FaSpinner className="animate-spin text-blue-500" />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
