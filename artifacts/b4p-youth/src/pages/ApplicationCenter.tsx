import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, ArrowRight, CheckCircle2, FileText, Send } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetApplicationFormQueryKey,
  getGetDashboardQueryKey,
  getListApplicationFormsQueryKey,
  getListMyApplicationSubmissionsQueryKey,
  getListMyApplicationsQueryKey,
  useGetApplicationForm,
  useListApplicationForms,
  useListMyApplicationSubmissions,
  useListMyApplications,
  useSubmitApplicationForm,
} from "@workspace/api-client-react";
import type {
  ApplicationForm,
  ApplicationQuestion,
  ApplicationQuestionType,
  ApplicationStatus,
  MyApplicationSubmission,
  ProgramApplication,
} from "@workspace/api-client-react";

const dateLabel = (value?: string | null) =>
  value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" }) : "No deadline";
const statusTone = (status: ApplicationStatus) =>
  status === "Accepted" ? "bg-[#e3eee6] text-[#245c4c]" :
    status === "Rejected" ? "bg-[#f7e6df] text-[#954b3d]" :
      status === "Submitted" ? "bg-[#fbefd7] text-[#805b21]" : "bg-[#ecece4] text-[#626c64]";

function Heading({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="mb-2 text-[11px] font-bold uppercase tracking-[.18em] text-[#a6604c]">Your next steps</p><h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-[2.6rem]">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p></div>{action}</div>;
}

function Empty({ title, children }: { title: string; children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-[#c9d5ca] bg-[#f2f5ef] px-6 py-10 text-center"><h2 className="font-display text-xl font-bold">{title}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{children}</p></div>;
}

function QuestionField({
  question, value, onChange,
}: {
  question: ApplicationQuestion;
  value: string | string[] | boolean | undefined;
  onChange: (value: string | string[] | boolean) => void;
}) {
  const common = "mt-1.5 w-full rounded-xl border border-border bg-[#fbf9f2] px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10";
  const isChoice = ["dropdown", "multiple_choice", "checkbox"].includes(question.type);
  return <fieldset className="rounded-xl border border-border bg-card p-4">
    <legend className="px-1 text-sm font-semibold">{question.prompt}{question.required && <span className="ml-1 text-[#a6604c]" aria-label="required">*</span>}</legend>
    {question.type === "long_text"
      ? <textarea required={question.required} maxLength={5000} value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} className={`${common} min-h-28`} />
      : question.type === "dropdown"
        ? <select required={question.required} value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} className={common}><option value="">Choose an option</option>{question.options.map((option) => <option key={option} value={option}>{option}</option>)}</select>
        : question.type === "multiple_choice"
          ? <div className="mt-2 space-y-2">{question.options.map((option) => <label key={option} className="flex items-center gap-2 text-sm"><input type="radio" required={question.required} name={`question-${question.id}`} checked={value === option} onChange={() => onChange(option)} className="accent-[#1d6252]" />{option}</label>)}</div>
          : question.type === "checkbox"
            ? <div className="mt-2 space-y-2">{question.options.map((option) => {
              const values = Array.isArray(value) ? value : [];
              return <label key={option} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={values.includes(option)} onChange={(event) => onChange(event.target.checked ? [...values, option] : values.filter((entry) => entry !== option))} className="accent-[#1d6252]" />{option}</label>;
            })}</div>
            : <input required={question.required} type={question.type === "email" ? "email" : question.type === "phone" ? "tel" : question.type === "date" ? "date" : "text"} maxLength={question.type === "short_text" ? 500 : 5000} value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} className={common} />}
    {isChoice && question.type === "checkbox" && question.required && <span className="sr-only">Select at least one option</span>}
  </fieldset>;
}

function FormApplication({ form }: { form: ApplicationForm }) {
  const [location, setLocation] = useLocation();
  const [answers, setAnswers] = useState<Record<string, string | string[] | boolean>>({});
  const [receipt, setReceipt] = useState<MyApplicationSubmission | null>(null);
  const submit = useSubmitApplicationForm();
  const queryClient = useQueryClient();
  const save = (event: FormEvent) => {
    event.preventDefault();
    submit.mutate({ id: form.id, data: { answers } }, {
      onSuccess: async (submission) => {
        setReceipt(submission);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: getListMyApplicationSubmissionsQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getListApplicationFormsQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() }),
        ]);
      },
    });
  };
  if (receipt) return <div className="mx-auto max-w-3xl"><div className="rounded-[1.75rem] border border-[#c8d9cc] bg-[#f1f5ef] p-7 sm:p-10"><CheckCircle2 className="text-primary" size={34} /><p className="mt-5 text-[11px] font-bold uppercase tracking-[.17em] text-primary">Application submitted</p><h1 className="mt-2 font-display text-3xl font-extrabold">{receipt.formTitle}</h1><p className="mt-3 text-sm leading-6 text-[#536d60]">Your answers have been received. You can track the status in My applications.</p><div className="mt-6 flex flex-wrap gap-3"><button onClick={() => setLocation("/applications")} className="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground">See my applications</button><Link href="/dashboard" className="rounded-xl border border-border bg-card px-4 py-3 text-sm font-bold">Back to home</Link></div></div></div>;
  return <div className="mx-auto max-w-3xl">
    <button onClick={() => setLocation("/applications")} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary"><ArrowLeft size={15} />All applications</button>
    <div className="rounded-[1.75rem] border border-border bg-card p-5 sm:p-8">
      <div className="mb-6"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-[#e3eee6] px-2.5 py-1 text-[11px] font-bold text-[#245c4c]">B4P application</span>{form.deadline && <span className="text-xs text-muted-foreground">Deadline {dateLabel(form.deadline)}</span>}</div><h1 className="mt-3 font-display text-3xl font-extrabold">{form.title}</h1><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{form.description}</p></div>
      {form.eligibilityRequirements && <div className="mb-4 rounded-xl bg-[#f2f5ef] p-4"><h2 className="text-xs font-bold uppercase tracking-wider text-primary">Eligibility</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{form.eligibilityRequirements}</p></div>}
      {form.instructions && <div className="mb-6 rounded-xl bg-[#fbf1dd] p-4"><h2 className="text-xs font-bold uppercase tracking-wider text-[#805b21]">Instructions</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{form.instructions}</p></div>}
      <form onSubmit={save} className="space-y-4">
        {form.questions.map((question) => <QuestionField key={question.id} question={question} value={answers[String(question.id)]} onChange={(value) => setAnswers((previous) => ({ ...previous, [question.id]: value }))} />)}
        {submit.isError && <div role="alert" className="rounded-xl border border-[#e7c9be] bg-[#fff8f1] px-4 py-3 text-sm text-[#76534b]">We could not submit this application. Check your answers and try again.</div>}
        <button type="submit" disabled={submit.isPending} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60">{submit.isPending ? "Submitting…" : "Submit application"} <Send size={15} /></button>
      </form>
    </div>
  </div>;
}

