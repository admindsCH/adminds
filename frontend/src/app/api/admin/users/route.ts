import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const ADMIN_USER_IDS = new Set([
  "user_3Af5l4EYpIW94urqgVbtX9dQUNK",
  "user_3AfGjH8PKMVnlv5gyDnMKVKAoG1",
  "user_3AepyhdzQBxM9XXIu4SFUsuLeeL",
]);

/**
 * GET /api/admin/users?ids=user_abc,user_def
 * Returns a map of user_id -> { email, name } from Clerk.
 * Admin-only.
 */
export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId || !ADMIN_USER_IDS.has(userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const ids = (searchParams.get("ids") ?? "").split(",").filter(Boolean);
  if (ids.length === 0) {
    return NextResponse.json({});
  }

  const client = await clerkClient();
  const users: Record<string, { email: string; name: string }> = {};

  const { data } = await client.users.getUserList({ userId: ids, limit: 100 });
  for (const u of data) {
    users[u.id] = {
      email: u.emailAddresses[0]?.emailAddress ?? "—",
      name: `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || "—",
    };
  }

  return NextResponse.json(users);
}
