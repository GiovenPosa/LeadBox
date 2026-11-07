"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import { HiOutlinePencilSquare, HiOutlineTrash } from "react-icons/hi2";
import styles from "./component-styles/notesTimeline.module.css";
import { TextArea } from "./formFields";
import Button, { IconButton } from "./button";
import ConfirmDialog from "./confirmDialog";
import {
  addNote,
  deleteNote,
  editNote,
  fetchNotes,
  noteOrigin,
  type Note,
  type NoteSubject,
} from "../../lib/notes";

// The notes on something (a lead, enquiry, outreach business or contact), and
// on everything connected to it, newest first. New notes are written on the
// subject itself. Used on the lead page and in the side panels.

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: new Date(iso).getFullYear() === new Date().getFullYear() ? undefined : "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function NotesTimeline({ subject }: { subject: NoteSubject }) {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Load again whenever the subject changes (a panel reused for another row)
  const subjectKey = `${subject.kind}:${subject.id}`;
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  if (loadedFor !== subjectKey) {
    setLoadedFor(subjectKey);
    setNotes(null);
    setDraft("");
    setEditing(null);
    setError(null);
  }

  const { kind, id } = subject;
  useEffect(() => {
    let cancelled = false;
    fetchNotes({ kind, id })
      .then((list) => !cancelled && setNotes(list))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Couldn't load the notes."));
    return () => {
      cancelled = true;
    };
  }, [kind, id]);

  async function add() {
    if (!draft.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const note = await addNote(subject, draft);
      setNotes((prev) => [note, ...(prev ?? [])]);
      setDraft("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the note.");
    } finally {
      setAdding(false);
    }
  }

  async function saveEdit() {
    if (!editing || !editing.body.trim()) return;
    setSavingEdit(true);
    setError(null);
    try {
      const note = await editNote(editing.id, editing.body);
      setNotes((prev) => (prev ?? []).map((n) => (n.id === note.id ? note : n)));
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the change.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteNote(deleteTarget.id);
      setNotes((prev) => (prev ?? []).filter((n) => n.id !== deleteTarget.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete the note.");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  // ⌘/Ctrl + Enter saves; plain Enter is a new line. Kept from the form around
  // it (the side panels are forms).
  const saveOnModEnter = (action: () => void) => (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      e.stopPropagation();
      action();
    }
  };

  return (
    <div className={styles.timeline}>
      <div className={styles.composer}>
        <TextArea
          rows={2}
          placeholder="Add a note…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={saveOnModEnter(add)}
          aria-label="New note"
        />
        {draft.trim() && (
          <div className={styles.composerActions}>
            <span className={styles.hint}>⌘ Enter to save</span>
            <Button size="sm" variant="primary" busy={adding} onClick={add}>
              {adding ? "Saving…" : "Add note"}
            </Button>
          </div>
        )}
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {notes === null ? (
        <p className={styles.empty}>Loading notes…</p>
      ) : notes.length === 0 ? (
        <p className={styles.empty}>No notes yet. Anything worth remembering goes here, and stays as this moves along.</p>
      ) : (
        <ol className={styles.list}>
          {notes.map((note) => {
            const origin = noteOrigin(note, subject);
            const isEditing = editing?.id === note.id;
            return (
              <li key={note.id} className={`${styles.note} blur-in-soft`}>
                {isEditing ? (
                  <div className={styles.editArea}>
                    <TextArea
                      rows={3}
                      value={editing.body}
                      onChange={(e) => setEditing({ id: note.id, body: e.target.value })}
                      onKeyDown={saveOnModEnter(saveEdit)}
                      aria-label="Edit note"
                      autoFocus
                    />
                    <div className={styles.composerActions}>
                      <Button size="sm" onClick={() => setEditing(null)} disabled={savingEdit}>
                        Cancel
                      </Button>
                      <Button size="sm" variant="primary" busy={savingEdit} onClick={saveEdit}>
                        {savingEdit ? "Saving…" : "Save"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className={styles.body}>{note.body}</p>
                    <div className={styles.meta}>
                      <time dateTime={note.created_at}>{formatWhen(note.created_at)}</time>
                      {origin && <span className={styles.origin}>{origin}</span>}
                      {note.edited_at && <span title={`Edited ${formatWhen(note.edited_at)}`}>edited</span>}
                      <span className={styles.actions}>
                        <IconButton
                          size="sm"
                          variant="ghost"
                          icon={<HiOutlinePencilSquare size={16} />}
                          label="Edit note"
                          onClick={() => setEditing({ id: note.id, body: note.body })}
                        />
                        <IconButton
                          size="sm"
                          variant="ghost"
                          icon={<HiOutlineTrash size={16} />}
                          label="Delete note"
                          onClick={() => setDeleteTarget(note)}
                        />
                      </span>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ol>
      )}

      <ConfirmDialog
        variant="danger"
        open={deleteTarget !== null}
        title="Delete this note?"
        message="It will be removed for good. This can't be undone."
        confirmLabel="Delete"
        busyLabel="Deleting…"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
