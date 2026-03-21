import NextAuth, {
  type DefaultSession,
  type NextAuthOptions,
  getServerSession,
} from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { loginSchema } from "@/lib/validations/auth";
import { authService } from "@/services/auth-service";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      status: string;
    };
  }

  interface User {
    status?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    status?: string;
  }
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "邮箱", type: "email" },
        password: { label: "密码", type: "password" },
      },
      async authorize(credentials) {
        const parsedCredentials = loginSchema.safeParse(credentials);

        if (!parsedCredentials.success) {
          return null;
        }

        try {
          return await authService.verifyCredentials(
            parsedCredentials.data.email,
            parsedCredentials.data.password,
          );
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.status = user.status ?? "ACTIVE";
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.status =
          typeof token.status === "string" ? token.status : "ACTIVE";
      }

      return session;
    },
  },
};

export function getAuthSession() {
  return getServerSession(authOptions);
}

export const nextAuthHandler = NextAuth(authOptions);
