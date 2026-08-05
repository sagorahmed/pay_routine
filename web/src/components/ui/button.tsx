import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const variantClass: Record<ButtonVariant, string> = {
  primary:
    "border border-cyan-300/20 bg-cyan-500 text-slate-950 shadow-[0_10px_25px_-12px_rgba(34,211,238,0.75)] hover:border-cyan-200/40 hover:bg-cyan-400 hover:shadow-[0_16px_40px_-14px_rgba(34,211,238,0.85)]",
  secondary:
    "border border-slate-700 bg-slate-800 text-slate-100 shadow-[0_10px_25px_-18px_rgba(15,23,42,0.9)] hover:border-cyan-400/30 hover:bg-slate-700 hover:shadow-[0_16px_36px_-18px_rgba(34,211,238,0.35)]",
  ghost:
    "border border-transparent bg-transparent text-slate-100 hover:border-slate-700/80 hover:bg-slate-800/80 hover:shadow-[0_12px_28px_-20px_rgba(34,211,238,0.28)]",
  danger:
    "border border-rose-300/20 bg-rose-500 text-white shadow-[0_10px_25px_-12px_rgba(244,63,94,0.65)] hover:border-rose-200/35 hover:bg-rose-400 hover:shadow-[0_16px_40px_-14px_rgba(244,63,94,0.8)]",
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { className, variant = "primary", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-[transform,box-shadow,background-color,border-color,color] duration-300 ease-out will-change-transform hover:scale-[1.03] hover:-translate-y-0.5 active:scale-[0.985] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 disabled:hover:translate-y-0 [&_svg]:shrink-0 [&_svg]:transition-transform [&_svg]:duration-300 [&_svg]:ease-out hover:[&_svg]:translate-x-1",
        variantClass[variant],
        className,
      )}
      {...props}
    />
  );
});
