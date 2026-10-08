import { createInsertSchema } from "drizzle-zod";
import { boolean, date, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { programsTable } from "./programs";

export type ApplicationQuestionType =
  | "short_text"
  | "long_text"
  | "email"
  | "phone"
  | "dropdown"
  | "multiple_choice"
  | "checkbox"
  | "date";

export type ApplicationAnswerValue = string | string[] | boolean;
export type ApplicationAnswer = {
  prompt: string;
  type: ApplicationQuestionType;
  value: ApplicationAnswerValue;
};

export const applicationFormsTable = pgTable("application_forms", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  instructions: text("instructions").notNull().default(""),
  eligibilityRequirements: text("eligibility_requirements").notNull().default(""),
  deadline: date("deadline", { mode: "string" }),
  programId: integer("program_id").references(() => programsTable.id, { onDelete: "set null" }),
  published: boolean("published").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const applicationQuestionsTable = pgTable("application_questions", {
  id: serial("id").primaryKey(),
  formId: integer("form_id").notNull().references(() => applicationFormsTable.id, { onDelete: "cascade" }),
  prompt: text("prompt").notNull(),
  type: text("type").$type<ApplicationQuestionType>().notNull(),
  required: boolean("required").notNull().default(false),
  options: text("options").array().notNull().default([]),
  position: integer("position").notNull().default(0),
});

export const applicationSubmissionsTable = pgTable("application_submissions", {
  id: serial("id").primaryKey(),
  formId: integer("form_id").references(() => applicationFormsTable.id, { onDelete: "set null" }),
  formTitle: text("form_title").notNull(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  answers: jsonb("answers").$type<ApplicationAnswer[]>().notNull().default([]),
  status: text("status").notNull().default("Submitted"),
  adminNote: text("admin_note"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [uniqueIndex("application_submissions_form_user_idx").on(table.formId, table.userId)]);

export const insertApplicationFormSchema = createInsertSchema(applicationFormsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertApplicationQuestionSchema = createInsertSchema(applicationQuestionsTable).omit({ id: true });
export const insertApplicationSubmissionSchema = createInsertSchema(applicationSubmissionsTable).omit({ id: true, submittedAt: true, updatedAt: true });
export type InsertApplicationForm = z.infer<typeof insertApplicationFormSchema>;
export type InsertApplicationQuestion = z.infer<typeof insertApplicationQuestionSchema>;
export type InsertApplicationSubmission = z.infer<typeof insertApplicationSubmissionSchema>;
export type ApplicationForm = typeof applicationFormsTable.$inferSelect;
export type ApplicationQuestion = typeof applicationQuestionsTable.$inferSelect;
export type ApplicationSubmission = typeof applicationSubmissionsTable.$inferSelect;
