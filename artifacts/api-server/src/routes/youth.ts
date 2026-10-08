import { Router, type IRouter } from "express";
import { requireSignedIn, requireYouthProfile } from "../lib/b4p-auth";
import { getOrCreateYouth, findYouth, profileResponse, dateOnly } from "../lib/b4p-data";
import { parseApiResponse } from "../lib/api-response";
import {
  GetDashboardResponse,
  GetMyProfileResponse,
  ListMyApplicationsResponse,
  ListMyNotificationsResponse,
  MarkMyNotificationReadBody,
  MarkMyNotificationReadParams,
  MarkMyNotificationReadResponse,
  RegisterForEventParams,
  RegisterForEventResponse,
  SubmitProgramApplicationBody,
  SubmitProgramApplicationParams,
  SubmitProgramApplicationResponse,
  UpdateMyProfileBody,
  UpdateMyProfileResponse,
} from "@workspace/api-zod";
import {
  and,
  desc,
  eq,
  gte,
} from "drizzle-orm";
import {
  applicationsTable,
  applicationSubmissionsTable,
  db,
  eventRegistrationsTable,
  eventsTable,
  notificationsTable,
  opportunitiesTable,
  programsTable,
  updatesTable,
  usersTable,
} from "@workspace/db";

const router: IRouter = Router();

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function applicationView(app: typeof applicationsTable.$inferSelect, programName: string) {
  return {
    id: app.id,
    programId: app.programId,
    programName,
    status: app.status,
    motivation: app.motivation,
    adminNote: app.adminNote,
    submittedAt: app.submittedAt.toISOString(),
  };
}

router.get("/me", requireSignedIn, async (req, res): Promise<void> => {
  const user = await findYouth(req);
  if (!user) {
    res.status(404).json({ error: "Complete your profile to continue" });
    return;
  }
  if (!user.active) {
    res.status(403).json({ error: "This account is inactive" });
    return;
  }
  res.json(parseApiResponse(GetMyProfileResponse, profileResponse(user)));
});

router.patch("/me", requireSignedIn, async (req, res): Promise<void> => {
  const existing = await findYouth(req);
  if (existing && !existing.active) {
    res.status(403).json({ error: "This account is inactive" });
    return;
  }
  const parsed = UpdateMyProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = await getOrCreateYouth(req, {
    ...parsed.data,
    dateOfBirth: dateOnly(parsed.data.dateOfBirth)!,
  });
  res.json(parseApiResponse(UpdateMyProfileResponse, profileResponse(user)));
});

router.get("/dashboard", requireYouthProfile, async (req, res): Promise<void> => {
  const user = await findYouth(req);
  if (!user) {
    res.status(404).json({ error: "Complete your profile to continue" });
    return;
  }
  const filled = [
    user.fullName,
    user.phone,
    user.gender,
    user.country,
    user.county,
    user.city,
    user.dateOfBirth,
    user.educationLevel,
    user.interests.length > 0,
  ].filter(Boolean).length;
  const today = new Date().toISOString().slice(0, 10);
  const [opportunities, opportunityCount, programs, events, notifications, programApplications, formApplications, updates] = await Promise.all([
    db.select().from(opportunitiesTable).where(eq(opportunitiesTable.published, true))
      .orderBy(desc(opportunitiesTable.datePosted)).limit(3),
    db.select({ id: opportunitiesTable.id }).from(opportunitiesTable)
      .where(eq(opportunitiesTable.published, true)),
    db.select().from(programsTable).where(eq(programsTable.published, true))
      .orderBy(desc(programsTable.createdAt)).limit(3),
    db.select().from(eventsTable).where(and(
      eq(eventsTable.published, true),
      gte(eventsTable.date, today),
    )).orderBy(eventsTable.date).limit(3),
    db.select().from(notificationsTable).where(eq(notificationsTable.userId, user.id))
      .orderBy(desc(notificationsTable.createdAt)).limit(4),
    db.select({ application: applicationsTable, programName: programsTable.name })
      .from(applicationsTable)
      .innerJoin(programsTable, eq(applicationsTable.programId, programsTable.id))
      .where(eq(applicationsTable.userId, user.id))
      .orderBy(desc(applicationsTable.submittedAt)).limit(5),
    db.select({ id: applicationSubmissionsTable.id }).from(applicationSubmissionsTable)
      .where(eq(applicationSubmissionsTable.userId, user.id)),
    db.select().from(updatesTable).where(eq(updatesTable.published, true))
      .orderBy(desc(updatesTable.createdAt)).limit(3),
  ]);
  const data = {
    profile: profileResponse(user),
    profileCompletion: { completed: filled, total: 9, percent: Math.round(filled / 9 * 100) },
    publishedOpportunityCount: opportunityCount.length,
    applicationCount: programApplications.length + formApplications.length,
    featuredOpportunities: opportunities.map((row) => ({ ...row, datePosted: row.datePosted.toISOString() })),
    featuredPrograms: programs,
    upcomingEvents: events,
    latestUpdates: updates.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    recentNotifications: notifications.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      readAt: row.readAt?.toISOString() ?? null,
    })),
    applications: programApplications.map((row) => applicationView(row.application, row.programName)),
  };
  res.json(parseApiResponse(GetDashboardResponse, data));
});

