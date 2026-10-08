import { createInsertSchema } from "drizzle-zod";
import { boolean, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export type UpdateCategory =
  | "Announcement"
  | "News"
  | "Important notice"
  | "Program update"
  | "Opportunity update"
  | "Event reminder";

export const updatesTable = pgTable("updates", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  category: text("category").$type<UpdateCategory>().notNull().default("Announcement"),
  content: text("content").notNull(),
  imageUrl: text("image_url"),
  published: boolean("published").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUpdateSchema = createInsertSchema(updatesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUpdate = z.infer<typeof insertUpdateSchema>;
export type Update = typeof updatesTable.$inferSelect;
