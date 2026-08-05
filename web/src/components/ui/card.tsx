import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "min-w-0 w-full max-w-full rounded-2xl border border-slate-800/70 bg-[linear-gradient(135deg,rgba(15,23,42,0.92)_0%,rgba(15,23,42,0.88)_45%,rgba(8,47,73,0.8)_100%)] bg-[length:140%_140%] bg-[position:0%_0%] p-5 shadow-[0_20px_45px_-28px_rgba(45,212,191,0.35)] backdrop-blur transition-[transform,box-shadow,border-color,background-position] duration-300 ease-out will-change-transform hover:-translate-y-1.5 hover:border-cyan-400/20 hover:bg-[position:100%_0%] hover:shadow-[0_28px_60px_-24px_rgba(34,211,238,0.42)]",
        className,
      )}
      {...props}
    />
  );
}
