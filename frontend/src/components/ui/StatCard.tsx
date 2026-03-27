import * as React from "react"
import { TrendingUp, TrendingDown, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"

export interface StatCardProps {
  icon?: LucideIcon
  iconColor?: string
  label: string
  value: string | number
  change?: { value: number; label?: string }
  className?: string
}

const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  ({ icon: Icon, iconColor = "text-muted-foreground", label, value, change, className, ...props }, ref) => {
    const isPositive = change && change.value >= 0
    const isNegative = change && change.value < 0

    return (
      <Card ref={ref} className={cn("relative", className)} {...props}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {label}
              </p>
              <p className="text-2xl font-bold tracking-tight text-foreground">
                {value}
              </p>
            </div>

            {Icon && (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <Icon className={cn("h-4 w-4", iconColor)} />
              </div>
            )}
          </div>

          {change && (
            <div className="mt-2 flex items-center gap-1 text-xs font-medium">
              {isPositive ? (
                <TrendingUp className="h-3 w-3 text-emerald-500" />
              ) : isNegative ? (
                <TrendingDown className="h-3 w-3 text-red-500" />
              ) : null}
              <span
                className={cn(
                  isPositive && "text-emerald-500",
                  isNegative && "text-red-500",
                  !isPositive && !isNegative && "text-muted-foreground"
                )}
              >
                {change.value > 0 ? "+" : ""}
                {change.value}%
                {change.label && (
                  <span className="text-muted-foreground ml-1">
                    {change.label}
                  </span>
                )}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }
)
StatCard.displayName = "StatCard"

export { StatCard }
