"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

type DeleteInvestigationButtonProps = {
  investigationId: string;
  label?: string;
  deleted?: boolean;
  onDeleted?: (investigationId: string) => void;
  className?: string;
};

/**
 * Trash control + confirmation. Calls DELETE and reports completion so the
 * parent can update optimistically.
 */
export function DeleteInvestigationButton({
  investigationId,
  label,
  deleted,
  onDeleted,
  className,
}: DeleteInvestigationButtonProps) {
  const [deleting, setDeleting] = useState(false);

  const doDelete = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/investigations/${investigationId}`, {
        method: "DELETE",
      });
      if (response.ok) onDeleted?.(investigationId);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          aria-label={label ?? "Delete investigation"}
          disabled={deleting || deleted}
          className={cn(
            "rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive",
            "disabled:pointer-events-none disabled:opacity-40",
            className,
          )}
        >
          {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this investigation?</AlertDialogTitle>
          <AlertDialogDescription>
            Removes its calls, transcripts, findings and recordings from this machine. This can&apos;t
            be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={() => void doDelete()}
          >
            {deleting ? "Deleting…" : "Delete investigation"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
