import { Router, type IRouter } from "express";
import { and, desc, eq, gte, ilike, or } from "drizzle-orm";
import {
  GetAboutResponse,
  GetEventParams,
  GetEventResponse,
  GetOpportunityParams,
  GetOpportunityResponse,
  GetProgramParams,
  GetProgramResponse,
  ListEventsQueryParams,
  ListEventsResponse,
  ListOpportunitiesQueryParams,
  ListOpportunitiesResponse,
  ListProgramsQueryParams,
  ListProgramsResponse,
  SendContactMessageBody,
  SendContactMessageResponse,
} from "@workspace/api-zod";
import {
  contactMessagesTable,
  db,
  eventsTable,
  opportunitiesTable,
  organizationSettingsTable,
  programsTable,
} from "@workspace/db";
import { organizationDefaults } from "../lib/b4p-data";
import { parseApiResponse } from "../lib/api-response";

const router: IRouter = Router();

router.get("/opportunities", async (req, res): Promise<void> => {
  const query = ListOpportunitiesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const filters = [eq(opportunitiesTable.published, true)];
  if (query.data.category) filters.push(eq(opportunitiesTable.category, query.data.category));
  if (query.data.search?.trim()) {
    const term = `%${query.data.search.trim()}%`;
    filters.push(or(
      ilike(opportunitiesTable.title, term),
      ilike(opportunitiesTable.organization, term),
      ilike(opportunitiesTable.description, term),
      ilike(opportunitiesTable.location, term),
    )!);
  }
  const rows = await db.select().from(opportunitiesTable)
    .where(and(...filters))
    .orderBy(desc(opportunitiesTable.datePosted));
  const response = rows.map((row) => ({ ...row, datePosted: row.datePosted.toISOString() }));
  res.json(parseApiResponse(ListOpportunitiesResponse, response));
});

router.get("/opportunities/:id", async (req, res): Promise<void> => {
  const params = GetOpportunityParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.select().from(opportunitiesTable).where(and(
    eq(opportunitiesTable.id, params.data.id),
    eq(opportunitiesTable.published, true),
  )).limit(1);
  if (!row) {
    res.status(404).json({ error: "Opportunity not found" });
    return;
  }
  res.json(parseApiResponse(GetOpportunityResponse, { ...row, datePosted: row.datePosted.toISOString() }));
});

router.get("/programs", async (req, res): Promise<void> => {
  const query = ListProgramsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const filters = [eq(programsTable.published, true)];
  if (query.data.search?.trim()) {
    const term = `%${query.data.search.trim()}%`;
    filters.push(or(
      ilike(programsTable.name, term),
      ilike(programsTable.description, term),
      ilike(programsTable.location, term),
    )!);
  }
  const rows = await db.select().from(programsTable)
    .where(and(...filters))
    .orderBy(desc(programsTable.createdAt));
  res.json(parseApiResponse(ListProgramsResponse, rows));
});

router.get("/programs/:id", async (req, res): Promise<void> => {
  const params = GetProgramParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.select().from(programsTable).where(and(
    eq(programsTable.id, params.data.id),
    eq(programsTable.published, true),
  )).limit(1);
  if (!row) {
    res.status(404).json({ error: "Program not found" });
    return;
  }
  res.json(parseApiResponse(GetProgramResponse, row));
});

router.get("/events", async (req, res): Promise<void> => {
  const query = ListEventsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const filters = [eq(eventsTable.published, true)];
  if (query.data.search?.trim()) {
    const term = `%${query.data.search.trim()}%`;
    filters.push(or(
      ilike(eventsTable.title, term),
      ilike(eventsTable.description, term),
      ilike(eventsTable.location, term),
    )!);
  }
  const rows = await db.select().from(eventsTable)
    .where(and(...filters))
    .orderBy(eventsTable.date);
  res.json(parseApiResponse(ListEventsResponse, rows));
});

router.get("/events/:id", async (req, res): Promise<void> => {
  const params = GetEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.select().from(eventsTable).where(and(
    eq(eventsTable.id, params.data.id),
    eq(eventsTable.published, true),
  )).limit(1);
  if (!row) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  res.json(parseApiResponse(GetEventResponse, row));
});

router.get("/about", async (_req, res): Promise<void> => {
  const [row] = await db.select().from(organizationSettingsTable).limit(1);
  const settings = row ? {
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
  res.json(parseApiResponse(GetAboutResponse, settings));
});

router.post("/contact-messages", async (req, res): Promise<void> => {
  const parsed = SendContactMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  await db.insert(contactMessagesTable).values(parsed.data);
  res.status(201).json(parseApiResponse(SendContactMessageResponse, { received: true }));
});

export default router;
