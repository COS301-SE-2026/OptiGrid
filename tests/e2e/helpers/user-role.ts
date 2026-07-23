type TestRole = "ADMIN" | "BUILDING_MANAGER";

/**
 * E2E setup runs against an isolated local Supabase database. Public signup
 * intentionally always creates a Viewer, so privileged UI flows must promote
 * their seeded account directly in that isolated database.
 */
export async function promoteE2EUser(email: string, role: TestRole): Promise<void> {
  const { default: prisma } = await import("../../../backend/core/src/lib/prisma");

  await prisma.user.update({
    where: { email },
    data: { roleType: role },
  });
}
