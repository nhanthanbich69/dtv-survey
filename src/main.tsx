import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./lib/auth";
import { supabaseConfigError } from "./lib/supabase";
import "./styles.css";

const root = createRoot(document.getElementById("root")!);

if (supabaseConfigError) {
  root.render(
    <div className="auth-page">
      <div className="card auth-card card-pad stack">
        <h1>DTV Survey</h1>
        <p className="error">{supabaseConfigError} Hãy khai báo VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY rồi khởi động lại ứng dụng.</p>
      </div>
    </div>,
  );
} else {
  root.render(
    <StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </StrictMode>,
  );
}
