import * as React from "react";

import { cn } from "./utils";

type InputProps = React.ComponentProps<"input"> & {
  label?: string;
  helperText?: string;
  error?: string;
  containerClassName?: string;
};

function Input({
  className,
  type,
  label,
  helperText,
  error,
  containerClassName,
  id,
  required,
  ...props
}: InputProps) {
  const generatedId = React.useId();
  const inputId = id ?? (label ? generatedId : undefined);
  const hasAssistiveText = !!error || !!helperText;

  const input = (
    <input
      id={inputId}
      type={type}
      data-slot="input"
      aria-invalid={error ? true : props["aria-invalid"]}
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border px-3 py-1 text-base bg-input-background transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        error && "border-red-500 focus-visible:ring-red-200",
        className,
      )}
      required={required}
      {...props}
    />
  );

  if (!label && !hasAssistiveText) {
    return input;
  }

  return (
    <div className={cn("space-y-1.5", containerClassName)}>
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">
          {label}
          {required ? <span className="ml-0.5 text-red-500">*</span> : null}
        </label>
      )}
      {input}
      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : helperText ? (
        <p className="text-xs text-gray-500">{helperText}</p>
      ) : null}
    </div>
  );
}

export { Input };
