import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error("Thiếu cấu hình kết nối. Vui lòng liên hệ quản trị viên.");
}

export const supabase = createClient(url, anonKey, {
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
