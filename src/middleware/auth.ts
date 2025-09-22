// src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import { eq, and, gt } from 'drizzle-orm';
import { session, user } from '../database/schema'; // Adjust the import path to your schema file
import { db } from '../database/db';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        name: string | null;
        email: string;
        emailVerified: boolean;
        image: string | null;
        createdAt: Date;
        updatedAt: Date;
      };
    }
  }
}

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get token from Authorization header (Bearer token) or from cookies
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : req.headers['x-session-token'] as string;

    if (!token) {
      return res.status(401).json({ 
        error: 'Authentication required', 
        message: 'No session token provided' 
      });
    }

    // Query the database for the session and associated user
    const sessionData = await db
      .select({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          emailVerified: user.emailVerified,
          image: user.image,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        session: {
          id: session.id,
          expiresAt: session.expiresAt,
          ipAddress: session.ipAddress,
        }
      })
      .from(session)
      .innerJoin(user, eq(session.userId, user.id))
      .where(
        and(
          eq(session.token, token),
          gt(session.expiresAt, new Date()) // Check if session hasn't expired
        )
      )
      .limit(1);

    if (sessionData.length === 0) {
      return res.status(401).json({ 
        error: 'Invalid or expired session', 
        message: 'Please log in again' 
      });
    }

    const { user: userData, session: sessionInfo } = sessionData[0];
    // Add user data to request object
    req.user = userData;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ 
      error: 'Authentication error', 
      message: 'Internal server error during authentication' 
    });
  }
};

// Optional: Middleware for admin or specific role checks
export const requireEmailVerified = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user?.emailVerified) {
    return res.status(403).json({ 
      error: 'Email verification required', 
      message: 'Please verify your email to access this resource' 
    });
  }
  next();
};

// Helper function to extract user ID from request (useful in route handlers)
export const getUserId = (req: Request): string => {
  if (!req.body.userId) {
    throw new Error('User not authenticated');
  }
  return req.body.userId
};

// Helper function to create session token validation for WebSocket or other protocols
export const validateSessionToken = async (token: string) => {
  try {
    const sessionData = await db
      .select({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          emailVerified: user.emailVerified,
          image: user.image,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        }
      })
      .from(session)
      .innerJoin(user, eq(session.userId, user.id))
      .where(
        and(
          eq(session.token, token),
          gt(session.expiresAt, new Date())
        )
      )
      .limit(1);

    return sessionData.length > 0 ? sessionData[0].user : null;
  } catch (error) {
    console.error('Session validation error:', error);
    return null;
  }
};