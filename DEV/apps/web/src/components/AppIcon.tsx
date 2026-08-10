import type { ComponentType, ReactNode } from 'react';
import { Circle } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { cn } from '@/lib/utils';

const iconRegistry = LucideIcons as unknown as Record<string, ComponentType<any>>;

function toPascalCaseIconName(value: string) {
  return value
    .trim()
    .replace(/(^[a-zA-Z0-9])|([\s_-]+[a-zA-Z0-9])/g, (segment) =>
      segment.replace(/[\s_-]+/, '').toUpperCase(),
    );
}

export function resolveLucideIconName(iconId?: string | null) {
  if (!iconId) return undefined;

  const raw = iconId.trim();
  if (!raw) return undefined;

  const pascalCase = toPascalCaseIconName(raw);
  const candidates = [
    raw,
    pascalCase,
    raw.replace(/Icon$/i, ''),
    `${pascalCase}Icon`,
  ].filter(Boolean);

  return candidates.find((candidate) => iconRegistry[candidate]) ?? undefined;
}

export interface AppIconProps {
  iconId?: string | null;
  iconUrl?: string | null;
  emojiCode?: string | null;
  alt?: string;
  className?: string;
  imgClassName?: string;
  emojiClassName?: string;
  fallback?: ReactNode;
}

export function AppIcon({
  iconId,
  iconUrl,
  emojiCode,
  alt,
  className,
  imgClassName,
  emojiClassName,
  fallback,
}: AppIconProps) {
  if (iconUrl) {
    return (
      <img
        src={iconUrl}
        alt={alt ?? ''}
        className={cn('object-contain', className, imgClassName)}
      />
    );
  }

  if (emojiCode) {
    return (
      <span className={cn('emoji-glyph inline-flex items-center justify-center', className, emojiClassName)}>
        {emojiCode}
      </span>
    );
  }

  if (iconId) {
    const resolvedIconName = resolveLucideIconName(iconId);
    const IconCmp = resolvedIconName ? iconRegistry[resolvedIconName] : Circle;
    return <IconCmp className={className} aria-hidden />;
  }

  return <>{fallback ?? null}</>;
}