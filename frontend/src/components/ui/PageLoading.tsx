import * as React from "react"

import { cn } from "@/lib/utils"

export interface PageLoadingProps {
  message?: string
  fullScreen?: boolean
  className?: string
}

const PageLoading = React.forwardRef<HTMLDivElement, PageLoadingProps>(
  ({ message, fullScreen = false, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col items-center justify-center gap-3",
          fullScreen ? "h-screen" : "h-64",
          className
        )}
        role="status"
        aria-label={message || "Loading"}
        {...props}
      >
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        {message && (
          <p className="text-sm text-muted-foreground">{message}</p>
        )}
        <span className="sr-only">Loading...</span>
      </div>
    )
  }
)
PageLoading.displayName = "PageLoading"

export { PageLoading }
