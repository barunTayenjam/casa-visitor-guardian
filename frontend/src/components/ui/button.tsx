import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.97]",
  {
    variants: {
      variant: {
        default:
          "rounded-full bg-primary text-primary-foreground hover:bg-primary/85 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_8px_24px_rgba(59,130,246,0.2)]",
        destructive:
          "rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/85 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]",
        outline:
          "rounded-full border border-white/[0.16] bg-white/[0.06] text-foreground hover:bg-white/[0.06] hover:border-white/[0.15] backdrop-blur-sm",
        secondary:
          "rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/70 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]",
        ghost:
          "rounded-full text-foreground/70 hover:text-foreground hover:bg-white/[0.06]",
        link:
          "text-primary underline-offset-4 hover:underline",
        "pill-ghost":
          "rounded-full text-foreground/70 hover:text-foreground hover:bg-white/[0.08]",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 rounded-full px-4 text-xs",
        lg: "h-12 rounded-full px-8 text-base",
        icon: "h-10 w-10 rounded-full",
        "icon-sm": "h-8 w-8 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
