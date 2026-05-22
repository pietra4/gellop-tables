import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from './database.js';
import { AuthenticationError, ConflictError } from '../utils/errors.js';
import { RegisterInput, LoginInput } from './validation.js';
import logger from '../utils/logger.js';

function requireJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return secret;
}

const JWT_SECRET: string = requireJwtSecret();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

export interface AuthPayload {
  userId: string;
  username: string;
  iat?: number;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(userId: string, username: string): string {
  const options: jwt.SignOptions = { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] };
  return jwt.sign({ userId, username }, JWT_SECRET, options);
}

export function verifyToken(token: string): AuthPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as unknown as AuthPayload;
  } catch (error) {
    throw new AuthenticationError('Invalid token');
  }
}

export async function register(input: RegisterInput): Promise<{ userId: string; token: string }> {
  try {
    const existingUser = await query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [input.username, input.email]
    );

    if (existingUser.rows.length > 0) {
      throw new ConflictError('Username or email already exists');
    }

    const passwordHash = await hashPassword(input.password);
    const result = await query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
      [input.username, input.email, passwordHash]
    );

    const userId = result.rows[0].id;
    const token = generateToken(userId, input.username);

    logger.info(`User registered: ${input.username}`);
    return { userId, token };
  } catch (error) {
    logger.error('Registration error', error);
    throw error;
  }
}

export async function login(input: LoginInput): Promise<{ userId: string; token: string; username: string }> {
  try {
    const result = await query(
      'SELECT id, username, password_hash FROM users WHERE username = $1',
      [input.username]
    );

    if (result.rows.length === 0) {
      throw new AuthenticationError('Invalid username or password');
    }

    const user = result.rows[0];
    const passwordMatch = await verifyPassword(input.password, user.password_hash);

    if (!passwordMatch) {
      throw new AuthenticationError('Invalid username or password');
    }

    const token = generateToken(user.id, user.username);
    logger.info(`User logged in: ${input.username}`);

    return { userId: user.id, token, username: user.username };
  } catch (error) {
    logger.error('Login error', error);
    throw error;
  }
}

export async function getUser(userId: string): Promise<{ id: string; username: string; email: string } | null> {
  const result = await query(
    'SELECT id, username, email FROM users WHERE id = $1',
    [userId]
  );

  return result.rows.length > 0 ? result.rows[0] : null;
}
