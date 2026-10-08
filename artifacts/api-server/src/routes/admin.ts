import { Router, type IRouter } from "express";
import {
  and,
  desc,
  eq,
  gte,
} from "drizzle-orm";
import {
  CreateEventBody,
  CreateEventResponse,
  CreateOpportunityBody,
  CreateOpportunityResponse,
  CreateProgramBody,
  CreateProgramResponse,
  DeleteEventParams,
  DeleteOpportunityParams,
  DeleteProgramParams,
  GetAdminDashboardResponse,
  GetAdminSettingsResponse,
  GetUserParams,
  GetUserResponse,
  ListAdminApplicationsQueryParams,
  ListAdminApplicationsResponse,
  ListAdminEventsResponse,
  ListAdminOpportunitiesResponse,
  ListAdminProgramsResponse,
  ListContactMessagesResponse,
  ListEventRegistrationsQueryParams,
  ListEventRegistrationsResponse,
  ListUsersQueryParams,
  ListUsersResponse,
  PublishNotificationBody,
  PublishNotificationResponse,
  UpdateAdminSettingsBody,
  UpdateAdminSettingsResponse,
  UpdateApplicationBody,
  UpdateApplicationParams,
  UpdateApplicationResponse,
  UpdateContactMessageBody,
  UpdateContactMessageParams,
  UpdateContactMessageResponse,
  UpdateEventBody,
  UpdateEventParams,
  UpdateEventResponse,
  UpdateOpportunityBody,
  UpdateOpportunityParams,
  UpdateOpportunityResponse,
  UpdateProgramBody,
  UpdateProgramParams,
  UpdateProgramResponse,
  UpdateUserStatusBody,
  UpdateUserStatusParams,
  UpdateUserStatusResponse,
} from "@workspace/api-zod";
import {
  applicationsTable,
  contactMessagesTable,
  db,
  eventRegistrationsTable,
  eventsTable,
  applicationFormsTable,
  applicationSubmissionsTable,
  notificationsTable,
  opportunitiesTable,
  organizationSettingsTable,
  programsTable,
  usersTable,
} from "@workspace/db";
import { dateOnly, notifyActiveYouth, organizationDefaults, profileResponse } from "../lib/b4p-data";
import { requireB4pAdmin } from "../lib/b4p-auth";
import { parseApiResponse } from "../lib/api-response";

const router: IRouter = Router();
router.use(requireB4pAdmin);

function applicationView(
  app: typeof applicationsTable.$inferSelect,
  programName: string,
  applicant: { id: number; fullName: string; email: string; country: string; county: string; city: string },
) {
  return {
    id: app.id,
    programId: app.programId,
    programName,
    status: app.status,
    motivation: app.motivation,
    adminNote: app.adminNote,
    submittedAt: app.submittedAt.toISOString(),
    userId: applicant.id,
    applicantName: applicant.fullName,
    applicantEmail: applicant.email,
    applicantLocation: [applicant.city, applicant.county, applicant.country].filter(Boolean).join(", "),
  };
}

function eventRegistrationView(
  registration: typeof eventRegistrationsTable.$inferSelect,
  event: typeof eventsTable.$inferSelect,
  user: { id: number; fullName: string; email: string; phone: string },
) {
  return {
    id: registration.id,
    eventId: event.id,
    eventTitle: event.title,
    eventDate: event.date,
    registeredAt: registration.registeredAt.toISOString(),
    userId: user.id,
    attendeeName: user.fullName,
    attendeeEmail: user.email,
    attendeePhone: user.phone,
  };
}

async function adminUserView(user: typeof usersTable.$inferSelect) {
  const [programApplications, formApplications, registrations] = await Promise.all([
    db.select({ id: applicationsTable.id }).from(applicationsTable).where(eq(applicationsTable.userId, user.id)),
    db.select({ id: applicationSubmissionsTable.id }).from(applicationSubmissionsTable).where(eq(applicationSubmissionsTable.userId, user.id)),
    db.select({ id: eventRegistrationsTable.id }).from(eventRegistrationsTable).where(eq(eventRegistrationsTable.userId, user.id)),
  ]);
  return {
    ...profileResponse(user),
    applicationCount: programApplications.length + formApplications.length,
    eventRegistrationCount: registrations.length,
  };
}

