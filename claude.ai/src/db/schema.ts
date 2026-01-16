import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// Conversations table
export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey(),
  title: text("title"),
  projectId: text("project_id").references(() => projects.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// Messages table
export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// Projects table
export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  instructions: text("instructions"), // Custom system prompt
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// Project files (for Phase 2)
export const projectFiles = sqliteTable("project_files", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  content: text("content"), // Extracted text content
  blobUrl: text("blob_url"), // URL for uploaded file
  tokenCount: integer("token_count"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// Artifacts (for Phase 2)
export const artifacts = sqliteTable("artifacts", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  messageId: text("message_id").references(() => messages.id),
  type: text("type", {
    enum: ["code", "html", "react", "markdown", "svg"],
  }).notNull(),
  title: text("title"),
  content: text("content").notNull(),
  language: text("language"), // For code artifacts
  version: integer("version").default(1),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// Memories (for Phase 3)
export const memories = sqliteTable("memories", {
  id: text("id").primaryKey(),
  projectId: text("project_id").references(() => projects.id), // null = global
  type: text("type", { enum: ["preference", "fact", "instruction"] }).notNull(),
  content: text("content").notNull(),
  source: text("source"), // conversation ID where learned
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// Styles (for Phase 3)
export const styles = sqliteTable("styles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  prompt: text("prompt").notNull(), // Instructions to append to system prompt
  isBuiltin: integer("is_builtin", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// User preferences
export const userPreferences = sqliteTable("user_preferences", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// Type exports for use in application
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Artifact = typeof artifacts.$inferSelect;
export type Memory = typeof memories.$inferSelect;
export type Style = typeof styles.$inferSelect;
