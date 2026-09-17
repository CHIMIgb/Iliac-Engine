// schemas/auth.ts — Validación Zod de los inputs de registro y login (C1).
// Todas las rutas del server validan con Zod (ROADMAP §16.4); los errores se
// convierten al contrato vía AppError.fromZod (422).
import { z } from "zod";

const login = z
  .string()
  .min(3, "Mínimo 3 caracteres")
  .max(64, "Máximo 64 caracteres")
  .regex(/^[a-zA-Z0-9._-]+$/, "Solo letras, números, . _ -");

const password = z.string().min(8, "Mínimo 8 caracteres").max(100, "Máximo 100 caracteres");

const nombre = z.string().min(1, "Obligatorio").max(255);

export const registerSchema = z.object({
  login,
  password,
  nombre,
  apellido: z.string().min(1, "Obligatorio").max(255),
  emailPublico: z.string().email("Email inválido").max(254).optional(),
});

export const loginSchema = z.object({
  login: z.string().min(1, "Obligatorio").max(64),
  password: z.string().min(1, "Obligatorio").max(100),
});

// C5f: renovación de sesión — el body es solo el refresh token opaco.
export const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Obligatorio").max(4096, "Token demasiado largo"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;