'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';

interface Props {
  id?: string;
  value: string;       // YYYY-MM-DD
  min?: string;        // YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAY_LABELS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function toISO(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

export default function DatePickerInput({ id, value, min = '', onChange, placeholder = 'DD/MM/YYYY', className = 'input' }: Props) {
  const init = value ? new Date(value + 'T00:00:00') : new Date();
  const [open, setOpen]         = useState(false);
  const [viewYear, setViewYear] = useState(init.getFullYear());
  const [viewMonth, setViewMonth] = useState(init.getMonth());
  const ref = useRef<HTMLDivElement>(null);

  // sync view when controlled value changes externally
  useEffect(() => {
    if (value) {
      const d = new Date(value + 'T00:00:00');
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [value]);

  // close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  function pick(day: number) {
    onChange(toISO(viewYear, viewMonth, day));
    setOpen(false);
  }

  const firstDow    = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const todayISO    = new Date().toISOString().split('T')[0];

  const displayValue = value
    ? new Date(value + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'numeric', year: 'numeric' })
    : '';

  return (
    <div ref={ref} className="relative">
      {/* Input trigger */}
      <div className="relative">
        <input
          id={id}
          type="text"
          readOnly
          value={displayValue}
          placeholder={placeholder}
          onClick={() => setOpen(o => !o)}
          className={`${className} cursor-pointer pr-10 caret-transparent`}
        />
        <CalendarDays
          size={17}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#717171] pointer-events-none"
          aria-hidden="true"
        />
      </div>

      {/* Calendar popup */}
      {open && (
        <div className="absolute z-50 left-0 mt-1.5 bg-white border border-[#E0E0E0] rounded-2xl shadow-xl p-5 w-[320px]">
          {/* Month / year nav */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={prevMonth}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F7F7F7] transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft size={17} />
            </button>
            <span className="text-sm font-semibold text-[#111111]">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F7F7F7] transition-colors"
              aria-label="Next month"
            >
              <ChevronRight size={17} />
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAY_LABELS.map(d => (
              <div key={d} className="text-center text-xs font-medium text-[#717171] py-1">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const iso = toISO(viewYear, viewMonth, day);
              const selected = iso === value;
              const isToday  = iso === todayISO;
              const disabled = min ? iso < min : false;
              return (
                <button
                  key={day}
                  type="button"
                  disabled={disabled}
                  onClick={() => pick(day)}
                  className={[
                    'h-10 w-10 mx-auto flex items-center justify-center rounded-full text-sm font-medium transition-colors',
                    disabled  ? 'text-[#C4C4C4] cursor-not-allowed'    : 'cursor-pointer',
                    selected  ? 'bg-[#111111] text-white'               : '',
                    !selected && !disabled && isToday ? 'text-[#1D4ED8]' : '',
                    !selected && !disabled ? 'hover:bg-[#F0F0F0]'       : '',
                  ].join(' ')}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
