import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-lg border border-surface-300 bg-surface-100 px-3 py-2 text-sm text-typography-800 placeholder:text-typography-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-200 focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-colors shadow-xs",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