export default function ApplicationCenter() {
  const [location] = useLocation();
  const formId = Number(location.match(/^\/applications\/(\d+)/)?.[1] ?? 0);
  const form = useGetApplicationForm(formId, { query: { enabled: formId > 0, queryKey: getGetApplicationFormQueryKey(formId) } });
  const forms = useListApplicationForms({ query: { enabled: !formId, queryKey: getListApplicationFormsQueryKey() } });
  const submissions = useListMyApplicationSubmissions({ query: { queryKey: getListMyApplicationSubmissionsQueryKey() } });
  const legacy = useListMyApplications({ query: { queryKey: getListMyApplicationsQueryKey() } });
  if (formId > 0) {
    if (form.isLoading) return <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">Loading application…</div>;
    if (form.isError || !form.data) return <div role="alert" className="rounded-xl border border-[#e7c9be] bg-[#fff8f1] p-5 text-sm">This application form is not available. <Link href="/applications" className="font-bold text-primary">Browse current applications</Link>.</div>;
    return <FormApplication form={form.data} />;
  }
  const busy = forms.isLoading || submissions.isLoading || legacy.isLoading;
  const failed = forms.isError || submissions.isError || legacy.isError;
  const allEmpty = !forms.data?.length && !submissions.data?.length && !legacy.data?.length;
  return <div className="page-enter">
    <Heading title="Applications" description="Browse open B4P applications and follow every submission from one place." action={<Link href="/opportunities" className="inline-flex items-center gap-2 text-sm font-bold text-primary">Explore opportunities <ArrowRight size={15} /></Link>} />
    {busy ? <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">Loading applications…</div>
      : failed ? <div role="alert" className="rounded-xl border border-[#e7c9be] bg-[#fff8f1] p-4 text-sm">Applications could not be loaded. Refresh the page to try again.</div>
        : allEmpty ? <Empty title="No applications are open yet">Published B4P application forms will appear here. Check back for new opportunities.</Empty>
          : <div className="space-y-9">
            {!!forms.data?.length && <section><h2 className="mb-3 font-display text-xl font-extrabold">Open applications</h2><div className="grid gap-3 md:grid-cols-2">{forms.data.map((item) => <article key={item.id} className="rounded-2xl border border-border bg-card p-5"><div className="flex items-center justify-between gap-2"><span className="rounded-full bg-[#e3eee6] px-2.5 py-1 text-[11px] font-bold text-[#245c4c]">Application form</span>{item.deadline && <span className="text-[11px] text-muted-foreground">Due {dateLabel(item.deadline)}</span>}</div><h3 className="mt-3 font-display text-lg font-bold">{item.title}</h3><p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{item.description}</p><Link href={`/applications/${item.id}`} className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-primary">Review and apply <ArrowRight size={14} /></Link></article>)}</div></section>}
            {!!submissions.data?.length && <section><h2 className="mb-3 font-display text-xl font-extrabold">Application form submissions</h2><div className="space-y-3">{submissions.data.map((item) => <article key={item.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f6edda] text-[#9d6a29]"><FileText size={19} /></span><div className="min-w-0 flex-1"><h3 className="font-semibold">{item.formTitle}</h3><p className="mt-1 text-xs text-muted-foreground">Submitted {dateLabel(item.submittedAt)}</p>{item.adminNote && <p className="mt-2 text-sm text-muted-foreground">{item.adminNote}</p>}</div><span className={`w-fit rounded-full px-2.5 py-1 text-xs font-bold ${statusTone(item.status)}`}>{item.status}</span></article>)}</div></section>}
            {!!legacy.data?.length && <section><h2 className="mb-3 font-display text-xl font-extrabold">Program applications</h2><div className="space-y-3">{legacy.data.map((item: ProgramApplication) => <article key={`program-${item.id}`} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><Link href={`/programs/${item.programId}`} className="font-semibold hover:text-primary">{item.programName}</Link><p className="mt-1 text-xs text-muted-foreground">Submitted {dateLabel(item.submittedAt)}</p>{item.adminNote && <p className="mt-2 text-sm text-muted-foreground">{item.adminNote}</p>}</div><span className={`w-fit rounded-full px-2.5 py-1 text-xs font-bold ${statusTone(item.status)}`}>{item.status}</span></article>)}</div></section>}
          </div>}
  </div>;
}
