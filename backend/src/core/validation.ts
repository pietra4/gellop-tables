import { z } from 'zod';

export const RegisterSchema = z.object({
  username: z.string().min(3).max(255),
  email: z.string().email(),
  password: z.string().min(8),
});

export const LoginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

export const CreateTableSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
});

export const UpdateTableSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
});

export const CreateRowSchema = z.object({
  data: z.record(z.any()).optional(),
});

export const UpdateRowSchema = z.object({
  data: z.record(z.any()),
});

export const AddColumnSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['string', 'number', 'date', 'boolean', 'enrichment', 'formula']),
  enrichment: z.object({
    url: z.string().url(),
    method: z.enum(['GET', 'POST']).default('POST'),
    mapping: z.record(z.string()),
    concurrency: z.number().min(1).default(3),
    delay: z.number().min(0).default(0),
    retryCount: z.number().min(0).default(3),
  }).optional(),
  formula: z.string().optional(),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type CreateTableInput = z.infer<typeof CreateTableSchema>;
export type UpdateTableInput = z.infer<typeof UpdateTableSchema>;
export type CreateRowInput = z.infer<typeof CreateRowSchema>;
export type UpdateRowInput = z.infer<typeof UpdateRowSchema>;
export type AddColumnInput = z.infer<typeof AddColumnSchema>;
