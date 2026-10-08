import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  CreateApplicationFormBody,
  CreateApplicationFormResponse,
  DeleteApplicationFormParams,
  GetApplicationFormParams,
  GetApplicationFormResponse,
  ListAdminApplicationFormsResponse,
  ListAdminApplicationSubmissionsQueryParams,
  ListAdminApplicationSubmissionsResponse,
  ListApplicationFormsQueryParams,
  ListApplicationFormsResponse,
  ListMyApplicationSubmissionsResponse,
  SubmitApplicationFormBody,
  SubmitApplicationFormParams,
  SubmitApplicationFormResponse,
  UpdateApplicationFormBody,
  UpdateApplicationFormParams,
  UpdateApplicationFormResponse,
  UpdateApplicationSubmissionBody,
  UpdateApplicationSubmissionParams,
  UpdateApplicationSubmissionResponse,
} from "@workspace/api-zod";
import {
  applicationFormsTable,
  applicationQuestionsTable,
  applicationSubmissionsTable,
  db,
  notificationsTable,
  programsTable,
  usersTable,
  type ApplicationAnswer,
  type ApplicationQuestionType,
} from "@workspace/db";
import { dateOnly, findYouth, notifyActiveYouth } from "../lib/b4p-data";
import { requireB4pAdmin, requireYouthProfile } from "../lib/b4p-auth";
import { parseApiResponse } from "../lib/api-response";

const router: IRouter = Router();
const choiceTypes = new Set<ApplicationQuestionType>(["dropdown", "multiple_choice", "checkbox"]);
const isUniqueViolation = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error && error.code === "23505";

function validateQuestions(questions: Array<{
  prompt: string;
  type: ApplicationQuestionType;
  options: string[];
}>): string | null {
  for (const question of questions) {
    if (choiceTypes.has(question.type) && question.options.filter((value) => value.trim()).length < 2) {
      return `Add at least two options for “${question.prompt}”.`;
    }
  }
  return null;
}

function applicationFormView(
  form: typeof applicationFormsTable.$inferSelect,
  questions: typeof applicationQuestionsTable.$inferSelect[],
) {
  return {
    ...form,
    createdAt: form.createdAt.toISOString(),
    updatedAt: form.updatedAt.toISOString(),
    questions: questions.map((question) => ({ ...question })),
  };
}

async function getQuestions(formId: number) {
  return db.select().from(applicationQuestionsTable)
    .where(eq(applicationQuestionsTable.formId, formId))
    .orderBy(applicationQuestionsTable.position, applicationQuestionsTable.id);
}

async function getFormView(form: typeof applicationFormsTable.$inferSelect) {
  return applicationFormView(form, await getQuestions(form.id));
}

function mySubmissionView(submission: typeof applicationSubmissionsTable.$inferSelect) {
  return {
    id: submission.id,
    formId: submission.formId,
    formTitle: submission.formTitle,
    status: submission.status,
    adminNote: submission.adminNote,
    submittedAt: submission.submittedAt.toISOString(),
  };
}

function adminSubmissionView(
  submission: typeof applicationSubmissionsTable.$inferSelect,
  user: typeof usersTable.$inferSelect,
) {
  return {
    ...mySubmissionView(submission),
    userId: user.id,
    applicantName: user.fullName,
    applicantEmail: user.email,
    applicantLocation: [user.city, user.county, user.country].filter(Boolean).join(", "),
    answers: submission.answers,
  };
}

router.get("/applications", requireYouthProfile, async (req, res): Promise<void> => {
  const query = ListApplicationFormsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const filters = [eq(applicationFormsTable.published, true)];
  if (query.data.programId !== undefined) {
    filters.push(eq(applicationFormsTable.programId, query.data.programId));
  }
  const forms = await db.select().from(applicationFormsTable)
    .where(and(...filters))
    .orderBy(desc(applicationFormsTable.createdAt));
  const result = await Promise.all(forms.map(getFormView));
  res.json(parseApiResponse(ListApplicationFormsResponse, result));
});

router.get("/applications/:id", requireYouthProfile, async (req, res): Promise<void> => {
  const params = GetApplicationFormParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [form] = await db.select().from(applicationFormsTable).where(and(
    eq(applicationFormsTable.id, params.data.id),
    eq(applicationFormsTable.published, true),
  )).limit(1);
  if (!form) {
    res.status(404).json({ error: "Application form not found" });
    return;
  }
  res.json(parseApiResponse(GetApplicationFormResponse, await getFormView(form)));
});

router.get("/me/application-submissions", requireYouthProfile, async (req, res): Promise<void> => {
  const user = await findYouth(req);
  if (!user) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  const rows = await db.select().from(applicationSubmissionsTable)
    .where(eq(applicationSubmissionsTable.userId, user.id))
    .orderBy(desc(applicationSubmissionsTable.submittedAt));
  res.json(parseApiResponse(ListMyApplicationSubmissionsResponse, rows.map(mySubmissionView)));
});

