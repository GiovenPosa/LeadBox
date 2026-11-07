"use client";

import { useEffect, useId, useRef, useState } from "react";
import { HiMiniCheck, HiOutlinePencilSquare, HiOutlineTrash, HiMiniChevronDown } from "react-icons/hi2";
import styles from "./component-styles/taskList.module.css";
import { TextInput } from "./formFields";
import DatePicker from "./datePicker";
import Button, { IconButton } from "./button";
import ConfirmDialog from "./confirmDialog";
import { addTask, deleteTask, fetchTasks, setTaskDone, sortTasks, taskDue, updateTask, type Task } from "../../lib/tasks";
import { originLabel, type Subject } from "../../lib/subjects";
import { formatDue } from "../../lib/outreach";

// The tasks on something (a lead, enquiry, outreach business or contact), and
// on everything connected to it. Open ones first, soonest due; done ones fold
// away. New tasks are set on the subject itself.

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

type TaskListProps = {
  subject: Subject;
  /** called after any change, e.g. so a table can update its "next step" */
  onChange?: (tasks: Task[]) => void;
};

export default function TaskList({ subject, onChange }: TaskListProps) {
  const uid = useId();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<{ id: string; title: string; due: string | null } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showDone, setShowDone] = useState(false);

  // Start fresh whenever the subject changes (a panel reused for another row)
  const subjectKey = `${subject.kind}:${subject.id}`;
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  if (loadedFor !== subjectKey) {
    setLoadedFor(subjectKey);
    setTasks(null);
    setTitle("");
    setDue(null);
    setEditing(null);
    setError(null);
  }

  const { kind, id } = subject;
  useEffect(() => {
    let cancelled = false;
    fetchTasks({ kind, id })
      .then((list) => !cancelled && setTasks(list))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Couldn't load the tasks."));
    return () => {
      cancelled = true;
    };
  }, [kind, id]);

  function apply(update: (prev: Task[]) => Task[]) {
    setTasks((prev) => sortTasks(update(prev ?? [])));
  }

  // Tell the parent after each change (not from inside the state update)
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  useEffect(() => {
    if (tasks) onChangeRef.current?.(tasks);
  }, [tasks]);

  const fail = (e: unknown, fallback: string) => setError(e instanceof Error ? e.message : fallback);

  // Like the notes composer: the fields clear straight away, and come back if saving fails
  async function add(e?: { preventDefault(): void; stopPropagation(): void }) {
    e?.preventDefault();
    e?.stopPropagation();
    const text = title;
    const dueOn = due;
    if (!text.trim() || adding) return;
    setTitle("");
    setDue(null);
    setAdding(true);
    setError(null);
    try {
      const task = await addTask(subject, text, dueOn);
      apply((prev) => [...prev, task]);
    } catch (err) {
      setTitle((current) => current || text);
      setDue(dueOn);
      fail(err, "Couldn't add the task.");
    } finally {
      setAdding(false);
    }
  }

  async function toggle(task: Task) {
    const done = !task.done_at;
    // tick straight away; undo if saving fails
    apply((prev) => prev.map((t) => (t.id === task.id ? { ...t, done_at: done ? new Date().toISOString() : null } : t)));
    try {
      const saved = await setTaskDone(task, done);
      apply((prev) => prev.map((t) => (t.id === saved.id ? saved : t)));
    } catch (err) {
      apply((prev) => prev.map((t) => (t.id === task.id ? task : t)));
      fail(err, "Couldn't update the task.");
    }
  }

  async function saveEdit() {
    if (!editing || !editing.title.trim()) return;
    try {
      const saved = await updateTask(editing.id, { title: editing.title, due_on: editing.due });
      apply((prev) => prev.map((t) => (t.id === saved.id ? saved : t)));
      setEditing(null);
    } catch (err) {
      fail(err, "Couldn't save the change.");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteTask(deleteTarget.id);
      apply((prev) => prev.filter((t) => t.id !== deleteTarget.id));
    } catch (err) {
      fail(err, "Couldn't delete the task.");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  const open = tasks?.filter((t) => !t.done_at) ?? [];
  const done = tasks?.filter((t) => t.done_at) ?? [];

  function renderTask(task: Task) {
    const isEditing = editing?.id === task.id;
    const state = taskDue(task);
    const origin = originLabel(task, subject);

    if (isEditing) {
      return (
        <li key={task.id} className={styles.task}>
          <div className={styles.editRow}>
            <TextInput
              value={editing.title}
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  saveEdit();
                }
              }}
              aria-label="Task"
              autoFocus
            />
            <div className={styles.dueField}>
              <DatePicker
                id={`${uid}-edit-due`}
                value={editing.due}
                onChange={(v) => setEditing({ ...editing, due: v })}
                placeholder="No date"
                clearable
                align="end"
              />
            </div>
          </div>
          <div className={styles.editActions}>
            <Button size="sm" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" onClick={saveEdit}>
              Save
            </Button>
          </div>
        </li>
      );
    }

    return (
      <li key={task.id} className={cx(styles.task, task.done_at && styles.taskDone, "blur-in-soft")}>
        <button
          type="button"
          className={cx(styles.check, task.done_at && styles.checkOn)}
          onClick={() => toggle(task)}
          aria-pressed={!!task.done_at}
          aria-label={task.done_at ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
        >
          {task.done_at && <HiMiniCheck size={14} />}
        </button>
        <div className={styles.taskMain}>
          <span className={styles.title}>{task.title}</span>
          <span className={styles.meta}>
            {task.due_on && !task.done_at && (
              <span className={cx(styles.due, state && styles[state])}>{formatDue(task.due_on)}</span>
            )}
            {origin && <span className={styles.origin}>{origin}</span>}
          </span>
        </div>
        <span className={styles.actions}>
          {!task.done_at && (
            <IconButton
              size="sm"
              variant="ghost"
              icon={<HiOutlinePencilSquare size={16} />}
              label="Edit task"
              onClick={() => setEditing({ id: task.id, title: task.title, due: task.due_on })}
            />
          )}
          <IconButton
            size="sm"
            variant="ghost"
            icon={<HiOutlineTrash size={16} />}
            label="Delete task"
            onClick={() => setDeleteTarget(task)}
          />
        </span>
      </li>
    );
  }

  return (
    <div className={styles.taskList}>
      {/* not a <form>: it often sits inside a side panel's form */}
      <div className={styles.composer}>
        <TextInput
          placeholder="Add a task…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add(e);
          }}
          readOnly={adding}
          aria-label="New task"
        />
        <div className={styles.dueField}>
          <DatePicker id={`${uid}-due`} value={due} onChange={setDue} placeholder="Due" clearable align="end" />
        </div>
        <Button variant="primary" onClick={() => add()} disabled={!title.trim()} busy={adding}>
          Add
        </Button>
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {tasks === null ? (
        <p className={styles.empty}>Loading tasks…</p>
      ) : open.length === 0 && done.length === 0 ? (
        <p className={styles.empty}>No tasks yet. Add the next thing to do, with a date, and it shows on your dashboard.</p>
      ) : (
        <>
          {open.length > 0 ? (
            <ul className={styles.list}>{open.map(renderTask)}</ul>
          ) : (
            <p className={styles.empty}>Nothing to do. All done.</p>
          )}
          {done.length > 0 && (
            <div className={styles.doneSection}>
              <button
                type="button"
                className={styles.doneToggle}
                onClick={() => setShowDone((v) => !v)}
                aria-expanded={showDone}
              >
                <HiMiniChevronDown size={16} className={cx(styles.chevron, showDone && styles.chevronOpen)} />
                Done ({done.length})
              </button>
              {showDone && <ul className={styles.list}>{done.map(renderTask)}</ul>}
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        variant="danger"
        open={deleteTarget !== null}
        title="Delete this task?"
        message={`"${deleteTarget?.title ?? ""}" will be removed for good. This can't be undone.`}
        confirmLabel="Delete"
        busyLabel="Deleting…"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