router.get("/me/applications", requireYouthProfile, async (req, res): Promise<void> => {
  const user = await findYouth(req);
  if (!user) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  const applications = await db.select({ application: applicationsTable, programName: programsTable.name })
    .from(applicationsTable)
    .innerJoin(programsTable, eq(applicationsTable.programId, programsTable.id))
    .where(eq(applicationsTable.userId, user.id))
    .orderBy(desc(applicationsTable.submittedAt));
  res.json(parseApiResponse(ListMyApplicationsResponse,
    applications.map((row) => applicationView(row.application, row.programName)),
  ));
});

router.post("/programs/:id/applications", requireYouthProfile, async (req, res): Promise<void> => {
  const params = SubmitProgramApplicationParams.safeParse(req.params);
  const body = SubmitProgramApplicationBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.success ? body.error?.message ?? "Invalid input" : params.error?.message ?? "Invalid input" });
    return;
  }
  const user = await findYouth(req);
  const [program] = await db.select().from(programsTable).where(and(
    eq(programsTable.id, params.data.id),
    eq(programsTable.published, true),
  )).limit(1);
  if (!user || !program) {
    res.status(404).json({ error: "Program not found" });
    return;
  }
  try {
    const [application] = await db.insert(applicationsTable).values({
      userId: user.id,
      programId: program.id,
      motivation: body.data.motivation,
    }).returning();
    const response = applicationView(application, program.name);
    res.status(201).json(parseApiResponse(SubmitProgramApplicationResponse, response));
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      res.status(409).json({ error: "You have already applied to this program" });
      return;
    }
    throw error;
  }
});

router.post("/events/:id/registrations", requireYouthProfile, async (req, res): Promise<void> => {
  const params = RegisterForEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const user = await findYouth(req);
  const [event] = await db.select().from(eventsTable).where(and(
    eq(eventsTable.id, params.data.id),
    eq(eventsTable.published, true),
  )).limit(1);
  if (!user || !event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  if (event.registrationUrl) {
    res.status(400).json({ error: "This event uses external registration" });
    return;
  }
  if (event.registrationDeadline && event.registrationDeadline < todayDate()) {
    res.status(410).json({ error: "Event registration has closed" });
    return;
  }
  if (event.date < todayDate()) {
    res.status(410).json({ error: "This event has already taken place" });
    return;
  }
  try {
    const [registration] = await db.insert(eventRegistrationsTable).values({
      userId: user.id,
      eventId: event.id,
    }).returning();
    res.status(201).json(parseApiResponse(RegisterForEventResponse, {
      id: registration.id,
      eventId: event.id,
      eventTitle: event.title,
      eventDate: event.date,
      registeredAt: registration.registeredAt.toISOString(),
    }));
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      res.status(409).json({ error: "You are already registered for this event" });
      return;
    }
    throw error;
  }
});

router.get("/me/notifications", requireYouthProfile, async (req, res): Promise<void> => {
  const user = await findYouth(req);
  if (!user) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  const rows = await db.select().from(notificationsTable).where(eq(notificationsTable.userId, user.id))
    .orderBy(desc(notificationsTable.createdAt));
  res.json(parseApiResponse(ListMyNotificationsResponse, rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
    readAt: row.readAt?.toISOString() ?? null,
  }))));
});

router.patch("/me/notifications/:id", requireYouthProfile, async (req, res): Promise<void> => {
  const params = MarkMyNotificationReadParams.safeParse(req.params);
  const body = MarkMyNotificationReadBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.success ? body.error?.message ?? "Invalid input" : params.error?.message ?? "Invalid input" });
    return;
  }
  const user = await findYouth(req);
  if (!user) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  const [row] = await db.update(notificationsTable).set({
    readAt: body.data.read ? new Date() : null,
  }).where(and(
    eq(notificationsTable.id, params.data.id),
    eq(notificationsTable.userId, user.id),
  )).returning();
  if (!row) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }
  res.json(parseApiResponse(MarkMyNotificationReadResponse, {
    ...row,
    createdAt: row.createdAt.toISOString(),
    readAt: row.readAt?.toISOString() ?? null,
  }));
});

export default router;
