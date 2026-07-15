import { useCallback, useEffect, useState } from "react";
import { ListChecks, Trash2 } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import api from "../lib/api";
import { toast } from "sonner";

export default function TaskChecklistCard() {
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState("");

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/tasks");
      setTasks(data.items || []);
    } catch (_) {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!newTask.trim()) return;
    try {
      await api.post("/tasks", { text: newTask.trim() });
      setNewTask(""); load();
    } catch (_) { toast.error("Failed to add task"); }
  };
  const toggle = async (t) => {
    await api.patch(`/tasks/${t.id}`, { done: !t.done });
    load();
  };
  const remove = async (t) => {
    await api.delete(`/tasks/${t.id}`);
    load();
  };

  return (
    <div className="slab rounded-2xl p-6" data-testid="task-checklist">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-heading text-xl font-semibold inline-flex items-center gap-2">
          <ListChecks className="h-4 w-4" /> Tasks
        </h3>
      </div>
      <div className="flex gap-2 mb-4">
        <Input value={newTask} onChange={(e) => setNewTask(e.target.value)}
          placeholder="Add a task…" data-testid="new-task-input"
          onKeyDown={(e) => { if (e.key === "Enter") add(); }}
          className="bg-transparent border-border/60 h-10" />
        <Button size="sm" onClick={add} data-testid="add-task-btn"
          className="rounded-lg bg-[hsl(var(--foreground))] text-[hsl(var(--background))] hover:bg-[hsl(var(--foreground)/0.9)]">
          Add
        </Button>
      </div>
      <ul className="space-y-2">
        {tasks.length === 0 && (
          <li className="text-sm text-muted-foreground italic">No tasks yet.</li>
        )}
        {tasks.map((t) => (
          <li key={t.id} className="flex items-center gap-3 group" data-testid={`task-item-${t.id}`}>
            <Checkbox checked={t.done} onCheckedChange={() => toggle(t)}
              data-testid={`task-toggle-${t.id}`} />
            <span className={`flex-1 text-sm ${t.done ? "text-muted-foreground line-through" : ""}`}>{t.text}</span>
            <button onClick={() => remove(t)}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-[hsl(var(--terracotta))] transition-opacity"
              data-testid={`task-delete-${t.id}`} aria-label="Delete task">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
