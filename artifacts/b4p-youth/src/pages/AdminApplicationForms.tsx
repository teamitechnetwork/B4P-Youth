import { useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, FileText, Plus, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetAdminDashboardQueryKey,
  getListAdminApplicationFormsQueryKey,
  getListAdminApplicationSubmissionsQueryKey,
  getListAdminProgramsQueryKey,
  getListApplicationFormsQueryKey,
  getListMyApplicationSubmissionsQueryKey,
  useCreateApplicationForm,
  useDeleteApplicationForm,
  useListAdminApplicationForms,
  useListAdminApplicationSubmissions,
  useListAdminPrograms,
  useUpdateApplicationForm,
  useUpdateApplicationSubmission,
} from "@workspace/api-client-react";
import type {
  AdminApplicationSubmission,
  ApplicationForm,
  ApplicationQuestionType,
  ApplicationStatus,
  Program,
} from "@workspace/api-client-react";

type QuestionDraft = {
  prompt: string;
  type: ApplicationQuestionType;
  required: boolean;
  options: string[];
  position: number;
};
type FormDraft = Pick<ApplicationForm, "title" | "description" | "instructions" | "eligibilityRequirements" | "deadline" | "programId" | "published"> & { questions: QuestionDraft[] };
const questionTypes: { value: ApplicationQuestionType; label: string }[] = [
  { value: "short_text", label: "Short text" },
  { value: "long_text", label: "Long text" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "dropdown", label: "Dropdown" },
  { value: "multiple_choice", label: "Multiple choice" },
  { value: "checkbox", label: "Checkboxes" },
  { value: "date", label: "Date" },
];
const statusList: ApplicationStatus[] = ["Submitted", "Under Review", "Accepted", "Rejected"];
const statusTone = (status: ApplicationStatus) => status === "Accepted" ? "bg-[#e3eee6] text-[#245c4c]" : status === "Rejected" ? "bg-[#f7e6df] text-[#954b3d]" : status === "Submitted" ? "bg-[#fbefd7] text-[#805b21]" : "bg-[#ecece4] text-[#626c64]";

