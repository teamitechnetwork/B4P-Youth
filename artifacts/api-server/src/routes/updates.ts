import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import {
  CreateUpdateBody,
  CreateUpdateResponse,
  DeleteUpdateParams,
  ListAdminUpdatesResponse,
  ListUpdatesResponse,
  UpdateUpdateBody,
  UpdateUpdateParams,
  UpdateUpdateResponse,
} from "@workspace/api-zod";
import { db, updatesTable } from "@workspace/db";
import { requireB4pAdmin, requireYouthProfile } from "../lib/b4p-auth";
import { notifyActiveYouth } from "../lib/b4p-data";
import { parseApiResponse } from "../lib/api-response";

const router: IRouter = Router();

function updateView(update: typeof updatesTable.$inferSelect) {
  return {
    ...update,
    createdAt: update.createdAt.toISOString(),
    updatedAt: update.updatedAt.toISOString(),
  };
}

router.get("/updates", requireYouthProfile, async (_req, res): Promise<void> => {
  const rows = await db.select().from(updatesTable)
    .where(eq(updatesTable.published, true))
    .orderBy(desc(updatesTable.createdAt));
  res.json(parseApiResponse(ListUpdatesResponse, rows.map(updateView)));
});

router.get("/admin/updates", requireB4pAdmin, async (_req, res): Promise<void> => {
  const rows = await db.select().from(updatesTable).orderBy(desc(updatesTable.updatedAt));
  res.json(parseApiResponse(ListAdminUpdatesResponse, rows.map(updateView)));
});

router.post("/admin/updates", requireB4pAdmin, async (req, res): Promise<void> => {
  const body = CreateUpdateBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [row] = await db.insert(updatesTable).values(body.data).returning();
  if (row.published) {
    await notifyActiveYouth("announcement", "New B4P update", row.title);
  }
  res.status(201).json(parseApiResponse(CreateUpdateResponse, updateView(row)));
});

router.patch("/admin/updates/:id", requireB4pAdmin, async (req, res): Promise<void> => {
  const params = UpdateUpdateParams.safeParse(req.params);
  const body = UpdateUpdateBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.success ? body.error?.message ?? "Invalid input" : params.error?.message ?? "Invalid input" });
    return;
  }
  const [previous] = await db.select().from(updatesTable)
    .where(eq(updatesTable.id, params.data.id)).limit(1);
  if (!previous) {
    res.status(404).json({ error: "Update not found" });
    return;
  }
  const [row] = await db.update(updatesTable).set({
    ...body.data,
    updatedAt: new Date(),
  }).where(eq(updatesTable.id, previous.id)).returning();
  if (!previous.published && row.published) {
    await notifyActiveYouth("announcement", "New B4P update", row.title);
  }
  res.json(parseApiResponse(UpdateUpdateResponse, updateView(row)));
});

router.delete("/admin/updates/:id", requireB4pAdmin, async (req, res): Promise<void> => {
  const params = DeleteUpdateParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.delete(updatesTable)
    .where(eq(updatesTable.id, params.data.id)).returning();
  if (!row) {
    res.status(404).json({ error: "Update not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
