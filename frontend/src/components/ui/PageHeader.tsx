import * as React from "react"
import { useNavigate } from "react-router-dom"
import { ChevronLeft, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export interface PageHeaderProps {
  title: string
  subtitle?: string
  icon?: LucideIcon
  backTo?: string
  onBack?: () => void
  actions?: React.ReactNode
  size?: "default" | "large"
  className?: string
}

const PageHeader = React.forwardRef<HTMLDivElement, PageHeaderProps>(
  ({ title, subtitle, icon: Icon, backTo, onBack, actions, size = "default", className, ...props }, ref) => {
    const navigate = useNavigate()

    const handleBack = React.useCallback(() => {
      if (onBack) {
        onBack()
      } else if (backTo) {
        navigate(backTo)
      }
    }, [onBack, backTo, navigate])

    const showBack = Boolean(backTo || onBack)

    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center justify-between gap-4 pb-4",
          className
        )}
        {...props}
      >
        <div className="flex items-center gap-3 min-w-0">
          {showBack && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="gap-1 shrink-0"
              aria-label="Go back"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Back</span>
            </Button>
          )}

          <div className="flex items-center gap-2 min-w-0">
            {Icon && (
              <div className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0">
              <h1
                className={cn(
                  "font-semibold leading-tight tracking-tight truncate text-foreground",
                  size === "large" ? "text-2xl" : "text-lg"
                )}
              >
                {title}
              </h1>
              {subtitle && (
                <p className="text-sm text-muted-foreground truncate">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
        </div>

        {actions && (
          <div className="flex items-center gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>
    )
  }
)
PageHeader.displayName = "PageHeader"

export { PageHeader }
