// Tremor Select [v1.0.0]
//
// Repris tel quel, aux couleurs près : les gris de Tailwind livrés par Tremor
// laissent la place aux jetons du thème, et l'anneau de focus bleu à l'anneau
// obsidian du reste des champs.

"use client";

import React from "react";
import * as SelectPrimitives from "@radix-ui/react-select";
import { RiArrowDownSLine, RiArrowUpSLine, RiCheckLine, RiExpandUpDownLine } from "@remixicon/react";

import { cx } from "@/lib/utils";

const Select = SelectPrimitives.Root;
Select.displayName = "Select";

const SelectGroup = SelectPrimitives.Group;
SelectGroup.displayName = "SelectGroup";

const SelectValue = SelectPrimitives.Value;
SelectValue.displayName = "SelectValue";

const selectTriggerStyles = cx(
  "group/trigger flex w-full cursor-pointer select-none items-center justify-between gap-2 truncate rounded-xl border px-3 py-2 outline-none transition sm:text-sm",
  "border-border text-ink",
  "data-[placeholder]:text-steel",
  "bg-surface hover:bg-mist",
  "data-[disabled]:cursor-not-allowed data-[disabled]:bg-mist data-[disabled]:text-ash",
  "focus-visible:ring-2 focus-visible:ring-obsidian/25",
);

const SelectTrigger = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitives.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitives.Trigger>
>(({ className, children, ...props }, forwardedRef) => {
  return (
    <SelectPrimitives.Trigger
      ref={forwardedRef}
      className={cx(selectTriggerStyles, className)}
      {...props}
    >
      <span className="truncate">{children}</span>
      <SelectPrimitives.Icon asChild>
        <RiExpandUpDownLine
          className={cx(
            "size-4 shrink-0 text-ash",
            "group-data-[disabled]/trigger:text-pebble",
          )}
        />
      </SelectPrimitives.Icon>
    </SelectPrimitives.Trigger>
  );
});

SelectTrigger.displayName = "SelectTrigger";

const SelectScrollUpButton = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitives.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitives.ScrollUpButton>
>(({ className, ...props }, forwardedRef) => (
  <SelectPrimitives.ScrollUpButton
    ref={forwardedRef}
    className={cx("flex cursor-default items-center justify-center py-1", className)}
    {...props}
  >
    <RiArrowUpSLine className="size-3 shrink-0" aria-hidden="true" />
  </SelectPrimitives.ScrollUpButton>
));
SelectScrollUpButton.displayName = SelectPrimitives.ScrollUpButton.displayName;

const SelectScrollDownButton = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitives.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitives.ScrollDownButton>
>(({ className, ...props }, forwardedRef) => (
  <SelectPrimitives.ScrollDownButton
    ref={forwardedRef}
    className={cx("flex cursor-default items-center justify-center py-1", className)}
    {...props}
  >
    <RiArrowDownSLine className="size-3 shrink-0" aria-hidden="true" />
  </SelectPrimitives.ScrollDownButton>
));
SelectScrollDownButton.displayName = SelectPrimitives.ScrollDownButton.displayName;

const SelectContent = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitives.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitives.Content>
>(
  (
    { className, position = "popper", children, sideOffset = 8, collisionPadding = 10, ...props },
    forwardedRef,
  ) => (
    <SelectPrimitives.Portal>
      <SelectPrimitives.Content
        ref={forwardedRef}
        className={cx(
          "relative z-50 overflow-hidden rounded-2xl border shadow-[var(--shadow-md)]",
          "min-w-[calc(var(--radix-select-trigger-width)-2px)] max-w-[95vw]",
          "max-h-[var(--radix-select-content-available-height)]",
          "border-border bg-surface text-ink",
          "will-change-[transform,opacity]",
          "data-[state=closed]:animate-hide",
          "data-[side=bottom]:animate-slide-down-and-fade data-[side=left]:animate-slide-left-and-fade data-[side=right]:animate-slide-right-and-fade data-[side=top]:animate-slide-up-and-fade",
          className,
        )}
        sideOffset={sideOffset}
        position={position}
        collisionPadding={collisionPadding}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitives.Viewport
          className={cx(
            "p-1",
            position === "popper" &&
              "h-[var(--radix-select-trigger-height)] w-full min-w-[calc(var(--radix-select-trigger-width))]",
          )}
        >
          {children}
        </SelectPrimitives.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitives.Content>
    </SelectPrimitives.Portal>
  ),
);

SelectContent.displayName = "SelectContent";

const SelectGroupLabel = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitives.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitives.Label>
>(({ className, ...props }, forwardedRef) => (
  <SelectPrimitives.Label
    ref={forwardedRef}
    className={cx("px-3 py-2 text-xs font-medium tracking-wide text-steel", className)}
    {...props}
  />
));

SelectGroupLabel.displayName = "SelectGroupLabel";

const SelectItem = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitives.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitives.Item>
>(({ className, children, ...props }, forwardedRef) => {
  return (
    <SelectPrimitives.Item
      ref={forwardedRef}
      className={cx(
        "grid cursor-pointer grid-cols-[1fr_20px] items-center gap-x-2 rounded-xl px-3 py-2 outline-none transition-colors data-[state=checked]:font-semibold sm:text-sm",
        "text-ink hover:bg-mist focus-visible:bg-mist",
        "data-[disabled]:pointer-events-none data-[disabled]:text-ash",
        className,
      )}
      {...props}
    >
      <SelectPrimitives.ItemText className="flex-1 truncate">{children}</SelectPrimitives.ItemText>
      <SelectPrimitives.ItemIndicator>
        <RiCheckLine className="size-5 shrink-0 text-graphite" aria-hidden="true" />
      </SelectPrimitives.ItemIndicator>
    </SelectPrimitives.Item>
  );
});

SelectItem.displayName = "SelectItem";

const SelectSeparator = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitives.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitives.Separator>
>(({ className, ...props }, forwardedRef) => (
  <SelectPrimitives.Separator
    ref={forwardedRef}
    className={cx("-mx-1 my-1 h-px bg-border", className)}
    {...props}
  />
));

SelectSeparator.displayName = "SelectSeparator";

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
