// password.ts — Hash de contraseñas con bcrypt (12 rounds, DATABASE.md §8 C1).
// bcryptjs: implementación JS pura, misma API que bcrypt, sin toolchain nativa
// (WSL + node.exe). El salt va embebido en el hash, verify usa hashSync.
import bcrypt from "bcryptjs";

const ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}