import { createClient } from "@supabase/supabase-js";

const requiredEnv = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "PRATIX_MIGRATION_USER_ID",
  "PRATIX_MIGRATION_USER_EMAIL",
  "PRATIX_MIGRATION_TEMP_PASSWORD",
];

const missingEnv = requiredEnv.filter((name) => !process.env[name]);

if (missingEnv.length > 0) {
  console.error(`Missing required env vars: ${missingEnv.join(", ")}`);
  process.exit(1);
}

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const userId = process.env.PRATIX_MIGRATION_USER_ID;
const email = process.env.PRATIX_MIGRATION_USER_EMAIL;
const password = process.env.PRATIX_MIGRATION_TEMP_PASSWORD;
const fullName = process.env.PRATIX_MIGRATION_FULL_NAME ?? "";

const { data, error } = await admin.auth.admin.createUser({
  id: userId,
  email,
  password,
  email_confirm: true,
  user_metadata: fullName ? { full_name: fullName } : undefined,
});

if (error) {
  console.error(error.message);
  process.exit(1);
}

console.log(`Created Supabase auth user ${data.user.id}`);

const { data: recovery, error: recoveryError } = await admin.auth.admin.generateLink({
  type: "recovery",
  email,
});

if (recoveryError) {
  console.error(recoveryError.message);
  process.exit(1);
}

console.log("Generated recovery link. Open it once to set the final password:");
console.log(recovery.properties.action_link);
