import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigError = !url || !anonKey ? "Thiếu cấu hình kết nối Supabase." : null;

export const supabase = createClient(url || "https://missing-supabase-config.invalid", anonKey || "missing-supabase-config", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export async function invokeFunction<T>(
  name: string,
  body: Record<string, unknown>,
  accessToken?: string,
) {
  const { data, error } = await supabase.functions.invoke<T>(name, {
    body,
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
  if (error) {
    let message = "Không thể hoàn tất yêu cầu. Vui lòng thử lại.";
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx) {
        const json = (await ctx.json()) as { error?: string };
        if (json?.error) message = json.error;
      }
    } catch {
      /* keep default */
    }
    throw new Error(message);
  }
  return data;
}
