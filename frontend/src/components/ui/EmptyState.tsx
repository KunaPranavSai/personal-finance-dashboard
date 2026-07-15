import { LucideIcon, Inbox } from "lucide-react";
import { Button } from "./Button";
import { ReactNode } from "react";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal/10">
        <Icon className="h-6 w-6 text-teal" />
      </div>
      <div>
        <p className="text-sm font-semibold text-navy dark:text-white">{title}</p>
        {description && (
          <p className="mt-1 max-w-sm text-sm text-navy/50 dark:text-white/50">{description}</p>
        )}
      </div>
      {action ? action : (actionLabel && onAction && (
        <Button size="sm" onClick={onAction} className="mt-2">{actionLabel}</Button>
      ))}
    </div>
  );
}
