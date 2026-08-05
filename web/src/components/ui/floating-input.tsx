import { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

type FloatingInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  containerClassName?: string;
  labelClassName?: string;
  inputClassName?: string;
};

export const FloatingInput = forwardRef<HTMLInputElement, FloatingInputProps>(function FloatingInput(
  { className, containerClassName, inputClassName, label, labelClassName, id, placeholder, ...props },
  ref,
) {
  const inputId = id ?? label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  return (
    <div className={cn("group relative", containerClassName)}>
      <Input
        ref={ref}
        id={inputId}
        placeholder={placeholder ?? " "}
        className={cn(
          "peer h-14 px-4 pb-3 pt-6 placeholder:text-transparent focus:placeholder:text-transparent",
          inputClassName,
          className,
        )}
        {...props}
      />
      <label
        htmlFor={inputId}
        className={cn(
          "pointer-events-none absolute left-4 top-2 text-xs font-medium text-slate-400 transition-all duration-300 ease-out peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:font-normal peer-placeholder-shown:text-slate-500/80 peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-xs peer-focus:font-medium peer-focus:text-cyan-300",
          labelClassName,
        )}
      >
        {label}
      </label>
    </div>
  );
});