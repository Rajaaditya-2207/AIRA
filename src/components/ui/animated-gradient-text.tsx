import type { ComponentPropsWithoutRef, CSSProperties } from "react"

import { cn } from "@/lib/utils"

export interface AnimatedGradientTextProps extends ComponentPropsWithoutRef<"span"> {
  speed?: number
  colorFrom?: string
  colorTo?: string
}

export function AnimatedGradientText({
  children,
  className,
  speed = 1,
  colorFrom = "#4f46e5",
  colorTo = "#06b6d4",
  ...props
}: AnimatedGradientTextProps) {
  return (
    <span
      style={
        {
          "--bg-size": `${speed * 320}%`,
          "--color-from": colorFrom,
          "--color-to": colorTo,
        } as CSSProperties
      }
      className={cn(
        "animate-gradient inline bg-linear-to-r from-(--color-from) via-(--color-to) to-(--color-from) bg-size-[var(--bg-size)_100%] bg-clip-text text-transparent",
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}
