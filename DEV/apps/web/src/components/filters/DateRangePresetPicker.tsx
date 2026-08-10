import { forwardRef, useMemo, useState } from 'react';
import DatePicker from 'react-datepicker';
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from 'date-fns';
import { cn } from '@/lib/utils';
import 'react-datepicker/dist/react-datepicker.css';

type DateRangeValue = {
  startDate?: string;
  endDate?: string;
};

interface DateRangePresetPickerProps {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  className?: string;
  label?: string;
  placeholder?: string;
  testId?: string;
}

type PresetKey =
  | 'last-month'
  | 'last-week'
  | 'yesterday'
  | 'this-month'
  | 'this-week'
  | 'today';

const PRESET_ORDER: PresetKey[] = [
  'last-month',
  'last-week',
  'yesterday',
  'this-month',
  'this-week',
  'today',
];

function parseDateValue(value?: string) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatDateValue(date: Date | null) {
  return date ? format(date, 'yyyy-MM-dd') : '';
}

function buildPresetRange(preset: PresetKey) {
  const today = new Date();
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  switch (preset) {
    case 'today':
      return { start: todayOnly, end: todayOnly };
    case 'yesterday': {
      const yesterday = subDays(todayOnly, 1);
      return { start: yesterday, end: yesterday };
    }
    case 'this-week':
      return {
        start: startOfWeek(todayOnly, { weekStartsOn: 1 }),
        end: todayOnly,
      };
    case 'last-week': {
      const lastWeekStart = subWeeks(startOfWeek(todayOnly, { weekStartsOn: 1 }), 1);
      return {
        start: lastWeekStart,
        end: endOfWeek(lastWeekStart, { weekStartsOn: 1 }),
      };
    }
    case 'this-month':
      return {
        start: startOfMonth(todayOnly),
        end: todayOnly,
      };
    case 'last-month': {
      const lastMonth = subMonths(todayOnly, 1);
      return {
        start: startOfMonth(lastMonth),
        end: endOfMonth(lastMonth),
      };
    }
  }
}

function getPresetLabel(preset: PresetKey) {
  switch (preset) {
    case 'today':      return 'Today';
    case 'yesterday':  return 'Yesterday';
    case 'this-week':  return 'This week';
    case 'last-week':  return 'Last week';
    case 'this-month': return 'This month';
    case 'last-month': return 'Last month';
  }
}

function isPresetActive(preset: PresetKey, startDate: Date | null, endDate: Date | null) {
  if (!startDate || !endDate) return false;
  const presetRange = buildPresetRange(preset);
  return isSameDay(startDate, presetRange.start) && isSameDay(endDate, presetRange.end);
}

interface RangeTriggerButtonProps {
  label: string;
  hasValue: boolean;
  ariaLabel: string;
  onClick?: () => void;
  onClear?: (e: React.MouseEvent) => void;
  testId?: string;
}

