import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  profileType: text("profile_type").notNull(), // "athlete", "school", "club", "admin"
  avatar: text("avatar"),
  verified: boolean("verified").default(false),
  // O campo isAdmin não existe no banco
  age: integer("age"),
  position: text("position"),
  team: text("team"),
  ageGroup: text("age_group"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const athletes = pgTable("athletes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  age: integer("age"),
  birthdate: timestamp("birthdate"),
  gender: text("gender").notNull().default("male"), // "male" ou "female"
  position: text("position"),
  height: integer("height"), // em cm
  weight: integer("weight"), // em kg
  city: text("city"),
  state: text("state"),
  phone: text("phone"),
  isIndependent: boolean("is_independent").default(false),
  schoolId: integer("school_id").references(() => schools.id),
  schoolApproved: boolean("school_approved").default(false),
  bio: text("bio"),
  ageGroup: text("age_group"),
  videos: text("videos").array().default([]), // Array de URLs de vídeos
  achievements: text("achievements").array().default([]), // Conquistas do atleta
  footballType: text("football_type").notNull().default("field"), // "field", "futsal", "society", etc.
});

export const schools = pgTable("schools", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  foundationYear: integer("foundation_year"),
  address: text("address"),
  city: text("city").notNull(),
  state: text("state").notNull(),
  postalCode: text("postal_code"),
  phone: text("phone"),
  website: text("website"),
  instagram: text("instagram"),
  facebook: text("facebook"),
  ageGroups: text("age_groups").array(), // e.g. ["Sub-10", "Sub-13", "Sub-15"]
  description: text("description"),
  infrastructure: text("infrastructure").array(), // e.g. ["Campo oficial", "Campo society", "Academia"]
});

export const clubs = pgTable("clubs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  foundationYear: integer("foundation_year"),
  address: text("address"),
  city: text("city").notNull(),
  state: text("state").notNull(),
  postalCode: text("postal_code"),
  phone: text("phone"),
  website: text("website"),
  instagram: text("instagram"),
  facebook: text("facebook"),
  description: text("description"),
  division: text("division"), // e.g. "Primeira Divisão", "Segunda Divisão"
});

export const schoolAthleteRequests = pgTable("school_athlete_requests", {
  id: serial("id").primaryKey(),
  athleteId: integer("athlete_id").references(() => athletes.id).notNull(),
  schoolId: integer("school_id").references(() => schools.id).notNull(),
  status: text("status").notNull(), // "pending", "approved", "rejected"
  requestedAt: timestamp("requested_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

export const follows = pgTable("follows", {
  id: serial("id").primaryKey(),
  followerId: integer("follower_id").references(() => users.id).notNull(),
  followedId: integer("followed_id").references(() => users.id).notNull(),
  followedAt: timestamp("followed_at").defaultNow(),
});

export const scores = pgTable("scores", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  total: integer("total").notNull().default(0),
  performance: integer("performance").notNull().default(0),
  discipline: integer("discipline").notNull().default(0),
  responsibility: integer("responsibility").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const badges = pgTable("badges", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  icon: text("icon").notNull(),
  description: text("description").notNull(),
});

export const userBadges = pgTable("user_badges", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  badgeId: integer("badge_id").references(() => badges.id),
  earnedAt: timestamp("earned_at").defaultNow(),
});

export const trainings = pgTable("trainings", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  ageGroup: text("age_group").notNull(),
  objective: text("objective").notNull(),
  duration: integer("duration").notNull(), // in minutes
  exercises: jsonb("exercises").notNull(),
  tips: text("tips").array().notNull(),
});

export const groups = pgTable("groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdBy: integer("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const challenges = pgTable("challenges", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  isOfficial: boolean("is_official").notNull().default(false),
  isGroupChallenge: boolean("is_group_challenge").notNull().default(false),
  createdBy: integer("created_by").references(() => users.id),
  groupId: integer("group_id").references(() => groups.id),
  ageGroup: text("age_group").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  rules: text("rules").array().notNull(),
  pointsValue: integer("points_value").notNull().default(100),
});

export const userTrainings = pgTable("user_trainings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  trainingId: integer("training_id").references(() => trainings.id),
  status: text("status").notNull(), // "scheduled", "completed", "in_progress"
  scheduledFor: timestamp("scheduled_for"),
  completedAt: timestamp("completed_at"),
});

export const userChallenges = pgTable("user_challenges", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  challengeId: integer("challenge_id").references(() => challenges.id),
  status: text("status").notNull(), // "pending", "completed", "failed"
  videoUrl: text("video_url"),
  submittedAt: timestamp("submitted_at"),
  pointsEarned: integer("points_earned"),
});

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  content: text("content").notNull(),
  mediaUrl: text("media_url"),
  likes: integer("likes").notNull().default(0),
  comments: integer("comments").notNull().default(0),
  shares: integer("shares").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const directMessages = pgTable("direct_messages", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").references(() => users.id).notNull(),
  receiverId: integer("receiver_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const postComments = pgTable("post_comments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").references(() => posts.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  likes: integer("likes").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const postLikes = pgTable("post_likes", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").references(() => posts.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const postShares = pgTable("post_shares", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").references(() => posts.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const systemConfig = pgTable("system_config", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: integer("updated_by").references(() => users.id),
});

export const groupMembers = pgTable("group_members", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").references(() => groups.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  status: text("status").notNull().default("pending"), // "pending", "accepted", "rejected"
  invitedAt: timestamp("invited_at").defaultNow(),
  joinedAt: timestamp("joined_at"),
});

export const groupScores = pgTable("group_scores", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").references(() => groups.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  points: integer("points").notNull().default(0),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const insertUserSchema = z.object({
  username: z.string(),
  password: z.string(),
  name: z.string(),
  email: z.string(),
  profileType: z.enum(["admin", "athlete", "club", "school"]),
  verified: z.boolean().optional() // 👈 adicionado
});

