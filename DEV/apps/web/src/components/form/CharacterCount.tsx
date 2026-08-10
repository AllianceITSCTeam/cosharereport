interface CharacterCountProps {
  current?: string;
  max: number;
  className?: string;
}

export function CharacterCount({ current, max, className }: CharacterCountProps) {
  const count = current?.length ?? 0;
  const ratio = max > 0 ? count / max : 0;
  const toneClass = ratio >= 0.95 ? 'text-destructive' : ratio >= 0.8 ? 'text-amber-600' : 'text-muted-foreground';

  return (
    <p className={`text-xs text-right ${toneClass}${className ? ` ${className}` : ''}`}>
      {count}/{max}
    </p>
  );
}
