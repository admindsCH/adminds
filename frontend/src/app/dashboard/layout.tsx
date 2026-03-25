"use client";

import { UserButton, useUser } from "@clerk/nextjs";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useUser();
  const displayName = user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() : "Mon compte";

  return (
    <div className="flex min-h-screen flex-col bg-zinc-100 p-2">
      <div className="flex flex-1 flex-col rounded-lg bg-white shadow-xs ring-1 ring-zinc-950/5">
        {/* Account — top bar */}
        <div className="border-b border-zinc-950/5 px-6 py-4 lg:px-10">
          <div className="flex items-center gap-3">
            <UserButton
              appearance={{ elements: { avatarBox: "size-8" } }}
            />
            <span className="text-sm text-zinc-500">{displayName}</span>
          </div>
        </div>

        {/* Page content */}
        <div className="flex-1 p-6 lg:p-10">
          <div className="mx-auto max-w-5xl">{children}</div>
        </div>
      </div>
    </div>
  );
}
