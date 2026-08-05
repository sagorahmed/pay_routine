import { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "h-10 w-full rounded-xl border border-slate-700 bg-slate-950/95 px-3 text-sm text-slate-100 outline-none shadow-[0_10px_25px_-20px_rgba(15,23,42,0.9)] transition-[border-color,box-shadow,background-color,color,transform] duration-300 ease-out placeholder:text-slate-500/70 focus:border-cyan-400/80 focus:bg-slate-950 focus:shadow-[0_0_0_1px_rgba(34,211,238,0.25),0_0_0_6px_rgba(34,211,238,0.14),0_18px_42px_-22px_rgba(34,211,238,0.45)] focus-visible:border-cyan-400/80 focus-visible:shadow-[0_0_0_1px_rgba(34,211,238,0.25),0_0_0_6px_rgba(34,211,238,0.14),0_18px_42px_-22px_rgba(34,211,238,0.45)]",
          className,
        )}
        {...props}
      />
    );
  },
);