function Head({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="mb-2 text-[11px] font-bold uppercase tracking-[.18em] text-[#a6604c]">Admin · Youth pathways</p><h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-[2.6rem]">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p></div>{action}</div>;
}

function Empty({ title, text }: { title: string; text: string }) {
  return <div className="rounded-2xl border border-dashed border-[#c9d5ca] bg-[#f2f5ef] px-6 py-10 text-center"><FileText className="mx-auto mb-3 text-primary" size={24} /><h2 className="font-display text-xl font-bold">{title}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{text}</p></div>;
}

function TextInput({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className="block space-y-1.5 text-xs font-semibold">{label}<input {...props} className="h-10 w-full rounded-lg border border-border bg-[#fbf9f2] px-3 text-sm font-normal outline-none focus:border-primary" /></label>;
}

function TextBlock({ label, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return <label className="block space-y-1.5 text-xs font-semibold">{label}<textarea {...props} className="min-h-24 w-full rounded-lg border border-border bg-[#fbf9f2] p-3 text-sm font-normal outline-none focus:border-primary" /></label>;
}

function FormEditor({
  form, programs, pending, error, onClose, onSave,
}: {
  form: ApplicationForm | null;
  programs: Program[];
  pending: boolean;
  error: boolean;
  onClose: () => void;
  onSave: (data: FormDraft) => void;
}) {
  const [questions, setQuestions] = useState<QuestionDraft[]>(() => form?.questions.map((question, position) => ({
    prompt: question.prompt, type: question.type, required: question.required, options: question.options, position,
  })) ?? []);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onSave({
      title: String(data.get("title") ?? "").trim(),
      description: String(data.get("description") ?? "").trim(),
      instructions: String(data.get("instructions") ?? "").trim(),
      eligibilityRequirements: String(data.get("eligibilityRequirements") ?? "").trim(),
      deadline: String(data.get("deadline") ?? "") || null,
      programId: String(data.get("programId") ?? "") ? Number(data.get("programId")) : null,
      published: data.get("published") === "on",
      questions: questions.map((question, position) => ({ ...question, position })),
    });
  };
  const patchQuestion = (index: number, update: Partial<QuestionDraft>) => setQuestions((previous) => previous.map((question, questionIndex) => questionIndex === index ? { ...question, ...update } : question));
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-[#112e28]/50 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" className="max-h-[92dvh] w-full max-w-3xl overflow-auto rounded-2xl border border-border bg-card p-5 shadow-2xl sm:p-7"><div className="mb-5 flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-wider text-[#a6604c]">Application form builder</p><h2 className="mt-1 font-display text-xl font-extrabold">{form ? "Edit application" : "New application"}</h2></div><button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm hover:bg-muted">Close</button></div>
    <form onSubmit={submit} className="space-y-4">
      <TextInput name="title" label="Application title" required minLength={2} maxLength={200} defaultValue={form?.title} />
      <TextBlock name="description" label="Description" required defaultValue={form?.description} />
      <div className="grid gap-4 md:grid-cols-2"><TextBlock name="instructions" label="Instructions" defaultValue={form?.instructions} /><TextBlock name="eligibilityRequirements" label="Eligibility requirements" defaultValue={form?.eligibilityRequirements} /></div>
      <div className="grid gap-4 sm:grid-cols-2"><TextInput name="deadline" type="date" label="Deadline (optional)" defaultValue={form?.deadline?.slice(0, 10) ?? ""} /><label className="block space-y-1.5 text-xs font-semibold">Linked program (optional)<select name="programId" defaultValue={form?.programId ?? ""} className="h-10 w-full rounded-lg border border-border bg-[#fbf9f2] px-3 text-sm"><option value="">No linked program</option>{programs.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}</select></label></div>
      <section className="rounded-2xl border border-border bg-[#f8f8f1] p-4 sm:p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-display text-lg font-bold">Custom questions</h3><p className="mt-1 text-xs text-muted-foreground">Order the questions as youth should answer them.</p></div><button type="button" onClick={() => setQuestions((previous) => [...previous, { prompt: "", type: "short_text", required: false, options: [], position: previous.length }])} className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold"><Plus size={15} />Add question</button></div>
        {!questions.length && <p className="rounded-xl border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">Add at least one question before publishing.</p>}
        <div className="space-y-3">{questions.map((question, index) => <article key={index} className="rounded-xl border border-border bg-card p-4"><div className="grid gap-3 sm:grid-cols-[1fr_210px_auto]"><TextInput label={`Question ${index + 1}`} value={question.prompt} onChange={(event) => patchQuestion(index, { prompt: event.target.value })} required maxLength={300} /><label className="block space-y-1.5 text-xs font-semibold">Answer type<select value={question.type} onChange={(event) => patchQuestion(index, { type: event.target.value as ApplicationQuestionType, options: ["dropdown", "multiple_choice", "checkbox"].includes(event.target.value) ? question.options : [] })} className="h-10 w-full rounded-lg border border-border bg-[#fbf9f2] px-3 text-sm">{questionTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label><button type="button" aria-label={`Remove question ${index + 1}`} onClick={() => setQuestions((previous) => previous.filter((_, questionIndex) => questionIndex !== index))} className="self-end rounded-lg p-2 text-muted-foreground hover:bg-[#f7e6df] hover:text-[#954b3d]"><Trash2 size={17} /></button></div>
          {["dropdown", "multiple_choice", "checkbox"].includes(question.type) && <label className="mt-3 block space-y-1.5 text-xs font-semibold">Options <span className="font-normal text-muted-foreground">(one per line; at least two)</span><textarea value={question.options.join("\n")} onChange={(event) => patchQuestion(index, { options: event.target.value.split("\n") })} className="min-h-20 w-full rounded-lg border border-border bg-[#fbf9f2] p-3 text-sm font-normal outline-none focus:border-primary" /></label>}
          <label className="mt-3 flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={question.required} onChange={(event) => patchQuestion(index, { required: event.target.checked })} className="accent-[#1d6252]" />Answer required</label>
        </article>)}</div>
      </section>
      <label className="flex items-center gap-2 text-sm font-semibold"><input name="published" type="checkbox" defaultChecked={form?.published ?? false} className="accent-[#1d6252]" />Publish this application form</label>
      {error && <p role="alert" className="text-sm text-[#954b3d]">Could not save this form. Check that each question has a prompt and choice questions have at least two options.</p>}
      <div className="flex flex-wrap gap-2"><button type="submit" disabled={pending} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60">{pending ? "Saving…" : "Save application"}</button><button type="button" onClick={onClose} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold">Cancel</button></div>
    </form>
  </section></div>;
}

function FormList({
  forms, programs, onEdit, onRefresh,
}: {
  forms: ApplicationForm[];
  programs: Program[];
  onEdit: (form: ApplicationForm) => void;
  onRefresh: () => void;
}) {
  const update = useUpdateApplicationForm();
  const remove = useDeleteApplicationForm();
  return !forms.length ? <Empty title="No application forms yet" text="Build the first form to collect structured applications from youth members." /> : <div className="space-y-3">{forms.map((form) => <article key={form.id} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${form.published ? "bg-[#e3eee6] text-[#245c4c]" : "bg-[#ecece4] text-[#626c64]"}`}>{form.published ? "Published" : "Draft"}</span>{form.deadline && <span className="text-xs text-muted-foreground">Due {new Date(`${form.deadline.slice(0, 10)}T12:00:00`).toLocaleDateString()}</span>}</div><h2 className="mt-2 font-display text-lg font-bold">{form.title}</h2><p className="mt-1 text-sm text-muted-foreground">{form.questions.length} question{form.questions.length === 1 ? "" : "s"}{form.programId ? ` · ${programs.find((program) => program.id === form.programId)?.name ?? "Linked program"}` : ""}</p></div><div className="flex flex-wrap gap-2"><button onClick={() => update.mutate({ id: form.id, data: { published: !form.published } }, { onSuccess: onRefresh })} className="rounded-xl border border-border px-3 py-2 text-sm font-semibold">{form.published ? "Unpublish" : "Publish"}</button><button onClick={() => onEdit(form)} className="rounded-xl bg-[#e7eee8] px-3 py-2 text-sm font-bold text-primary">Edit</button><button aria-label={`Delete ${form.title}`} onClick={() => { if (window.confirm(`Delete “${form.title}”? Submitted application records will be retained.`)) remove.mutate({ id: form.id }, { onSuccess: onRefresh }); }} className="rounded-xl p-2 text-muted-foreground hover:bg-[#f7e6df] hover:text-[#954b3d]"><Trash2 size={16} /></button></div></article>)}</div>;
}

function SubmissionCard({ item, onSave, pending }: { item: AdminApplicationSubmission; onSave: (status: ApplicationStatus, note: string) => void; pending: boolean }) {
  const [note, setNote] = useState(item.adminNote ?? "");
  const [status, setStatus] = useState<ApplicationStatus>(item.status);
  return <article className="rounded-2xl border border-border bg-card p-5"><div className="flex flex-col justify-between gap-4 sm:flex-row"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusTone(item.status)}`}>{item.status}</span><span className="text-xs text-muted-foreground">{new Date(item.submittedAt).toLocaleDateString()}</span></div><h3 className="mt-2 font-display text-lg font-bold">{item.applicantName}</h3><p className="text-xs text-muted-foreground"><a className="text-primary underline" href={`mailto:${item.applicantEmail}`}>{item.applicantEmail}</a>{item.applicantLocation && ` · ${item.applicantLocation}`}</p><p className="mt-3 text-sm font-semibold">{item.formTitle}</p></div><label className="block text-xs font-semibold">Status<select value={status} disabled={pending} onChange={(event) => { const next = event.target.value as ApplicationStatus; setStatus(next); onSave(next, note); }} className="mt-1 h-10 rounded-lg border border-border bg-[#fbf9f2] px-3 text-sm">{statusList.map((value) => <option key={value}>{value}</option>)}</select></label></div>
    <details className="mt-4 rounded-xl bg-[#f8f8f1] p-4"><summary className="cursor-pointer text-sm font-semibold">View submitted answers ({item.answers.length})</summary><div className="mt-3 space-y-3">{item.answers.map((answer, index) => <div key={`${index}-${answer.prompt}`}><p className="text-xs font-bold text-[#426154]">{answer.prompt}</p><p className="mt-1 whitespace-pre-wrap text-sm">{Array.isArray(answer.value) ? answer.value.join(", ") : String(answer.value)}</p></div>)}</div></details>
    <div className="mt-4 flex flex-col gap-2 sm:flex-row"><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Internal note about this submission" className="h-10 flex-1 rounded-lg border border-border bg-[#fbf9f2] px-3 text-sm" /><button disabled={pending} onClick={() => onSave(status, note)} className="rounded-xl border border-border px-3 py-2 text-sm font-semibold disabled:opacity-60">Save status and note</button></div>
  </article>;
}

export default function AdminApplicationFormsPage() {
  const [tab, setTab] = useState<"forms" | "submissions">("forms");
  const [editing, setEditing] = useState<ApplicationForm | null | false>(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [formId, setFormId] = useState("");
  const params = { search: search || undefined, status: status ? status as ApplicationStatus : undefined, formId: formId ? Number(formId) : undefined };
  const forms = useListAdminApplicationForms({ query: { queryKey: getListAdminApplicationFormsQueryKey() } });
  const programs = useListAdminPrograms({ query: { queryKey: getListAdminProgramsQueryKey() } });
  const submissions = useListAdminApplicationSubmissions(params, { query: { queryKey: getListAdminApplicationSubmissionsQueryKey(params), enabled: tab === "submissions" } });
  const create = useCreateApplicationForm();
  const edit = useUpdateApplicationForm();
  const statusUpdate = useUpdateApplicationSubmission();
  const queryClient = useQueryClient();
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getListAdminApplicationFormsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getListAdminApplicationSubmissionsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getListApplicationFormsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getListMyApplicationSubmissionsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetAdminDashboardQueryKey() }),
    ]);
  };
  const save = (data: FormDraft) => {
    const done = async () => { await refresh(); setEditing(false); };
    if (editing) edit.mutate({ id: editing.id, data }, { onSuccess: done });
    else create.mutate({ data }, { onSuccess: done });
  };
  return <div className="page-enter">
    <Head title="Applications" description="Build custom application forms, publish or unpublish them, and review submitted answers." action={<button onClick={() => { setTab("forms"); setEditing(null); }} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"><Plus size={15} />New application</button>} />
    <div className="mb-5 flex gap-2 border-b border-border"><button onClick={() => setTab("forms")} className={`border-b-2 px-3 py-3 text-sm font-bold ${tab === "forms" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>Forms ({forms.data?.length ?? 0})</button><button onClick={() => setTab("submissions")} className={`border-b-2 px-3 py-3 text-sm font-bold ${tab === "submissions" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>Submissions</button></div>
    {tab === "forms" ? forms.isLoading ? <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">Loading forms…</div> : forms.isError ? <div role="alert" className="rounded-xl border border-[#e7c9be] bg-[#fff8f1] p-4 text-sm">Forms could not be loaded. Refresh the page to try again.</div> : <FormList forms={forms.data ?? []} programs={(programs.data ?? []) as Program[]} onEdit={setEditing} onRefresh={() => void refresh()} />
      : <><div className="mb-4 flex flex-col gap-3 sm:flex-row"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search applicant or form…" className="h-11 flex-1 rounded-xl border border-border bg-card px-3 text-sm" /><select value={status} onChange={(event) => setStatus(event.target.value)} className="h-11 rounded-xl border border-border bg-card px-3 text-sm"><option value="">Every status</option>{statusList.map((value) => <option key={value}>{value}</option>)}</select><select value={formId} onChange={(event) => setFormId(event.target.value)} className="h-11 rounded-xl border border-border bg-card px-3 text-sm"><option value="">Every form</option>{(forms.data ?? []).map((form) => <option key={form.id} value={form.id}>{form.title}</option>)}</select></div>
        {submissions.isLoading ? <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">Loading submissions…</div> : submissions.isError ? <div role="alert" className="rounded-xl border border-[#e7c9be] bg-[#fff8f1] p-4 text-sm">Submissions could not be loaded. Refresh the page to try again.</div> : !submissions.data?.length ? <Empty title="No submissions match" text="Submitted application forms will appear here for review." /> : <div className="space-y-3">{submissions.data.map((item) => <SubmissionCard key={item.id} item={item} pending={statusUpdate.isPending} onSave={(nextStatus, note) => statusUpdate.mutate({ id: item.id, data: { status: nextStatus, adminNote: note || null } }, { onSuccess: () => void refresh() })} />)}</div>}</>}
    {editing !== false && <FormEditor key={editing?.id ?? "new"} form={editing || null} programs={(programs.data ?? []) as Program[]} pending={create.isPending || edit.isPending} error={create.isError || edit.isError} onClose={() => setEditing(false)} onSave={save} />}
    {tab === "forms" && <p className="mt-6 text-xs leading-5 text-muted-foreground">Deleting a form does not remove submitted applications. Their answers and review status stay available under Submissions.</p>}
    <div className="mt-8 border-t border-border pt-5"><Link href="/admin/program-applications" className="inline-flex items-center gap-2 text-sm font-semibold text-primary">Review legacy program applications <ArrowRight size={14} /></Link></div>
  </div>;
}
