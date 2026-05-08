import { spawnSync } from "node:child_process";

const checks = [
  ["npx", ["supabase", "db", "push", "--linked", "--dry-run"]],
  ["npx", ["supabase", "db", "advisors", "--linked", "--type", "security"]],
  ["npx", ["supabase", "db", "advisors", "--linked", "--type", "performance"]],
];

for (const [command, args] of checks) {
  const label = [command, ...args].join(" ");
  console.log(`\n> ${label}`);

  const result = spawnSync(command, args, {
    env: process.env,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