async function settingView() {
  const [row] = await db.select().from(organizationSettingsTable).limit(1);
  return row ? {
    name: row.name,
    description: row.description,
    mission: row.mission,
    vision: row.vision,
    focusAreas: row.focusAreas,
    empowermentInfo: row.empowermentInfo,
    contactEmail: row.contactEmail,
    phone: row.phone,
    address: row.address,
    socialLinks: row.socialLinks,
  } : organizationDefaults;
}

async function saveNotificationToAllUsers(type: string, title: string, body: string) {
  return notifyActiveYouth(type, title, body);
}

router.get("/admin/dashboard", async (_req, res): Promise<void> => {
  const today = new Date().toISOString().slice(0, 10);
  const [users, opportunities, programs, upcomingEvents, applications, formApplications, publishedForms, messages, recentRows, recentSubmissionRows] = await Promise.all([
    db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.active, true)),
    db.select({ id: opportunitiesTable.id }).from(opportunitiesTable).where(eq(opportunitiesTable.published, true)),
    db.select({ id: programsTable.id }).from(programsTable).where(eq(programsTable.published, true)),
    db.select({ id: eventsTable.id }).from(eventsTable).where(and(
      eq(eventsTable.published, true),
      gte(eventsTable.date, today),
    )),
    db.select({ status: applicationsTable.status }).from(applicationsTable),
    db.select({ status: applicationSubmissionsTable.status }).from(applicationSubmissionsTable),
    db.select({ id: applicationFormsTable.id }).from(applicationFormsTable).where(eq(applicationFormsTable.published, true)),
    db.select({ id: contactMessagesTable.id }).from(contactMessagesTable).where(eq(contactMessagesTable.status, "new")),
    db.select({ application: applicationsTable, programName: programsTable.name, user: usersTable })
      .from(applicationsTable)
      .innerJoin(programsTable, eq(applicationsTable.programId, programsTable.id))
      .innerJoin(usersTable, eq(applicationsTable.userId, usersTable.id))
      .orderBy(desc(applicationsTable.submittedAt)).limit(6),
    db.select({ submission: applicationSubmissionsTable, user: usersTable })
      .from(applicationSubmissionsTable)
      .innerJoin(usersTable, eq(applicationSubmissionsTable.userId, usersTable.id))
      .orderBy(desc(applicationSubmissionsTable.submittedAt)).limit(6),
  ]);
  const result = {
    users: users.length,
    publishedApplications: publishedForms.length,
    publishedOpportunities: opportunities.length,
    publishedPrograms: programs.length,
    upcomingEvents: upcomingEvents.length,
    pendingApplications: [...applications, ...formApplications]
      .filter((item) => item.status === "Submitted" || item.status === "Under Review").length,
    newMessages: messages.length,
    recentApplications: recentRows.map((row) => applicationView(row.application, row.programName, row.user)),
    recentSubmissions: recentSubmissionRows.map(({ submission, user }) => ({
      id: submission.id,
      formId: submission.formId,
      formTitle: submission.formTitle,
      status: submission.status,
      adminNote: submission.adminNote,
      submittedAt: submission.submittedAt.toISOString(),
      userId: user.id,
      applicantName: user.fullName,
      applicantEmail: user.email,
      applicantLocation: [user.city, user.county, user.country].filter(Boolean).join(", "),
      answers: submission.answers,
    })),
  };
  res.json(parseApiResponse(GetAdminDashboardResponse, result));
});

router.get("/admin/users", async (req, res): Promise<void> => {
  const query = ListUsersQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const rows = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
  const term = query.data.search?.trim().toLowerCase();
  const users = term ? rows.filter((user) =>
    [user.fullName, user.email, user.country, user.county, user.city]
      .some((value) => value.toLowerCase().includes(term)),
  ) : rows;
  const result = await Promise.all(users.map(adminUserView));
  res.json(parseApiResponse(ListUsersResponse, result));
});

