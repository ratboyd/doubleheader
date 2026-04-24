// public/auth.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL  = "https://govcexcjxbkshsnsrnqf.supabase.co";
const SUPABASE_ANON = "sb_publishable_jSFOAreU6W7uvlZlYW_HiA_nEpVLQVH";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    redirectTo: "https://stellular-centaur-f0a42b.netlify.app/auth/callback",
    persistSession: true,
  },
});

let currentUser = null;
export function getUser() { return currentUser; }

export async function initAuth({ onLogin, onLogout }) {
  const { data } = await supabase.auth.getSession();
  currentUser = data?.session?.user ?? null;

  supabase.auth.onAuthStateChange((_event, session) => {
    const prev = currentUser;
    currentUser = session?.user ?? null;
    if (currentUser && !prev) onLogin(currentUser);
    if (!currentUser && prev) onLogout();
    updateAuthUI();
  });

  updateAuthUI();
  if (currentUser) onLogin(currentUser);
}

function updateAuthUI() {
  const pill = document.getElementById("auth-pill");
  if (!pill) return;
  if (currentUser) {
    const email = currentUser.email || "";
    const initial = email[0]?.toUpperCase() || "?";
    pill.innerHTML = `
      <span class="auth-avatar">${initial}</span>
      <span class="auth-email">${email}</span>
      <button class="auth-signout" id="auth-signout-btn">Sign out</button>`;
    document.getElementById("auth-signout-btn")?.addEventListener("click", signOut);
  } else {
    pill.innerHTML = `<button class="auth-login-btn" id="auth-open-modal">Log in</button>`;
    document.getElementById("auth-open-modal")?.addEventListener("click", openModal);
  }
}

export function openModal() {
  document.getElementById("auth-modal")?.classList.remove("hidden");
}

function closeModal() {
  document.getElementById("auth-modal")?.classList.add("hidden");
  document.getElementById("auth-error")?.classList.add("hidden");
}

export function bindModalControls() {
  document.getElementById("auth-modal-close")?.addEventListener("click", closeModal);
  document.getElementById("auth-modal")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeModal();
  });

  document.getElementById("auth-google-btn")?.addEventListener("click", async () => {
    await supabase.auth.signInWithOAuth({ provider: "google" });
  });

  const emailInput = document.getElementById("auth-email-input");
  const sendBtn    = document.getElementById("auth-send-link");
  const emailStep  = document.getElementById("auth-email-step");
  const confirmMsg = document.getElementById("auth-confirm-msg");

  sendBtn?.addEventListener("click", async () => {
    const email = emailInput?.value?.trim();
    if (!email || !email.includes("@")) { showAuthError("Enter a valid email address."); return; }
    sendBtn.disabled = true;
    sendBtn.textContent = "Sending...";
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) {
      showAuthError(error.message);
      sendBtn.disabled = false;
      sendBtn.textContent = "Send magic link";
    } else {
      emailStep?.classList.add("hidden");
      confirmMsg?.classList.remove("hidden");
    }
  });
}

function showAuthError(msg) {
  const el = document.getElementById("auth-error");
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("hidden");
}

export async function signOut() { await supabase.auth.signOut(); }

export async function loadPreferences() {
  if (!currentUser) return null;
  const { data, error } = await supabase
    .from("user_preferences")
    .select("*")
    .eq("user_id", currentUser.id)
    .single();
  if (error && error.code !== "PGRST116") console.warn("prefs load:", error.message);
  return data || null;
}

export async function savePreferences(prefs) {
  if (!currentUser) return;
  const { error } = await supabase
    .from("user_preferences")
    .upsert({ user_id: currentUser.id, ...prefs, updated_at: new Date().toISOString() }, {
      onConflict: "user_id",
    });
  if (error) console.warn("prefs save:", error.message);
}
