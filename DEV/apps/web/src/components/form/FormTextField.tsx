import type {
  ChangeEventHandler,
  FocusEventHandler,
  HTMLInputTypeAttribute,
  ReactNode,
} from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { CharacterCount } from './CharacterCount';

type FormTextFieldProps = {
  id: string;
  label: string;
  hideLabel?: boolean;
  'data-testid'?: string;
  required?: boolean;
  error?: string;
  current?: string;
  maxLength?: number;
  helperText?: ReactNode;
  registration?: UseFormRegisterReturn;
  multiline?: boolean;
  rows?: number;
  type?: HTMLInputTypeAttribute;
  placeholder?: string;
  value?: string;
  onChange?: ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>;
  onBlur?: FocusEventHandler<HTMLInputElement | HTMLTextAreaElement>;
  disabled?: boolean;
  autoComplete?: string;
  min?: number | string;
  step?: number | string;
  wrapperClassName?: string;
  fieldClassName?: string;
};

export function FormTextField({
  id,
  label,
  hideLabel = false,
  'data-testid': dataTestId,
  required = false,
  error,
  current,
  maxLength,
  helperText,
  registration,
  multiline = false,
  rows = 3,
  type = 'text',
  placeholder,
  value,
  onChange,
  onBlur,
  disabled,
  autoComplete,
  min,
  step,
  wrapperClassName,
  fieldClassName,
}: FormTextFieldProps) {
  const handleChange: ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement> = (event) => {
    registration?.onChange(event);
    onChange?.(event);
  };

  const handleBlur: FocusEventHandler<HTMLInputElement | HTMLTextAreaElement> = (event) => {
    registration?.onBlur(event);
    onBlur?.(event);
  };

  const commonProps = {
    id,
    name: registration?.name,
    'data-testid': dataTestId,
    placeholder,
    disabled,
    autoComplete,
    maxLength,
    onChange: handleChange,
    onBlur: handleBlur,
  };

  return (
    <div className={cn('space-y-1', wrapperClassName)}>
      {hideLabel ? null : (
        <Label htmlFor={id}>
          {label}
          {required ? ' *' : ''}
        </Label>
      )}

      {multiline ? (
        <textarea
          {...commonProps}
          ref={registration?.ref}
          rows={rows}
          value={value}
          className={cn(
            'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground/50 placeholder:italic focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none',
            fieldClassName,
          )}
        />
      ) : (
        <Input
          {...commonProps}
          ref={registration?.ref}
          type={type}
          value={value}
          min={min}
          step={step}
          className={fieldClassName}
        />
      )}

      {helperText ? <p className="text-xs text-muted-foreground">{helperText}</p> : null}
      {typeof maxLength === 'number' ? <CharacterCount current={current} max={maxLength} /> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}