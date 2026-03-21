import { createHash, randomBytes } from "node:crypto";

import type { UserStatus } from "@prisma/client";

import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

const passwordResetTokenTtlMs = 1000 * 60 * 60;

function hashPasswordResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function buildPasswordResetUrl(token: string) {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(
    /\/+$/,
    "",
  );

  return `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;
}

function shouldExposePasswordResetLink() {
  return process.env.NODE_ENV !== "production";
}

export class AuthServiceError extends Error {
  constructor(
    public readonly code:
      | "EMAIL_EXISTS"
      | "USER_DISABLED"
      | "RESET_TOKEN_INVALID"
      | "RESET_TOKEN_EXPIRED",
  ) {
    super(code);
  }
}

export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string | null;
  status: UserStatus;
};

type RegisterUserInput = {
  email: string;
  password: string;
};

type PasswordResetRequestResult = {
  requested: true;
  userId: string | null;
  resetLink: string | null;
};

type PasswordResetInput = {
  token: string;
  password: string;
};

type PasswordResetResult = {
  userId: string;
};

class AuthService {
  async register(input: RegisterUserInput) {
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });

    if (existingUser) {
      throw new AuthServiceError("EMAIL_EXISTS");
    }

    const passwordHash = await hashPassword(input.password);

    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email,
          passwordHash,
          profile: {
            create: {
              email: input.email,
            },
          },
        },
        include: {
          profile: true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          actionType: "USER_REGISTERED",
          resourceType: "USER",
          resourceId: user.id,
          payload: {
            email: user.email,
          },
        },
      });

      return user;
    });
  }

  async verifyCredentials(
    email: string,
    password: string,
  ): Promise<AuthenticatedUser | null> {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        profile: true,
      },
    });

    if (!user) {
      return null;
    }

    if (user.status === "DISABLED") {
      throw new AuthServiceError("USER_DISABLED");
    }

    const isPasswordValid = await verifyPassword(password, user.passwordHash);

    if (!isPasswordValid) {
      return null;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
      },
    });

    return {
      id: user.id,
      email: user.email,
      name: user.profile?.fullName ?? null,
      status: user.status,
    };
  }

  async requestPasswordReset(email: string): Promise<PasswordResetRequestResult> {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        status: true,
      },
    });

    if (!user || user.status === "DISABLED") {
      return {
        requested: true,
        userId: null,
        resetLink: null,
      };
    }

    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashPasswordResetToken(token);
    const expiresAt = new Date(Date.now() + passwordResetTokenTtlMs);

    await prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          usedAt: null,
        },
        data: {
          usedAt: new Date(),
        },
      });

      const passwordResetToken = await tx.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          actionType: "PASSWORD_RESET_REQUESTED",
          resourceType: "PASSWORD_RESET_TOKEN",
          resourceId: passwordResetToken.id,
          payload: {
            expiresAt: expiresAt.toISOString(),
          },
        },
      });
    });

    return {
      requested: true,
      userId: user.id,
      resetLink: shouldExposePasswordResetLink()
        ? buildPasswordResetUrl(token)
        : null,
    };
  }

  async resetPassword(input: PasswordResetInput): Promise<PasswordResetResult> {
    const passwordHash = await hashPassword(input.password);
    const passwordResetToken = await prisma.passwordResetToken.findUnique({
      where: {
        tokenHash: hashPasswordResetToken(input.token),
      },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        usedAt: true,
        user: {
          select: {
            status: true,
          },
        },
      },
    });

    if (!passwordResetToken || passwordResetToken.usedAt) {
      throw new AuthServiceError("RESET_TOKEN_INVALID");
    }

    if (passwordResetToken.user.status === "DISABLED") {
      throw new AuthServiceError("USER_DISABLED");
    }

    if (passwordResetToken.expiresAt.getTime() <= Date.now()) {
      throw new AuthServiceError("RESET_TOKEN_EXPIRED");
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: {
          id: passwordResetToken.userId,
        },
        data: {
          passwordHash,
        },
      });

      await tx.passwordResetToken.update({
        where: {
          id: passwordResetToken.id,
        },
        data: {
          usedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: passwordResetToken.userId,
          actionType: "PASSWORD_RESET_COMPLETED",
          resourceType: "PASSWORD_RESET_TOKEN",
          resourceId: passwordResetToken.id,
        },
      });
    });

    return {
      userId: passwordResetToken.userId,
    };
  }
}

export const authService = new AuthService();
