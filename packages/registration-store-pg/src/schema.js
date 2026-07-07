import { boolean, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const registrationConfig = pgTable("registration_config", {
  key: text("key").primaryKey(),
  mode: text("mode").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  updatedBy: text("updated_by"),
});

export const inviteCodes = pgTable("invite_codes", {
  code: text("code").primaryKey(),
  maxUseCount: integer("max_use_count").notNull(),
  usedCount: integer("used_count").notNull(),
  isRevoked: boolean("is_revoked").notNull(),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

export const inviteReservations = pgTable("invite_reservations", {
  reservationId: text("reservation_id").primaryKey(),
  code: text("code").notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  consumedByUserId: text("consumed_by_user_id"),
  consumedByEmail: text("consumed_by_email"),
});

export const schema = {
  registrationConfig,
  inviteCodes,
  inviteReservations,
};
