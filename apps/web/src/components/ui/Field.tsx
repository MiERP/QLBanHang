import { ChevronDown } from 'lucide-react';
import {
  Children,
  Fragment,
  isValidElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/cn';

const CONTROL =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 transition placeholder:text-slate-400 ' +
  'focus:border-brand-cyan focus:outline-none focus:ring-2 focus:ring-brand-cyan/30 disabled:bg-slate-100 disabled:text-slate-500';

const COMPACT =
  'w-full h-8 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 transition placeholder:text-slate-400 ' +
  'focus:border-brand-cyan focus:outline-none focus:ring-2 focus:ring-brand-cyan/30 disabled:bg-slate-100 disabled:text-slate-500';

export function Input({ className, dense, ...rest }: InputHTMLAttributes<HTMLInputElement> & { dense?: boolean }) {
  return <input className={cn(dense ? COMPACT : CONTROL, className)} {...rest} />;
}

interface ComboboxOption {
  value: string;
  label: string;
  disabled?: boolean;
}

function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children);
  return '';
}

function collectOptions(children: ReactNode, out: ComboboxOption[]) {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const props = child.props as { value?: unknown; children?: ReactNode; disabled?: boolean };
    if (child.type === Fragment || child.type === 'optgroup') {
      collectOptions(props.children, out);
      return;
    }
    if (child.type !== 'option') return;
    const label = textOf(props.children);
    const value = props.value === undefined ? label : String(props.value);
    out.push({ value, label: label || value, disabled: props.disabled });
  });
}

function fold(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .trim();
}

interface Anchor {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
}

interface SelectProps {
  value?: string | number;
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
  disabled?: boolean;
  dense?: boolean;
  className?: string;
  placeholder?: string;
  name?: string;
  id?: string;
  title?: string;
  children?: ReactNode;
}

export function Select({
  className,
  dense,
  children,
  value,
  onChange,
  disabled,
  placeholder = '-- Chọn --',
  name,
  id,
  title,
}: SelectProps) {
  const options = useMemo(() => {
    const list: ComboboxOption[] = [];
    collectOptions(children, list);
    return list;
  }, [children]);

  const selectedValue = value === undefined || value === null ? '' : String(value);
  const selected = options.find((option) => option.value === selectedValue);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const keyword = fold(query);
    if (!keyword) return options;
    return options.filter((option) => fold(option.label).includes(keyword) || fold(option.value).includes(keyword));
  }, [options, query]);

  const place = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.max(rect.width, 200);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    const below = window.innerHeight - rect.bottom;
    if (below < 200 && rect.top > below) {
      setAnchor({ left, width, bottom: window.innerHeight - rect.top + 4 });
    } else {
      setAnchor({ left, width, top: rect.bottom + 4 });
    }
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setAnchor(null);
  }, []);

  const openMenu = useCallback(() => {
    setQuery('');
    setActive(Math.max(0, options.findIndex((option) => option.value === selectedValue)));
    place();
    setOpen(true);
  }, [options, selectedValue, place]);

  const pick = useCallback(
    (next: string) => {
      onChange?.({ target: { value: next, name: name ?? '' } } as unknown as ChangeEvent<HTMLSelectElement>);
      close();
    },
    [onChange, name, close]
  );

  useEffect(() => {
    if (!open) return;
    const onScroll = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && listRef.current?.contains(target)) return;
      place();
    };
    const onOutsideDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || listRef.current?.contains(target)) return;
      close();
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', place);
    document.addEventListener('mousedown', onOutsideDown);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', place);
      document.removeEventListener('mousedown', onOutsideDown);
    };
  }, [open, place, close]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const node = listRef.current?.children[active];
    if (node instanceof HTMLElement) node.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'Enter') {
        event.preventDefault();
        openMenu();
      }
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => (filtered.length ? (index + 1) % filtered.length : 0));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => (filtered.length ? (index - 1 + filtered.length) % filtered.length : 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = filtered[active];
      if (option && !option.disabled) pick(option.value);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === 'Tab') {
      close();
    }
  };

  return (
    <div ref={rootRef} className={cn('relative w-full', className)}>
      <input
        ref={inputRef}
        id={id}
        name={name}
        title={title}
        type="text"
        autoComplete="off"
        disabled={disabled}
        value={open ? query : selected?.label ?? ''}
        placeholder={open && selected ? selected.label : placeholder}
        className={cn(dense ? COMPACT : CONTROL, 'cursor-pointer pr-7', open && 'cursor-text')}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
        }}
        onMouseDown={() => {
          if (disabled) return;
          if (open) close();
          else openMenu();
        }}
        onFocus={() => {
          if (!disabled && !open) openMenu();
        }}
        onKeyDown={onKeyDown}
      />
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      {open &&
        anchor &&
        createPortal(
          <div
            ref={listRef}
            style={{ left: anchor.left, top: anchor.top, bottom: anchor.bottom, width: anchor.width }}
            className="fixed z-[60] max-h-72 overflow-y-auto overscroll-contain rounded-lg border border-slate-200 bg-white py-1 shadow-xl"
          >
            {filtered.map((option, index) => (
              <div
                key={`${option.value}-${index}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  if (!option.disabled) pick(option.value);
                }}
                onMouseEnter={() => setActive(index)}
                className={cn(
                  'cursor-pointer px-3 py-1.5 text-sm text-slate-700',
                  index === active && 'bg-brand-cyan-subtle text-brand-navy',
                  option.value === selectedValue && 'font-semibold text-brand-navy',
                  option.disabled && 'cursor-not-allowed text-slate-300'
                )}
              >
                {option.label}
              </div>
            ))}
            {filtered.length === 0 && <div className="px-3 py-2 text-sm text-slate-400">Không tìm thấy kết quả</div>}
          </div>,
          document.body
        )}
    </div>
  );
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(CONTROL, 'min-h-20 resize-y', className)} {...rest} />;
}

interface FieldProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}

export function Field({ label, required, error, hint, className, children }: FieldProps) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1 block text-xs font-semibold text-slate-600">
        {label} {required && <span className="text-brand-red">*</span>}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-[11px] font-medium text-brand-red">{error}</span>
      ) : (
        hint && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>
      )}
    </label>
  );
}

export function FormGrid({ cols = 2, children }: { cols?: 1 | 2 | 3 | 4 | 5 | 6; children: ReactNode }) {
  const map = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-3',
    4: 'grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-2 lg:grid-cols-5',
    6: 'grid-cols-2 lg:grid-cols-6',
  } as const;
  return <div className={cn('grid gap-3', map[cols])}>{children}</div>;
}
