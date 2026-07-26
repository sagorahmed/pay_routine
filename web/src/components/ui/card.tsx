import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-800/70 bg-slate-900/70 p-5 shadow-[0_20px_45px_-28px_rgba(45,212,191,0.35)] backdrop-blur",
        className,
      )}
      {...props}
    />
  );
}
