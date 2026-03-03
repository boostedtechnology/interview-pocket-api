import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import * as jose from 'jose';
import { config } from '../config.js';
import { UnauthorizedError, ConflictError, ValidationError } from '../utils/errors.js';
import type { RegisterInput, LoginInput, AuthResponse, AuthUser } from '../types/index.js';

const SALT_ROUNDS = 10;

export class UserService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }
  /**
   * Register a new user
   */
  async register(input: RegisterInput): Promise<AuthResponse> {
    const { email, password } = input;

    // Validate email format
    if (!this.isValidEmail(email)) {
      throw new ValidationError('Invalid email format');
    }

    // Validate password strength
    if (password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters');
    }

     // Check if user already exists
     const existing = await this.prisma.user.findUnique({
       where: { email: email.toLowerCase() },
     });

    if (existing) {
      throw new ConflictError('Email already registered');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

     // Create user
     const user = await this.prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
      },
    });

    // Generate token
    const token = await this.generateToken(user.id, user.email);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
      },
    };
  }

  /**
   * Login user and return JWT token
   */
  async login(input: LoginInput): Promise<AuthResponse> {
    const { email, password } = input;

     // Find user by email
     const user = await this.prisma.user.findUnique({
       where: { email: email.toLowerCase() },
     });

    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Compare password
    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Generate token
    const token = await this.generateToken(user.id, user.email);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
      },
    };
  }

  /**
   * Verify JWT token and return user
   */
  async verifyToken(token: string): Promise<AuthUser> {
    try {
      const secret = new TextEncoder().encode(config.jwtSecret);
      const { payload } = await jose.jwtVerify(token, secret);

      return {
        id: payload.sub as string,
        email: payload.email as string,
      };
    } catch {
      throw new UnauthorizedError('Invalid token');
    }
  }

  /**
   * Generate JWT token
   */
  private async generateToken(userId: string, email: string): Promise<string> {
    const secret = new TextEncoder().encode(config.jwtSecret);

    const token = await new jose.SignJWT({ email })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime(config.jwtExpiresIn)
      .sign(secret);

    return token;
  }

  /**
   * Validate email format
   * - Local part: alphanumeric, dots, hyphens, underscores (no leading/trailing dots)
   * - Domain: alphanumeric and hyphens
   * - TLD: 2+ alphabetic characters
   * - No consecutive dots allowed
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/;
    
    // Additional checks for common issues
    if (email.includes('..') || email.startsWith('.') || email.endsWith('.')) {
      return false;
    }
    
    const [localPart, domain] = email.split('@');
    if (!localPart || !domain) {
      return false;
    }
    
    // Local part cannot start or end with a dot
    if (localPart.startsWith('.') || localPart.endsWith('.')) {
      return false;
    }
    
    return emailRegex.test(email);
  }
}