router.get("/admin/users/:id", async (req, res): Promise<void> => {
  const params = GetUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, params.data.id)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(parseApiResponse(GetUserResponse, await adminUserView(user)));
});

router.patch("/admin/users/:id", async (req, res): Promise<void> => {
  const params = UpdateUserStatusParams.safeParse(req.params);
  const body = UpdateUserStatusBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.success ? body.error?.message ?? "Invalid input" : params.error?.message ?? "Invalid input" });
    return;
  }
  const [user] = await db.update(usersTable).set({ active: body.data.active })
    .where(eq(usersTable.id, params.data.id)).returning();
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(parseApiResponse(UpdateUserStatusResponse, await adminUserView(user)));
});

router.get("/admin/opportunities", async (_req, res): Promise<void> => {
  const rows = await db.select().from(opportunitiesTable).orderBy(desc(opportunitiesTable.datePosted));
  res.json(parseApiResponse(ListAdminOpportunitiesResponse, rows.map((row) => ({
    ...row,
    datePosted: row.datePosted.toISOString(),
  }))));
});

router.post("/admin/opportunities", async (req, res): Promise<void> => {
  const body = CreateOpportunityBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [row] = await db.insert(opportunitiesTable).values({
    ...body.data,
    deadline: dateOnly(body.data.deadline),
  }).returning();
  if (row.published) {
    await saveNotificationToAllUsers("opportunity", "New opportunity", `${row.title} is now available.`);
  }
  res.status(201).json(parseApiResponse(CreateOpportunityResponse, { ...row, datePosted: row.datePosted.toISOString() }));
});

router.patch("/admin/opportunities/:id", async (req, res): Promise<void> => {
  const params = UpdateOpportunityParams.safeParse(req.params);
  const body = UpdateOpportunityBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.success ? body.error?.message ?? "Invalid input" : params.error?.message ?? "Invalid input" });
    return;
  }
  const [previous] = await db.select().from(opportunitiesTable).where(eq(opportunitiesTable.id, params.data.id)).limit(1);
  if (!previous) {
    res.status(404).json({ error: "Opportunity not found" });
    return;
  }
  const { deadline, ...fields } = body.data;
  const [row] = await db.update(opportunitiesTable).set({
    ...fields,
    ...(deadline !== undefined ? { deadline: dateOnly(deadline) } : {}),
  })
    .where(eq(opportunitiesTable.id, params.data.id)).returning();
  if (!previous.published && row.published) {
    await saveNotificationToAllUsers("opportunity", "New opportunity", `${row.title} is now available.`);
  }
  res.json(parseApiResponse(UpdateOpportunityResponse, { ...row, datePosted: row.datePosted.toISOString() }));
});

