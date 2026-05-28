import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export interface EmptyStateProps {
  icon: LucideIcon; title: string; description?: string;
  action?: { label: string; onClick: () => void }; className?: string;
}

const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ icon: Icon, title, description, action, className, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("flex flex-col items-center justify-center gap-5 py-16 text-center", className)} {...props}>
        <div className="w-14 h-14 rounded-full bg-white/[0.06] flex items-center justify-center border border-white/[0.12]">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-base font-medium">{title}</h3>
          {description && <p className="text-sm text-muted-foreground max-w-sm">{description}</p>}
        </div>
        {action && <Button onClick={action.onClick} className="mt-1">{action.label}</Button>}
      </div>
    )
  }
)
EmptyState.displayName = "EmptyState"

export { EmptyState }
