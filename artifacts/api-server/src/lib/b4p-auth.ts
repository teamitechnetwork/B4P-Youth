import { getAuth } from "@clerk/express";
import type { RequestHandler } from "express";
import { and, eq } from "drizzle-orm";
import { adminsTable, db, usersTable } from "@workspace/db";

export function clerkUserIdFromRequest(req: Parameters<RequestHandler>[0]): string | null {
  return getAuth(req).userId ?? null;
}

export const requireSignedIn: RequestHandler = (req, res, next) => {
  if (!clerkUserIdFromRequest(req)) {
    res.status(401).json({ error: "Sign in to continue" });
    return;
  }
  next();
};

export const requireYouthProfile: RequestHandler = async (req, res, next) => {
  try {
    const clerkUserId = clerkUserIdFromRequest(req);
    if (!clerkUserId) {
      res.status(401).json({ error: "Sign in to continue" });
      return;
    }
    const [user] = await db.select({ id: usersTable.id, active: usersTable.active })
      .from(usersTable)
      .where(eq(usersTable.clerkUserId, clerkUserId))
      .limit(1);
    if (!user) {
      res.status(404).json({ error: "Complete your profile before continuing" });
      return;
    }
    if (!user.active) {
      res.status(403).json({ error: "This account is inactive" });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
};

export const requireB4pAdmin: RequestHandler = async (req, res, next) => {
  try {
    const clerkUserId = clerkUserIdFromRequest(req);
    if (!clerkUserId) {
      res.status(401).json({ error: "Sign in to continue" });
      return;
    }
    const [admin] = await db.select({ id: adminsTable.id })
      .from(adminsTable)
      .innerJoin(usersTable, eq(adminsTable.userId, usersTable.id))
      .where(and(eq(usersTable.clerkUserId, clerkUserId), eq(usersTable.active, true)))
      .limit(1);
    if (!admin) {
      res.status(403).json({ error: "Administrator access required" });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
};
