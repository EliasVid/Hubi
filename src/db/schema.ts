import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  salt: text('salt').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  username: text('username').notNull().unique(),
  displayName: text('display_name').notNull(),
  bio: text('bio'),
  avatarUrl: text('avatar_url'),
  whatsappNumber: text('whatsapp_number'),
  instagramHandle: text('instagram_handle'),
  themeColor: text('theme_color').default('slate'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const links = sqliteTable('links', {
  id: text('id').primaryKey(),
  profileId: text('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  url: text('url').notNull(),
  icon: text('icon').default('link'),
  position: integer('position').notNull().default(0),
  isEnabled: integer('is_enabled', { mode: 'boolean' }).notNull().default(true),
  clickCount: integer('click_count').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// Add this to the bottom of src/db/schema.ts
export const devices = sqliteTable('devices', {
  id: text('id').primaryKey(), // The unique hardware ID (e.g., 'xyz-789')
  userId: text('user_id').references(() => users.id), // Who owns it? (Null if unboxed)
  profileId: text('profile_id').references(() => profiles.id), // Where does it route to?
  name: text('name').notNull().default('My NFC Card'),
  isClaimed: integer('is_claimed', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});