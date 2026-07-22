import { NextResponse } from "next/server";
import { z } from "zod";
import { LOCALE_COOKIE, SUPPORTED_LOCALES } from "@/i18n/config";

const localeSchema = z.object({ locale: z.enum(SUPPORTED_LOCALES) }).strict();

export async function POST(request: Request) {
  const parsed = localeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "invalid_locale" }, { status: 400 });
  const response = NextResponse.json({ locale: parsed.data.locale });
  response.cookies.set(LOCALE_COOKIE, parsed.data.locale, {
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
