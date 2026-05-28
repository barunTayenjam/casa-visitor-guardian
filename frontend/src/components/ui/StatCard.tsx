import * as React from "react"
import { TrendingUp, TrendingDown, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export interface StatCardProps {
  icon?: LucideIcon; iconColor?: string; label: string; value: string | number;
  change?: { value: number; label?: string }; className?: string;
}

const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  ({ icon: Icon, iconColor = "text-muted-foreground", label, value, change, className, ...props }, ref) => {
    const isPositive = change && change.value >= 0;
    const isNegative = change && change.value < 0;
    return (
      <div ref={ref} className={cn("p-[1px] rounded-[1.25rem] bg-white/[0.08]", className)} {...props}>
        <div className="rounded-[calc(1.25rem-1px)] bg-card shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
              <p className="text-2xl font-semibold tracking-tight">{value}</p>
            </div>
            {Icon && (
              <div className="flex h-9 w-9 items-center justify-center rounded-[0.75rem] bg-white/[0.06]">
                <Icon className={cn("h-4 w-4", iconColor)} />
              </div>
            )}
          </div>
          {change && (
            <div className="mt-2 flex items-center gap-1 text-xs font-medium">
              {isPositive ? <TrendingUp className="h-3 w-3 text-emerald-500" /> : isNegative ? <TrendingDown className="h-3 w-3 text-red-500" /> : null}
              <span className={cn(isPositive && "text-emerald-500", isNegative && "text-red-500", !isPositive && !isNegative && "text-muted-foreground")}>
                {change.value > 0 ? "+" : ""}{change.value}%
                {change.label && <span className="text-muted-foreground ml-1">{change.label}</span>}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }
)
StatCard.displayName = "StatCard"

export { StatCard }
