import { useState, type FormEvent, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import {
  getListAdminUpdatesQueryKey,
  getListUpdatesQueryKey,
  useCreateUpdate,
  useDeleteUpdate,
  useListAdminUpdates,
  useListUpdates,
  useUpdateUpdate,
} from "@workspace/api-client-react";
import type { Update, UpdateCategory } from "@workspace/api-client-react";

const categories: UpdateCategory[] = ["Announcement", "News", "Important notice", "Program update", "Opportunity update", "Event reminder"];
const dateLabel = (value: string) => new Date(value).toLocaleDateString("en", { month: "long", day: "numeric", year: "numeric" });
const statusStyle = (published: boolean) => published ? "bg-[#e3eee6] text-[#245c4c]" : "bg-[#ecece4] text-[#626c64]";

function PageHead({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="mb-2 text-[11px] font-bold uppercase tracking-[.18em] text-[#a6604c]">{eyebrow}</p><h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-[2.6rem]">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p></div>{action}</div>;
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="rounded-2xl border border-dashed border-[#c9d5ca] bg-[#f2f5ef] px-6 py-11 text-center"><Megaphone className="mx-auto mb-3 text-primary" size={24} /><h2 className="font-display text-xl font-bold">{title}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{text}</p></div>;
}

export function UpdatesPage() {
  const query = useListUpdates({ query: { queryKey: getListUpdatesQueryKey() } });
  return <div className="page-enter">
    <PageHead eyebrow="From B4P" title="Updates" description="News, announcements and important information from the B4P community." />
    {query.isLoading ? <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">Loading updates…</div>
      : query.isError ? <div role="alert" className="rounded-xl border border-[#e7c9be] bg-[#fff8f1] p-4 text-sm">Updates could not be loaded. Refresh the page to try again.</div>
        : !query.data?.length ? <EmptyState title="No updates yet" text="New announcements and community news will appear here." />
          : <div className="space-y-4">{query.data.map((update) => <article key={update.id} className="overflow-hidden rounded-2xl border border-border bg-card">{update.imageUrl && <img src={update.imageUrl} alt="" loading="lazy" className="max-h-72 w-full object-cover" />}<div className="p-5 sm:p-7"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-[#fbefd7] px-2.5 py-1 text-[11px] font-bold text-[#805b21]">{update.category}</span><span className="text-xs text-muted-foreground">{dateLabel(update.createdAt)}</span></div><h2 className="mt-3 font-display text-xl font-bold sm:text-2xl">{update.title}</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#536d60]">{update.content}</p></div></article>)}</div>}
  </div>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-[#112e28]/50 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" className="max-h-[90dvh] w-full max-w-2xl overflow-auto rounded-2xl border border-border bg-card p-5 shadow-2xl sm:p-7"><div className="mb-5 flex items-center justify-between"><h2 className="font-display text-xl font-extrabold">{title}</h2><button type="button" onClick={onClose} aria-label="Close dialog" className="rounded-lg px-3 py-2 text-sm hover:bg-muted">Close</button></div>{children}</section></div>;
}

function Field({ label, name, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) {
  return <label className="block space-y-1.5 text-xs font-semibold">{label}<input name={name} {...props} className="h-10 w-full rounded-lg border border-border bg-[#fbf9f2] px-3 text-sm font-normal outline-none focus:border-primary" /></label>;
}

function TextArea({ label, name, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; name: string }) {
  return <label className="block space-y-1.5 text-xs font-semibold">{label}<textarea name={name} {...props} className="min-h-28 w-full rounded-lg border border-border bg-[#fbf9f2] p-3 text-sm font-normal outline-none focus:border-primary" /></label>;
}

export function AdminUpdatesPage() {
  const queryClient = useQueryClient();
  const query = useListAdminUpdates({ query: { queryKey: getListAdminUpdatesQueryKey() } });
  const create = useCreateUpdate();
  const update = useUpdateUpdate();
  const remove = useDeleteUpdate();
  const [editing, setEditing] = useState<Update | null | false>(false);
  const refresh = async () => Promise.all([
    queryClient.invalidateQueries({ queryKey: getListAdminUpdatesQueryKey() }),
    queryClient.invalidateQueries({ queryKey: getListUpdatesQueryKey() }),
  ]);
  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const content = {
      title: String(data.get("title") ?? "").trim(),
      category: String(data.get("category") ?? "Announcement") as UpdateCategory,
      content: String(data.get("content") ?? "").trim(),
      imageUrl: String(data.get("imageUrl") ?? "").trim() || null,
      published: data.get("published") === "on",
    };
    const onSuccess = () => { refresh(); setEditing(false); };
    if (editing) update.mutate({ id: editing.id, data: content }, { onSuccess });
    else create.mutate({ data: content }, { onSuccess });
  };
  return <div className="page-enter">
    <PageHead eyebrow="Community information" title="Updates" description="Create and manage news and announcements separately from personal notifications." action={<button onClick={() => setEditing(null)} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"><Plus size={15} />New update</button>} />
    {query.isLoading ? <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">Loading updates…</div>
      : query.isError ? <div role="alert" className="rounded-xl border border-[#e7c9be] bg-[#fff8f1] p-4 text-sm">Updates could not be loaded. Refresh the page to try again.</div>
        : !query.data?.length ? <EmptyState title="No updates published" text="Create the first update to share official B4P news with youth members." />
          : <div className="space-y-3">{query.data.map((item) => <article key={item.id} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusStyle(item.published)}`}>{item.published ? "Published" : "Draft"}</span><span className="rounded-full bg-[#fbefd7] px-2.5 py-1 text-[11px] font-bold text-[#805b21]">{item.category}</span><span className="text-[11px] text-muted-foreground">{dateLabel(item.createdAt)}</span></div><h2 className="mt-2 font-display text-lg font-bold">{item.title}</h2><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.content}</p></div><div className="flex gap-2"><button onClick={() => setEditing(item)} className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-semibold hover:bg-muted"><Pencil size={14} />Edit</button><button aria-label={`Delete ${item.title}`} onClick={() => { if (window.confirm(`Delete “${item.title}”?`)) remove.mutate({ id: item.id }, { onSuccess: refresh }); }} className="rounded-xl px-3 py-2 text-muted-foreground hover:bg-[#f7e6df] hover:text-[#954b3d]"><Trash2 size={15} /></button></div></article>)}</div>}
    {editing !== false && <Modal title={editing ? "Edit update" : "New update"} onClose={() => setEditing(false)}><form onSubmit={save} className="space-y-4"><Field name="title" label="Title" required defaultValue={editing?.title} /><label className="block space-y-1.5 text-xs font-semibold">Category<select name="category" defaultValue={editing?.category ?? "Announcement"} className="h-10 w-full rounded-lg border border-border bg-[#fbf9f2] px-3 text-sm">{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label><TextArea name="content" label="Content" required defaultValue={editing?.content} /><Field name="imageUrl" label="Image URL (optional)" type="url" defaultValue={editing?.imageUrl ?? ""} /><label className="flex items-center gap-2 text-sm"><input name="published" type="checkbox" defaultChecked={editing?.published ?? false} className="accent-[#1d6252]" />Publish this update</label>{(create.isError || update.isError) && <p role="alert" className="text-sm text-[#954b3d]">Could not save the update. Check the fields and try again.</p>}<button type="submit" disabled={create.isPending || update.isPending} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60">{create.isPending || update.isPending ? "Saving…" : "Save update"}</button></form></Modal>}
  </div>;
}
