import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-[transform,opacity,background-color] duration-150 ease-out active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 min-h-11 px-4 text-sm",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-fg rounded-[10px] hover:opacity-90",
        accent: "bg-accent text-accent-fg rounded-[10px] hover:opacity-90",
        outline:
          "rounded-[10px] border border-border bg-bg-elevated text-fg hover:bg-bg-subtle",
        ghost: "rounded-[10px] text-fg-muted hover:bg-bg-subtle hover:text-fg",
        danger: "rounded-[10px] bg-danger/15 text-danger hover:bg-danger/25",
      },
      size: {
        default: "min-h-11 px-4",
        lg: "min-h-12 px-5 text-base",
        sm: "min-h-9 px-3 text-sm",
        icon: "size-11 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}
