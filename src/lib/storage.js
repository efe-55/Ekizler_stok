import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Supabase bağlantı bilgileri eksik. .env dosyasına VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY ekleyin (bkz. README.md)."
  );
}

export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "");

// Bu obje, Claude artifact ortamındaki window.storage.get/set API'siyle BİREBİR aynı şekli taklit eder.
// Böylece uygulamanın geri kalan tüm kodu (App.jsx) hiç değişmeden çalışmaya devam eder.
// Not: Bu tek-şirketlik (single-tenant) bir sistem olduğu için "shared" parametresi yok sayılır —
// tüm veri, herkesin gördüğü tek bir ortak veritabanında tutulur (zaten istenen budur).
export const storage = {
  async get(key) {
    const { data, error } = await supabase.from("kv_store").select("value").eq("key", key).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("not found");
    return { key, value: JSON.stringify(data.value) };
  },
  async set(key, value) {
    const parsed = JSON.parse(value);
    const { error } = await supabase.from("kv_store").upsert({ key, value: parsed, updated_at: new Date().toISOString() });
    if (error) throw error;
    return { key, value };
  },
};
