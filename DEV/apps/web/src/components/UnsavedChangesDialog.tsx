import type { useBlocker } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

type Blocker = ReturnType<typeof useBlocker>;

interface UnsavedChangesDialogProps {
  blocker: Blocker;
}

/**
 * Shows a confirmation dialog when the user tries to navigate away with unsaved changes.
 * Must be paired with useUnsavedChangesGuard — renders nothing when blocker is idle.
 *
 * See: docs/flows/F03-unsaved-changes-guard.md
 */
export function UnsavedChangesDialog({ blocker }: UnsavedChangesDialogProps) {
  const isBlocked = blocker.state === 'blocked';

  return (
    <Dialog
      open={isBlocked}
      // Prevent backdrop click dismissal — user must choose explicitly
      onOpenChange={() => undefined}
    >
      <DialogContent
        data-testid="unsaved-changes-dialog"
        className="sm:max-w-md"
        // Disable the default X close button behaviour
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Unsaved Changes</DialogTitle>
          <DialogDescription>
            You have unsaved changes. If you leave this page, your changes will be lost.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button
            data-testid="unsaved-changes-leave"
            variant="destructive"
            onClick={() => blocker.proceed?.()}
          >
            Leave
          </Button>
          <Button
            data-testid="unsaved-changes-stay"
            onClick={() => blocker.reset?.()}
          >
            Stay
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