export const createExercicioSchema = z.object({
  nome: z.string(),
  descricao: z.string().optional(),
  nivel: z.enum(['Base', 'Avancado', 'Performance']),
  categorias: z.array(z.enum(['Sub9', 'Sub11', 'Sub13', 'Sub15', 'Sub17', 'Sub20', 'Livre'])),
  videoDemonstrativoUrl: z.string().url().optional()
});


// Insert schemas
export const insertAthleteSchema = createInsertSchema(athletes).omit({ id: true, schoolApproved: true });
export const insertSchoolSchema = createInsertSchema(schools).omit({ id: true });
export const insertClubSchema = createInsertSchema(clubs).omit({ id: true });
export const insertSchoolAthleteRequestSchema = createInsertSchema(schoolAthleteRequests).omit({ id: true, requestedAt: true, resolvedAt: true });
export const insertFollowSchema = createInsertSchema(follows).omit({ id: true, followedAt: true });
export const insertScoreSchema = createInsertSchema(scores).omit({ id: true, updatedAt: true });
export const insertBadgeSchema = createInsertSchema(badges).omit({ id: true });
export const insertUserBadgeSchema = createInsertSchema(userBadges).omit({ id: true, earnedAt: true });
export const insertTrainingSchema = createInsertSchema(trainings).omit({ id: true });
export const insertChallengeSchema = createInsertSchema(challenges).omit({ id: true });
export const insertUserTrainingSchema = createInsertSchema(userTrainings).omit({ id: true, completedAt: true });
export const insertUserChallengeSchema = createInsertSchema(userChallenges).omit({ id: true, submittedAt: true });
export const insertPostSchema = createInsertSchema(posts).omit({ id: true, createdAt: true });
export const insertDirectMessageSchema = createInsertSchema(directMessages).omit({ id: true, createdAt: true, read: true });
export const insertPostCommentSchema = createInsertSchema(postComments).omit({ id: true, createdAt: true, likes: true });
export const insertPostLikeSchema = createInsertSchema(postLikes).omit({ id: true, createdAt: true });
export const insertPostShareSchema = createInsertSchema(postShares).omit({ id: true, createdAt: true });
export const insertSystemConfigSchema = createInsertSchema(systemConfig).omit({ id: true, updatedAt: true });
export const insertGroupSchema = createInsertSchema(groups).omit({ id: true, createdAt: true });
export const insertGroupMemberSchema = createInsertSchema(groupMembers).omit({ id: true, invitedAt: true, joinedAt: true });
export const insertGroupScoreSchema = createInsertSchema(groupScores).omit({ id: true, lastUpdated: true });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Athlete = typeof athletes.$inferSelect;
export type InsertAthlete = z.infer<typeof insertAthleteSchema>;

export type School = typeof schools.$inferSelect;
export type InsertSchool = z.infer<typeof insertSchoolSchema>;

export type Club = typeof clubs.$inferSelect;
export type InsertClub = z.infer<typeof insertClubSchema>;

export type SchoolAthleteRequest = typeof schoolAthleteRequests.$inferSelect;
export type InsertSchoolAthleteRequest = z.infer<typeof insertSchoolAthleteRequestSchema>;

export type Follow = typeof follows.$inferSelect;
export type InsertFollow = z.infer<typeof insertFollowSchema>;

export type Score = typeof scores.$inferSelect;
export type InsertScore = z.infer<typeof insertScoreSchema>;

export type Badge = typeof badges.$inferSelect;
export type InsertBadge = z.infer<typeof insertBadgeSchema>;

export type UserBadge = typeof userBadges.$inferSelect;
export type InsertUserBadge = z.infer<typeof insertUserBadgeSchema>;

export type Training = typeof trainings.$inferSelect;
export type InsertTraining = z.infer<typeof insertTrainingSchema>;

export type Challenge = typeof challenges.$inferSelect;
export type InsertChallenge = z.infer<typeof insertChallengeSchema>;

export type UserTraining = typeof userTrainings.$inferSelect;
export type InsertUserTraining = z.infer<typeof insertUserTrainingSchema>;

export type UserChallenge = typeof userChallenges.$inferSelect;
export type InsertUserChallenge = z.infer<typeof insertUserChallengeSchema>;

export type Post = typeof posts.$inferSelect;
export type InsertPost = z.infer<typeof insertPostSchema>;

export type DirectMessage = typeof directMessages.$inferSelect;
export type InsertDirectMessage = z.infer<typeof insertDirectMessageSchema>;

export type PostComment = typeof postComments.$inferSelect;
export type InsertPostComment = z.infer<typeof insertPostCommentSchema>;

export type PostLike = typeof postLikes.$inferSelect;
export type InsertPostLike = z.infer<typeof insertPostLikeSchema>;

export type PostShare = typeof postShares.$inferSelect;
export type InsertPostShare = z.infer<typeof insertPostShareSchema>;

export type SystemConfig = typeof systemConfig.$inferSelect;
export type InsertSystemConfig = z.infer<typeof insertSystemConfigSchema>;

export type Group = typeof groups.$inferSelect;
export type InsertGroup = z.infer<typeof insertGroupSchema>;

export type GroupMember = typeof groupMembers.$inferSelect;
export type InsertGroupMember = z.infer<typeof insertGroupMemberSchema>;

export type GroupScore = typeof groupScores.$inferSelect;
export type InsertGroupScore = z.infer<typeof insertGroupScoreSchema>;

// Type for exercises which are stored as jsonb
export type Exercise = {
  id: string;
  name: string;
  description: string;
  icon: string;
  duration: string;
};
