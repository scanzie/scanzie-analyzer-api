import {
  pgTable,
  varchar,
  boolean,
  timestamp,
  text,
  jsonb,
  uuid,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const user = pgTable("user", {
  id: varchar("id", { length: 255 }).primaryKey(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull(),
  emailVerified: boolean("emailVerified").default(false).notNull(),
  image: varchar("image", { length: 500 }),
  createdAt: timestamp("createdAt", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const session = pgTable("session", {
  id: varchar("id", { length: 255 }).primaryKey(),
  userId: varchar("userId", { length: 255 })
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: varchar("userAgent", { length: 1000 }),
  createdAt: timestamp("createdAt", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

//
// ACCOUNT TABLE
//
export const account = pgTable("account", {
  id: varchar("id", { length: 255 }).primaryKey(),
  userId: varchar("userId", { length: 255 })
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accountId: varchar("accountId", { length: 255 }).notNull(),
  providerId: varchar("providerId", { length: 255 }).notNull(),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt", {
    withTimezone: true,
  }),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt", {
    withTimezone: true,
  }),
  scope: varchar("scope", { length: 500 }),
  idToken: text("idToken"),
  password: varchar("password", { length: 255 }),
  createdAt: timestamp("createdAt", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

//
// VERIFICATION TABLE
//
export const verification = pgTable("verification", {
  id: varchar("id", { length: 255 }).primaryKey(),
  identifier: varchar("identifier", { length: 255 }).notNull(),
  value: varchar("value", { length: 255 }).notNull(),
  expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const seo_analysis = pgTable("seo_analysis", {
  id: uuid("id").defaultRandom().primaryKey(),

  projectId: uuid("projectId")
    .notNull()
    .references(() => project.id, { onDelete: "cascade" }),

  userId: varchar("userId", { length: 255 })
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),

  title: varchar("title", { length: 255 }).notNull(),
  url: varchar("url", { length: 400 }).notNull(),

  on_page: jsonb("on_page"),
  content: jsonb("content"),
  technical: jsonb("technical"),

  createdAt: timestamp("createdAt", { withTimezone: true })
    .defaultNow()
    .notNull(),

  updatedAt: timestamp("updatedAt", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const project = pgTable("project", {
  id: uuid("id").defaultRandom().primaryKey(),

  name: varchar("name", { length: 255 }).notNull(),

  // creator (owner)
  userId: varchar("userId", { length: 255 })
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),

  createdAt: timestamp("createdAt", { withTimezone: true })
    .defaultNow()
    .notNull(),

  updatedAt: timestamp("updatedAt", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const project_members = pgTable(
  "project_members",
  {
    projectId: uuid("projectId")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),

    userId: varchar("userId", { length: 255 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    role: varchar("role", { length: 50 }).default("member").notNull(),

    createdAt: timestamp("createdAt", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    pk: primaryKey(table.projectId, table.userId),
  }),
);

//
// SUBSCRIPTION TABLE
//
export const subscription = pgTable("subscription", {
  id: uuid("id").defaultRandom().primaryKey(),

  userId: varchar("userId", { length: 255 })
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),

  plan: varchar("plan", { length: 50 }).notNull(),

  status: varchar("status", { length: 50 }).notNull(),

  subscriptionCode: varchar("subscriptionCode", { length: 255 })
    .notNull()
    .unique(),

  nextPaymentDate: timestamp("nextPaymentDate", {
    withTimezone: true,
  }).notNull(),

  createdAt: timestamp("createdAt", { withTimezone: true })
    .defaultNow()
    .notNull(),

  updatedAt: timestamp("updatedAt", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Table relations

export const projectRelations = relations(project, ({ one, many }) => ({
  creator: one(user, {
    fields: [project.userId],
    references: [user.id],
  }),

  analyses: many(seo_analysis),

  members: many(project_members),
}));

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),

  createdProjects: many(project),

  createdSeoAnalyses: many(seo_analysis),

  projectMemberships: many(project_members),

  subscriptions: many(subscription),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const seoAnalysisRelations = relations(seo_analysis, ({ one }) => ({
  creator: one(user, {
    fields: [seo_analysis.userId],
    references: [user.id],
  }),

  project: one(project, {
    fields: [seo_analysis.projectId],
    references: [project.id],
  }),
}));

export const projectMembersRelations = relations(
  project_members,
  ({ one }) => ({
    user: one(user, {
      fields: [project_members.userId],
      references: [user.id],
    }),

    project: one(project, {
      fields: [project_members.projectId],
      references: [project.id],
    }),
  }),
);

export const subscriptionRelations = relations(subscription, ({ one }) => ({
  user: one(user, {
    fields: [subscription.userId],
    references: [user.id],
  }),
}));

// Types Inferred from tables
export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;

export type Session = typeof session.$inferSelect;
export type NewSession = typeof session.$inferInsert;

export type Account = typeof account.$inferSelect;
export type NewAccount = typeof account.$inferInsert;

export type Verification = typeof verification.$inferSelect;
export type NewVerification = typeof verification.$inferInsert;

export type SeoAnalysis = typeof seo_analysis.$inferSelect;
export type NewSeoAnalysis = typeof seo_analysis.$inferInsert;

export type ProjectMember = typeof project_members.$inferSelect;
export type NewProjectMember = typeof project_members.$inferInsert;

export type Subscription = typeof subscription.$inferSelect;
export type NewSubscription = typeof subscription.$inferInsert;
