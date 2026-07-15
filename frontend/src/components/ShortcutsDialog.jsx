import {
  AlertDialog, AlertDialogAction, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "./ui/alert-dialog";

export default function ShortcutsDialog({ open, onOpenChange }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="slab border-border">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-heading">Keyboard shortcuts</AlertDialogTitle>
          <AlertDialogDescription>Move faster.</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <Row k="A" desc="Add lecture" />
          <Row k="D" desc="Mark done (with tag)" />
          <Row k="U" desc="Undo last action" />
          <Row k="R" desc="Edit current task" />
          <Row k="1–9" desc="Set step amount" />
          <Row k="?" desc="Show this dialog" />
        </div>
        <AlertDialogFooter>
          <AlertDialogAction className="rounded-xl">Got it</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function Row({ k, desc }) {
  return (
    <div className="flex items-center gap-3">
      <kbd className="font-mono text-xs px-2 py-1 rounded border border-border bg-[hsl(var(--muted))] min-w-[2.5rem] text-center">{k}</kbd>
      <span className="text-sm text-foreground/90">{desc}</span>
    </div>
  );
}
