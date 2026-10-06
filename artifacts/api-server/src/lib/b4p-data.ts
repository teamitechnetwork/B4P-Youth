import { clerkClient } from "@clerk/express";
import { eq } from "drizzle-orm";
import type { Request } from "express";
import { db, notificationsTable, usersTable, type User } from "@workspace/db";
import { clerkUserIdFromRequest } from "./b4p-auth";

export const organizationDefaults = {
  name: "Business for Peace Community Development Foundation (B4P CODEFOUND)",
  description: "B4P CODEFOUND is a youth- and women-focused nonprofit organization supporting young people and communities through opportunities, programs and events.",
  mission: "To support young people and women with access to opportunities, programs and community-centered development.",
  vision: "Communities where young people and women can learn, participate and contribute to a peaceful and thriving future.",
  focusAreas: ["Youth empowerment", "Women’s empowerment", "Community development"],
  empowermentInfo: "B4P CODEFOUND connects young people and women with information and pathways that support their growth and participation in their communities.",
  contactEmail: null,
  phone: "",
  address: "",
  socialLinks: [],
};

export function dateOnly(value: Date | string | null | undefined) {
  if (value == null) return value;
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

export async function getOrCreateYouth(req: Request, profile?: {
  fullName: string;
  phone: string;
  gender: string;
  country: string;
  county: string;
  city: string;
  dateOfBirth: string;
  educationLevel: string;
  interests: string[];
}): Promise<User> {
  const clerkUserId = clerkUserIdFromRequest(req);
  if (!clerkUserId) throw new Error("Authenticated Clerk user is unavailable");

  const [existing] = await db.select().from(usersTable)
    .where(eq(usersTable.clerkUserId, clerkUserId))
    .limit(1);

  const identity = await clerkClient.users.getUser(clerkUserId);
  const email = identity.emailAddresses.find((item) => item.id === identity.primaryEmailAddressId)?.emailAddress;
  if (!email) throw new Error("Your Clerk account needs a verified email address");
  const identityName = [identity.firstName, identity.lastName].filter(Boolean).join(" ");

  if (existing) {
    const [updated] = await db.update(usersTable).set({
      email,
      imageUrl: identity.imageUrl || null,
      ...(profile ?? {}),
    }).where(eq(usersTable.id, existing.id)).returning();
    return updated;
  }

  if (!profile) throw new Error("Complete your profile to create your B4P Youth account");
  const [created] = await db.insert(usersTable).values({
    clerkUserId,
    email,
    imageUrl: identity.imageUrl || null,
    ...profile,
    fullName: profile.fullName || identityName,
  }).returning();
  return created;
}

export async function findYouth(req: Request): Promise<User | undefined> {
  const clerkUserId = clerkUserIdFromRequest(req);
  if (!clerkUserId) return undefined;
  const [user] = await db.select().from(usersTable)
    .where(eq(usersTable.clerkUserId, clerkUserId))
    .limit(1);
  return user;
}

export function profileResponse(user: User) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    gender: user.gender,
    country: user.country,
    county: user.county,
    city: user.city,
    dateOfBirth: user.dateOfBirth,
    educationLevel: user.educationLevel,
    interests: user.interests,
    imageUrl: user.imageUrl,
    active: user.active,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function notifyActiveYouth(type: string, title: string, body: string): Promise<number> {
  const activeUsers = await db.select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.active, true));
  if (activeUsers.length === 0) return 0;
  await db.insert(notificationsTable).values(
    activeUsers.map((user) => ({ userId: user.id, type, title, body })),
  );
  return activeUsers.length;
}
