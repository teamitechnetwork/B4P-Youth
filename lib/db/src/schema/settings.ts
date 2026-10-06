import { createInsertSchema } from "drizzle-zod";
import { jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export type SocialLink = { label: string; url: string };

export const organizationSettingsTable = pgTable("organization_settings", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  mission: text("mission").notNull(),
  vision: text("vision").notNull(),
  focusAreas: text("focus_areas").array().notNull().default([]),
  empowermentInfo: text("empowerment_info").notNull(),
  contactEmail: text("contact_email"),
  phone: text("phone").notNull().default(""),
  address: text("address").notNull().default(""),
  socialLinks: jsonb("social_links").$type<SocialLink[]>().notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertOrganizationSettingsSchema = createInsertSchema(organizationSettingsTable).omit({ id: true, updatedAt: true });
export type InsertOrganizationSettings = z.infer<typeof insertOrganizationSettingsSchema>;
export type OrganizationSettings = typeof organizationSettingsTable.$inferSelect;