router.delete("/admin/opportunities/:id", async (req, res): Promise<void> => {
  const params = DeleteOpportunityParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.delete(opportunitiesTable).where(eq(opportunitiesTable.id, params.data.id)).returning();
  if (!row) {
    res.status(404).json({ error: "Opportunity not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/admin/programs", async (_req, res): Promise<void> => {
  const rows = await db.select().from(programsTable).orderBy(desc(programsTable.createdAt));
  res.json(parseApiResponse(ListAdminProgramsResponse, rows));
});

router.post("/admin/programs", async (req, res): Promise<void> => {
  const body = CreateProgramBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [row] = await db.insert(programsTable).values({
    ...body.data,
    startDate: dateOnly(body.data.startDate),
    endDate: dateOnly(body.data.endDate),
    applicationDeadline: dateOnly(body.data.applicationDeadline),
  }).returning();
  if (row.published) {
    await saveNotificationToAllUsers("program", "New B4P program", `${row.name} is now open.`);
  }
  res.status(201).json(parseApiResponse(CreateProgramResponse, row));
});

router.patch("/admin/programs/:id", async (req, res): Promise<void> => {
  const params = UpdateProgramParams.safeParse(req.params);
  const body = UpdateProgramBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.success ? body.error?.message ?? "Invalid input" : params.error?.message ?? "Invalid input" });
    return;
  }
  const [previous] = await db.select().from(programsTable).where(eq(programsTable.id, params.data.id)).limit(1);
  if (!previous) {
    res.status(404).json({ error: "Program not found" });
    return;
  }
  const { startDate, endDate, applicationDeadline, ...fields } = body.data;
  const [row] = await db.update(programsTable).set({
    ...fields,
    ...(startDate !== undefined ? { startDate: dateOnly(startDate) } : {}),
    ...(endDate !== undefined ? { endDate: dateOnly(endDate) } : {}),
    ...(applicationDeadline !== undefined
      ? { applicationDeadline: dateOnly(applicationDeadline) }
      : {}),
  })
    .where(eq(programsTable.id, params.data.id)).returning();
  if (!previous.published && row.published) {
    await saveNotificationToAllUsers("program", "New B4P program", `${row.name} is now open.`);
  }
  res.json(parseApiResponse(UpdateProgramResponse, row));
});

router.delete("/admin/programs/:id", async (req, res): Promise<void> => {
  const params = DeleteProgramParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.delete(programsTable).where(eq(programsTable.id, params.data.id)).returning();
  if (!row) {
    res.status(404).json({ error: "Program not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/admin/applications", async (req, res): Promise<void> => {
  const query = ListAdminApplicationsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const rows = await db.select({ application: applicationsTable, programName: programsTable.name, user: usersTable })
    .from(applicationsTable)
    .innerJoin(programsTable, eq(applicationsTable.programId, programsTable.id))
    .innerJoin(usersTable, eq(applicationsTable.userId, usersTable.id))
    .orderBy(desc(applicationsTable.submittedAt));
  const term = query.data.search?.trim().toLowerCase();
  const matches = rows.filter((row) =>
    (!query.data.status || row.application.status === query.data.status) &&
    (!term || [row.user.fullName, row.user.email, row.programName]
      .some((value) => value.toLowerCase().includes(term))),
  );
  res.json(parseApiResponse(ListAdminApplicationsResponse, matches.map((row) =>
    applicationView(row.application, row.programName, row.user),
  )));
});

router.patch("/admin/applications/:id", async (req, res): Promise<void> => {
  const params = UpdateApplicationParams.safeParse(req.params);
  const body = UpdateApplicationBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.success ? body.error?.message ?? "Invalid input" : params.error?.message ?? "Invalid input" });
    return;
  }
  const [row] = await db.update(applicationsTable).set(body.data)
    .where(eq(applicationsTable.id, params.data.id)).returning();
  if (!row) {
    res.status(404).json({ error: "Application not found" });
    return;
  }
  const [[program], [user]] = await Promise.all([
    db.select().from(programsTable).where(eq(programsTable.id, row.programId)).limit(1),
    db.select().from(usersTable).where(eq(usersTable.id, row.userId)).limit(1),
  ]);
  if (!program || !user) {
    res.status(404).json({ error: "Application record is incomplete" });
    return;
  }
  await db.insert(notificationsTable).values({
    userId: user.id,
    type: "application",
    title: "Application status updated",
    body: `Your application for ${program.name} is now ${row.status}.`,
  });
  res.json(parseApiResponse(UpdateApplicationResponse, applicationView(row, program.name, user)));
});

router.get("/admin/events", async (_req, res): Promise<void> => {
  const rows = await db.select().from(eventsTable).orderBy(eventsTable.date);
  res.json(parseApiResponse(ListAdminEventsResponse, rows));
});

router.post("/admin/events", async (req, res): Promise<void> => {
  const body = CreateEventBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [row] = await db.insert(eventsTable).values({
    ...body.data,
    date: dateOnly(body.data.date)!,
    registrationDeadline: dateOnly(body.data.registrationDeadline),
  }).returning();
  if (row.published) {
    await saveNotificationToAllUsers("event", "Upcoming B4P event", `${row.title} is coming up on ${row.date}.`);
  }
  res.status(201).json(parseApiResponse(CreateEventResponse, row));
});

router.patch("/admin/events/:id", async (req, res): Promise<void> => {
  const params = UpdateEventParams.safeParse(req.params);
  const body = UpdateEventBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.success ? body.error?.message ?? "Invalid input" : params.error?.message ?? "Invalid input" });
    return;
  }
  const [previous] = await db.select().from(eventsTable).where(eq(eventsTable.id, params.data.id)).limit(1);
  if (!previous) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  const { date, registrationDeadline, ...fields } = body.data;
  const [row] = await db.update(eventsTable).set({
    ...fields,
    ...(date !== undefined ? { date: dateOnly(date)! } : {}),
    ...(registrationDeadline !== undefined ? { registrationDeadline: dateOnly(registrationDeadline) } : {}),
  })
    .where(eq(eventsTable.id, params.data.id)).returning();
  if (!previous.published && row.published) {
    await saveNotificationToAllUsers("event", "Upcoming B4P event", `${row.title} is coming up on ${row.date}.`);
  }
  res.json(parseApiResponse(UpdateEventResponse, row));
});