const RangeTriggerButton = forwardRef<HTMLButtonElement, RangeTriggerButtonProps>(
  ({ label, hasValue, ariaLabel, onClick, onClear, testId }, ref) => (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      data-testid={testId}
      className={cn(
        'flex h-11 w-full items-center justify-between gap-3 rounded-xl border border-border/70 bg-gradient-to-br from-background via-background to-muted/40 px-3 text-left text-sm shadow-sm transition-colors hover:border-primary/40',
        !hasValue && 'text-muted-foreground',
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{label}</span>
      </span>
      {hasValue ? (
        <span
          onClick={(e) => { e.stopPropagation(); onClear?.(e); }}
          aria-label="Clear date range"
          className="flex shrink-0 items-center rounded p-0.5 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </span>
      ) : (
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}
    </button>
  ),
);

RangeTriggerButton.displayName = 'RangeTriggerButton';

export function DateRangePresetPicker({
  value,
  onChange,
  className,
  label = 'Date range',
  placeholder = 'DD/MM/YYYY – DD/MM/YYYY',
  testId = 'date-range-picker',
}: DateRangePresetPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSelectingEnd, setIsSelectingEnd] = useState(false);

  const startDate = parseDateValue(value.startDate);
  const endDate = parseDateValue(value.endDate);

  const displayLabel = useMemo(() => {
    if (!startDate && !endDate) return placeholder;
    if (startDate && endDate) {
      if (isSameDay(startDate, endDate)) return format(startDate, 'dd/MM/yyyy');
      return `${format(startDate, 'dd/MM/yyyy')} – ${format(endDate, 'dd/MM/yyyy')}`;
    }
    if (startDate) return `${format(startDate, 'dd/MM/yyyy')} – ...`;
    return placeholder;
  }, [endDate, placeholder, startDate]);

  const handlePickerChange = (date: Date | null) => {
    // react-datepicker sends null when clicking the already-selected date (deselect).
    // Treat this as "confirm current selection and close".
    if (!date) {
      if (isSelectingEnd) {
        setIsSelectingEnd(false);
        setIsOpen(false);
      }
      return;
    }

    if (!isSelectingEnd) {
      // First click: set from = to = day; stay open for range extension
      onChange({ startDate: formatDateValue(date), endDate: formatDateValue(date) });
      setIsSelectingEnd(true);
    } else {
      // Second click (including same-day re-click): finalise and close
      setIsSelectingEnd(false);

      if (startDate && date < startDate) {
        // Clicked before current from → swap
        onChange({ startDate: formatDateValue(date), endDate: value.startDate });
      } else {
        onChange({ startDate: value.startDate, endDate: formatDateValue(date) });
      }

      setIsOpen(false);
    }
  };

  const handleClickOutside = () => {
    setIsSelectingEnd(false);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange({ startDate: '', endDate: '' });
    setIsSelectingEnd(false);
    setIsOpen(false);
  };

  const handlePresetClick = (preset: PresetKey) => {
    const range = buildPresetRange(preset);
    onChange({
      startDate: formatDateValue(range.start),
      endDate: formatDateValue(range.end),
    });
    setIsSelectingEnd(false);
    setIsOpen(false);
  };

  const handleOpen = () => {
    setIsSelectingEnd(false);
    setIsOpen(true);
  };

  // Keep maxDate at today but allow last-week's end (which is always in the past)
  const maxDate = addDays(new Date(), 0);

  return (
    <div className={cn('flex flex-col gap-1', className)} data-testid={testId}>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <DatePicker
        selected={startDate}
        onChange={handlePickerChange}
        startDate={startDate}
        endDate={endDate}
        monthsShown={2}
        open={isOpen}
        onClickOutside={handleClickOutside}
        onInputClick={handleOpen}
        onCalendarOpen={() => setIsOpen(true)}
        onCalendarClose={() => { setIsSelectingEnd(false); setIsOpen(false); }}
        renderCustomHeader={({
          monthDate,
          customHeaderCount,
          decreaseMonth,
          increaseMonth,
          prevMonthButtonDisabled,
          nextMonthButtonDisabled,
        }) => (
          <div className="flex items-center justify-between px-1 pb-1 pt-1">
            <button
              type="button"
              onClick={decreaseMonth}
              disabled={prevMonthButtonDisabled}
              aria-label="Previous month"
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30',
                customHeaderCount !== 0 && 'invisible',
              )}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold text-foreground">
              {format(monthDate, 'MMMM yyyy')}
            </span>
            <button
              type="button"
              onClick={increaseMonth}
              disabled={nextMonthButtonDisabled}
              aria-label="Next month"
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30',
                customHeaderCount !== 1 && 'invisible',
              )}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
        maxDate={maxDate}
        shouldCloseOnSelect={isSelectingEnd}
        dateFormat="dd/MM/yyyy"
        popperPlacement="bottom-start"
        popperProps={{ strategy: 'fixed' }}
        portalId="date-range-portal"
        popperClassName="attendance-range-picker-popper"
        calendarClassName="attendance-range-picker-calendar"
        customInput={
          <RangeTriggerButton
            label={displayLabel}
            hasValue={Boolean(startDate || endDate)}
            ariaLabel={label}
            onClear={handleClear}
            testId={`${testId}-trigger`}
          />
        }
        calendarContainer={({ className: containerClassName, children }) => (
          <div className={cn('attendance-range-picker-panel', containerClassName)}>
            <div className="attendance-range-picker-inner">
              {/* Left: vertical preset list */}
              <div className="attendance-range-picker-presets">
                {PRESET_ORDER.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handlePresetClick(preset)}
                    data-testid={`preset-${preset}`}
                    aria-label={`Select ${getPresetLabel(preset).toLowerCase()} range`}
                    className={cn(
                      'w-full rounded-md px-3 py-1.5 text-left text-xs font-medium transition-colors',
                      isPresetActive(preset, startDate, endDate)
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    {getPresetLabel(preset)}
                  </button>
                ))}
              </div>
              {/* Right: two months side by side */}
              <div className="attendance-range-picker-months">{children}</div>
            </div>
          </div>
        )}
      />
    </div>
  );
}
