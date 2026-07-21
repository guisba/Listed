import { z } from "zod";

export const createSessionSchema = z.object({
  title: z.string().trim().min(3).max(80),
  displayName: z.string().trim().min(2).max(40),
  decisionMethod: z.enum([
    "multi_vote",
    "single_vote",
    "random",
    "weighted_random",
    "ranking",
    "elimination",
    "tournament",
    "veto",
  ]),
  expiryDays: z.number().int().min(1).max(30),
});

export const joinSessionSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/),
  displayName: z.string().trim().min(2).max(40),
});

export const manualGameSchema = z.object({
  name: z.string().trim().min(2).max(120),
  platform: z.string().trim().min(2).max(40).default("PC"),
  minPlayers: z.number().int().min(1).max(100).nullable().default(null),
  maxPlayers: z.number().int().min(1).max(100).nullable().default(null),
  features: z.array(z.string().max(40)).max(12).default([]),
});