router.delete("/admin/events/:id", async (req, res): Promise<void> => {
  const params = DeleteEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.delete(eventsTable).where(eq(eventsTable.id, params.data.id)).returning();
  if (!row) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/admin/event-registrations", async (req, res): Promise<void> => {
  const query = ListEventRegistrationsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const rows = await db.select({ registration: eventRegistrationsTable, event: eventsTable, user: usersTable })
    .from(eventRegistrationsTable)
    .innerJoin(eventsTable, eq(eventRegistrationsTable.eventId, eventsTable.id))
    .innerJoin(usersTable, eq(eventRegistrationsTable.userId, usersTable.id))
    .orderBy(desc(eventRegistrationsTable.registeredAt));
  const term = query.data.search?.trim().toLowerCase();
  const matches = rows.filter((row) =>
    (query.data.eventId === undefined || row.event.id === query.data.eventId) &&
    (!term || [row.user.fullName, row.user.email, row.event.title]
      .some((value) => value.toLowerCase().includes(term))),
  );
  res.json(parseApiResponse(ListEventRegistrationsResponse, matches.map((row) =>
    eventRegistrationView(row.registration, row.event, row.user),
  )));
});

router.post("/admin/notifications", async (req, res): Promise<void> => {
  const body = PublishNotificationBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const recipients = await saveNotificationToAllUsers("announcement", body.data.title, body.data.body);
  res.status(201).json(parseApiResponse(PublishNotificationResponse, { recipients }));
});

router.get("/admin/contact-messages", async (_req, res): Promise<void> => {
  const rows = await db.select().from(contactMessagesTable).orderBy(desc(contactMessagesTable.createdAt));
  res.json(parseApiResponse(ListContactMessagesResponse, rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
  }))));
});

router.patch("/admin/contact-messages/:id", async (req, res): Promise<void> => {
  const params = UpdateContactMessageParams.safeParse(req.params);
  const body = UpdateContactMessageBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.success ? body.error?.message ?? "Invalid input" : params.error?.message ?? "Invalid input" });
    return;
  }
  const [row] = await db.update(contactMessagesTable).set({ status: body.data.status })
    .where(eq(contactMessagesTable.id, params.data.id)).returning();
  if (!row) {
    res.status(404).json({ error: "Contact message not found" });
    return;
  }
  res.json(parseApiResponse(UpdateContactMessageResponse, {
    ...row,
    createdAt: row.createdAt.toISOString(),
  }));
});

router.get("/admin/settings", async (_req, res): Promise<void> => {
  res.json(parseApiResponse(GetAdminSettingsResponse, await settingView()));
});

router.patch("/admin/settings", async (req, res): Promise<void> => {
  const body = UpdateAdminSettingsBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [existing] = await db.select({ id: organizationSettingsTable.id }).from(organizationSettingsTable).limit(1);
  if (existing) {
    await db.update(organizationSettingsTable).set(body.data)
      .where(eq(organizationSettingsTable.id, existing.id));
  } else {
    await db.insert(organizationSettingsTable).values(body.data);
  }
  res.json(parseApiResponse(UpdateAdminSettingsResponse, await settingView()));
});

export default router;
