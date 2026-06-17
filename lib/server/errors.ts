import { NextResponse, type NextRequest } from "next/server";

type PublicError = {
  error: string;
};

export function sanitizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: redactSensitive(error.message)
    };
  }

  return {
    name: "UnknownError",
    message: "Erro desconhecido."
  };
}

export function warnInDevelopment(scope: string, error: unknown) {
  if (process.env.NODE_ENV !== "development") return;

  const sanitized = sanitizeError(error);
  console.warn(`${scope}:`, sanitized);
}

export function safeErrorResponse(message = "Não foi possível concluir a operação.", status = 500) {
  return NextResponse.json<PublicError>({ error: message }, { status });
}

export async function parseJsonBody<T = unknown>(request: NextRequest) {
  try {
    return { ok: true as const, data: (await request.json()) as T };
  } catch {
    return {
      ok: false as const,
      response: safeErrorResponse("JSON inválido ou malformado.", 400)
    };
  }
}

function redactSensitive(value: string) {
  return value
    .replace(/postgresql:\/\/[^@\s]+@/gi, "postgresql://[redacted]@")
    .replace(/(DATABASE_URL|DIRECT_URL|JWT_SECRET|SUPABASE_SERVICE_ROLE_KEY|ADMIN_PASSWORD)=([^\s]+)/gi, "$1=[redacted]")
    .replace(/password=([^&\s]+)/gi, "password=[redacted]");
}
