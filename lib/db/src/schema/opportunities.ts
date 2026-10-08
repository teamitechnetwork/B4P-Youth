import { createInsertSchema } from "drizzle-zod";
import { boolean, date, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const opportunitiesTable = pgTable("opportunities", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  organization: text("organization").notNull(),
  contactInfo: text("contact_info"),
  coverImage: text("cover_image"),
  description: text("description").notNull(),
  requirements: text("requirements").notNull().default(""),
  location: text("location").notNull(),
  deadline: date("deadline", { mode: "string" }),
  applicationUrl: text("application_url"),
  published: boolean("published").notNull().default(false),
  datePosted: timestamp("date_posted", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertOpportunitySchema = createInsertSchema(opportunitiesTable).omit({ id: true, datePosted: true, updatedAt: true });
export type InsertOpportunity = z.infer<typeof insertOpportunitySchema>;
export type Opportunity = typeof opportunitiesTable.$inferSelect;