router.post("/applications/:id/submissions", requireYouthProfile, async (req, res): Promise<void> => {
  const params = SubmitApplicationFormParams.safeParse(req.params);
  const body = SubmitApplicationFormBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.success ? body.error?.message ?? "Invalid input" : params.error?.message ?? "Invalid input" });
    return;
  }
  const user = await findYouth(req);
  const [form] = await db.select().from(applicationFormsTable).where(and(
    eq(applicationFormsTable.id, params.data.id),
    eq(applicationFormsTable.published, true),
  )).limit(1);
  if (!user || !form) {
    res.status(404).json({ error: "Application form not found" });
    return;
  }
  if (form.deadline && form.deadline < new Date().toISOString().slice(0, 10)) {
    res.status(410).json({ error: "This application deadline has passed" });
    return;
  }
  const questions = await getQuestions(form.id);
  if (questions.length === 0) {
    res.status(409).json({ error: "This application form is not ready for submissions" });
    return;
  }
  const allowedIds = new Set(questions.map((question) => String(question.id)));
  if (Object.keys(body.data.answers).some((key) => !allowedIds.has(key))) {
    res.status(400).json({ error: "The submission contains an unknown question" });
    return;
  }
  const answers: ApplicationAnswer[] = [];
  for (const question of questions) {
    const raw = body.data.answers[String(question.id)];
    const missing = raw === undefined || raw === null || raw === "" ||
      (Array.isArray(raw) && raw.length === 0);
    if (missing) {
      if (question.required) {
        res.status(400).json({ error: `“${question.prompt}” is required` });
        return;
      }
      continue;
    }
    if (question.type === "checkbox") {
      if (!Array.isArray(raw) || !raw.every((value) => typeof value === "string" && question.options.includes(value))) {
        res.status(400).json({ error: `Choose valid options for “${question.prompt}”` });
        return;
      }
      answers.push({ prompt: question.prompt, type: question.type, value: [...new Set(raw as string[])] });
      continue;
    }
    if (question.type === "dropdown" || question.type === "multiple_choice") {
      if (typeof raw !== "string" || !question.options.includes(raw)) {
        res.status(400).json({ error: `Choose a valid option for “${question.prompt}”` });
        return;
      }
      answers.push({ prompt: question.prompt, type: question.type, value: raw });
      continue;
    }
    if (typeof raw !== "string") {
      res.status(400).json({ error: `Enter a valid answer for “${question.prompt}”` });
      return;
    }
    const value = raw.trim();
    if (value.length > (question.type === "short_text" ? 500 : 5000)) {
      res.status(400).json({ error: `The answer for “${question.prompt}” is too long` });
      return;
    }
    if (question.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      res.status(400).json({ error: `Enter a valid email address for “${question.prompt}”` });
      return;
    }
    if (question.type === "date" && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`)))) {
      res.status(400).json({ error: `Enter a valid date for “${question.prompt}”` });
      return;
    }
    answers.push({ prompt: question.prompt, type: question.type, value });
  }
  try {
    const [submission] = await db.insert(applicationSubmissionsTable).values({
      formId: form.id,
      formTitle: form.title,
      userId: user.id,
      answers,
    }).returning();
    const response = mySubmissionView(submission);
    res.status(201).json(parseApiResponse(SubmitApplicationFormResponse, response));
  } catch (error) {
    if (isUniqueViolation(error)) {
      res.status(409).json({ error: "You have already submitted this application" });
      return;
    }
    throw error;
  }
});

router.get("/admin/application-forms", requireB4pAdmin, async (_req, res): Promise<void> => {
  const forms = await db.select().from(applicationFormsTable).orderBy(desc(applicationFormsTable.updatedAt));
  const result = await Promise.all(forms.map(getFormView));
  res.json(parseApiResponse(ListAdminApplicationFormsResponse, result));
});

router.post("/admin/application-forms", requireB4pAdmin, async (req, res): Promise<void> => {
  const body = CreateApplicationFormBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const questionError = validateQuestions(body.data.questions);
  if (questionError) {
    res.status(400).json({ error: questionError });
    return;
  }
  if (body.data.published && body.data.questions.length === 0) {
    res.status(400).json({ error: "Add at least one question before publishing this application" });
    return;
  }
  if (body.data.programId !== null) {
    const [program] = await db.select({ id: programsTable.id }).from(programsTable)
      .where(eq(programsTable.id, body.data.programId)).limit(1);
    if (!program) {
      res.status(400).json({ error: "Choose an existing program" });
      return;
    }
  }
  const created = await db.transaction(async (tx) => {
    const [form] = await tx.insert(applicationFormsTable).values({
      title: body.data.title,
      description: body.data.description,
      instructions: body.data.instructions,
      eligibilityRequirements: body.data.eligibilityRequirements,
      deadline: dateOnly(body.data.deadline),
      programId: body.data.programId,
      published: body.data.published,
    }).returning();
    if (body.data.questions.length) {
      await tx.insert(applicationQuestionsTable).values(body.data.questions.map((question) => ({
        formId: form.id,
        prompt: question.prompt,
        type: question.type,
        required: question.required,
        options: question.options.map((option) => option.trim()).filter(Boolean),
        position: question.position,
      })));
    }
    return form;
  });
  if (created.published) {
    await notifyActiveYouth("application", "New B4P application", `${created.title} is now open.`);
  }
  const result = await getFormView(created);
  res.status(201).json(parseApiResponse(CreateApplicationFormResponse, result));
});

router.patch("/admin/application-forms/:id", requireB4pAdmin, async (req, res): Promise<void> => {
  const params = UpdateApplicationFormParams.safeParse(req.params);
  const body = UpdateApplicationFormBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.success ? body.error?.message ?? "Invalid input" : params.error?.message ?? "Invalid input" });
    return;
  }
  if (body.data.questions) {
    const questionError = validateQuestions(body.data.questions);
    if (questionError) {
      res.status(400).json({ error: questionError });
      return;
    }
  }
  const [previous] = await db.select().from(applicationFormsTable)
    .where(eq(applicationFormsTable.id, params.data.id)).limit(1);
  if (!previous) {
    res.status(404).json({ error: "Application form not found" });
    return;
  }
  if (body.data.programId !== undefined && body.data.programId !== null) {
    const [program] = await db.select({ id: programsTable.id }).from(programsTable)
      .where(eq(programsTable.id, body.data.programId)).limit(1);
    if (!program) {
      res.status(400).json({ error: "Choose an existing program" });
      return;
    }
  }
  const nextQuestions = body.data.questions ?? await getQuestions(previous.id);
  if (body.data.published === true && nextQuestions.length === 0) {
    res.status(400).json({ error: "Add at least one question before publishing this application" });
    return;
  }
  const { questions, deadline, ...fields } = body.data;
  const updated = await db.transaction(async (tx) => {
    const [form] = await tx.update(applicationFormsTable).set({
      ...fields,
      ...(deadline !== undefined ? { deadline: dateOnly(deadline) } : {}),
      updatedAt: new Date(),
    }).where(eq(applicationFormsTable.id, previous.id)).returning();
    if (questions !== undefined) {
      await tx.delete(applicationQuestionsTable).where(eq(applicationQuestionsTable.formId, previous.id));
      if (questions.length) {
        await tx.insert(applicationQuestionsTable).values(questions.map((question) => ({
          formId: previous.id,
          prompt: question.prompt,
          type: question.type,
          required: question.required,
          options: question.options.map((option) => option.trim()).filter(Boolean),
          position: question.position,
        })));
      }
    }
    return form;
  });
  if (!previous.published && updated.published) {
    await notifyActiveYouth("application", "New B4P application", `${updated.title} is now open.`);
  }
  res.json(parseApiResponse(UpdateApplicationFormResponse, await getFormView(updated)));
});

router.delete("/admin/application-forms/:id", requireB4pAdmin, async (req, res): Promise<void> => {
  const params = DeleteApplicationFormParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db.delete(applicationFormsTable)
    .where(eq(applicationFormsTable.id, params.data.id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Application form not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/admin/application-submissions", requireB4pAdmin, async (req, res): Promise<void> => {
  const query = ListAdminApplicationSubmissionsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const rows = await db.select({ submission: applicationSubmissionsTable, user: usersTable })
    .from(applicationSubmissionsTable)
    .innerJoin(usersTable, eq(applicationSubmissionsTable.userId, usersTable.id))
    .orderBy(desc(applicationSubmissionsTable.submittedAt));
  const term = query.data.search?.trim().toLowerCase();
  const filtered = rows.filter(({ submission, user }) =>
    (!query.data.status || submission.status === query.data.status) &&
    (query.data.formId === undefined || submission.formId === query.data.formId) &&
    (!term || [submission.formTitle, user.fullName, user.email].some((value) => value.toLowerCase().includes(term))),
  );
  res.json(parseApiResponse(ListAdminApplicationSubmissionsResponse,
    filtered.map(({ submission, user }) => adminSubmissionView(submission, user)),
  ));
});

router.patch("/admin/application-submissions/:id", requireB4pAdmin, async (req, res): Promise<void> => {
  const params = UpdateApplicationSubmissionParams.safeParse(req.params);
  const body = UpdateApplicationSubmissionBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.success ? body.error?.message ?? "Invalid input" : params.error?.message ?? "Invalid input" });
    return;
  }
  const [previous] = await db.select().from(applicationSubmissionsTable)
    .where(eq(applicationSubmissionsTable.id, params.data.id)).limit(1);
  if (!previous) {
    res.status(404).json({ error: "Submission not found" });
    return;
  }
  const [submission] = await db.update(applicationSubmissionsTable).set({
    ...body.data,
    updatedAt: new Date(),
  }).where(eq(applicationSubmissionsTable.id, previous.id)).returning();
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, submission.userId)).limit(1);
  if (!user) {
    res.status(404).json({ error: "Applicant not found" });
    return;
  }
  if (previous.status !== submission.status) {
    await db.insert(notificationsTable).values({
      userId: user.id,
      type: "application",
      title: "Application status updated",
      body: `Your application for ${submission.formTitle} is now ${submission.status}.`,
    });
  }
  res.json(parseApiResponse(UpdateApplicationSubmissionResponse, adminSubmissionView(submission, user)));
});

export default router;
