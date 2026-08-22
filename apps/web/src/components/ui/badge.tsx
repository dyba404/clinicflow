import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive/10 text-destructive",
        outline: "text-foreground",
        teal: "border-transparent bg-accent text-accent-foreground",
        amber: "border-transparent bg-amber-500/15 text-amber-700",
        blue: "border-transparent bg-blue-500/12 text-blue-700",
        violet: "border-transparent bg-violet-500/12 text-violet-700",
        green: "border-transparent bg-emerald-500/14 text-emerald-700",
        red: "border-transparent bg-red-500/12 text-red-700",
        gray: "border-transparent bg-muted text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
