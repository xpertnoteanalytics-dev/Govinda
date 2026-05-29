"use client";

import { forwardRef, type ButtonHTMLAttributes, type AnchorHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ActionVariant =
  | "call"
  | "whatsapp"
  | "email"
  | "maps"
  | "outline"
  | "primary"
  | "ghost"
  | "generate";

const variantStyles: Record<ActionVariant, string> = {
  call:
    "bg-emerald-600 text-white shadow-sm shadow-emerald-900/20 hover:bg-emerald-500 hover:shadow-emerald-500/25",
  whatsapp:
    "bg-[#25D366] text-white shadow-sm shadow-emerald-900/20 hover:bg-[#1fb855]",
  email:
    "bg-sky-600 text-white shadow-sm shadow-sky-900/20 hover:bg-sky-500 hover:shadow-sky-500/25",
  maps:
    "border border-slate-200/80 bg-white/5 text-slate-200 hover:bg-white/10 dark:border-white/10",
  outline:
    "border border-slate-200/80 bg-white text-ink hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10",
  primary:
    "bg-brand-600 text-white shadow-sm shadow-brand-900/25 hover:bg-brand-500 hover:shadow-brand-500/30",
  ghost:
    "border border-white/10 bg-white/5 text-white hover:bg-white/10",
  generate:
    "border border-white/10 bg-white/5 text-white hover:bg-white/10 hover:border-brand-400/30",
};

type BaseProps = {
  variant?: ActionVariant;
  isLoading?: boolean;
  fullWidth?: boolean;
  size?: "sm" | "md";
};

type ButtonProps = BaseProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };

type LinkProps = BaseProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

const sizeStyles = {
  sm: "h-9 gap-1.5 px-3 text-xs",
  md: "h-10 gap-2 px-4 text-sm",
};

function actionClassName(
  variant: ActionVariant,
  size: "sm" | "md",
  fullWidth?: boolean,
  className?: string
) {
  return cn(
    "inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-200",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40",
    "disabled:pointer-events-none disabled:opacity-50",
    variantStyles[variant],
    sizeStyles[size],
    fullWidth && "w-full",
    className
  );
}

export const ActionButton = forwardRef<
  HTMLButtonElement | HTMLAnchorElement,
  ButtonProps | LinkProps
>(function ActionButton(
  {
    variant = "primary",
    isLoading,
    fullWidth,
    size = "md",
    className,
    children,
    ...props
  },
  ref
) {
  const classes = actionClassName(variant, size, fullWidth, className);

  if ("href" in props && props.href) {
    const { href, ...anchorProps } = props as LinkProps;
    return (
      <a
        ref={ref as React.ForwardedRef<HTMLAnchorElement>}
        href={href}
        className={classes}
        {...anchorProps}
      >
        {children}
      </a>
    );
  }

  const { disabled, ...buttonProps } = props as ButtonProps;
  return (
    <button
      ref={ref as React.ForwardedRef<HTMLButtonElement>}
      type="button"
      disabled={disabled || isLoading}
      className={classes}
      {...buttonProps}
    >
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
    </button>
  );
});
