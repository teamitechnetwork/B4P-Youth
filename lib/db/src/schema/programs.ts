import { createInsertSchema } from "drizzle-zod";
import { boolean, date, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const programsTable = pgTable("programs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  coverImage: text("cover_image"),
  description: text("description").notNull(),
  objectives: text("objectives").notNull().default(""),
  eligibility: text("eligibility").notNull().default(""),
  location: text("location").notNull(),
  startDate: date("start_date", { mode: "string" }),
  endDate: date("end_date", { mode: "string" }),
  applicationDeadline: date("application_deadline", { mode: "string" }),
  published: boolean("published").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const applicationsTable = pgTable("applications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  programId: integer("program_id").notNull().references(() => programsTable.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("Submitted"),
  motivation: text("motivation").notNull(),
  adminNote: text("admin_note"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [uniqueIndex("applications_program_user_idx").on(table.programId, table.userId)]);

export const insertProgramSchema = createInsertSchema(programsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertApplicationSchema = createInsertSchema(applicationsTable).omit({ id: true, submittedAt: true, updatedAt: true });
export type InsertProgram = z.infer<typeof insertProgramSchema>;
export type InsertApplication = z.infer<typeof insertApplicationSchema>;
export type Program = typeof programsTable.$inferSelect;
export type ProgramApplication = typeof applicationsTable.$inferSelect;
