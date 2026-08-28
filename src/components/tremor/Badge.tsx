// Tremor Badge [v1.0.0]
//
// Les cinq variantes de Tremor, repeintes avec les jetons du thème. Le site n'a
// pas d'accent chromatique : la variante par défaut est donc grise, et seules
// les trois variantes d'état — succès, avertissement, erreur — portent une
// couleur, celles que le tableau de bord emploie déjà partout ailleurs.

import React from "react";
import { tv, type VariantProps } from "tailwind-variants";

import { cx } from "@/lib/utils";

const badgeVariants = tv({
  base: cx(
    "inline-flex items-center gap-x-1 whitespace-nowrap rounded-xl px-2 py-1 text-xs font-medium ring-1 ring-inset",
  ),
  variants: {
    variant: {
      default: "bg-mist text-graphite ring-border",
      neutral: "bg-mist text-steel ring-border",
      success: "bg-success/10 text-success ring-success/25",
      error: "bg-danger/10 text-danger ring-danger/25",
      warning: "bg-warning/10 text-warning ring-warning/25",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

interface BadgeProps
  extends React.ComponentPropsWithoutRef<"span">,
    VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, ...props }: BadgeProps, forwardedRef) => {
    return (
      <span ref={forwardedRef} className={cx(badgeVariants({ variant }), className)} {...props} />
    );
  },
);

Badge.displayName = "Badge";

export { Badge, badgeVariants, type BadgeProps };
