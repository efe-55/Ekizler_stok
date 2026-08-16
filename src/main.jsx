import React from "react";
import ReactDOM from "react-dom/client";
import { storage } from "./lib/storage.js";
import App from "./App.jsx";
import "./index.css";

// App.jsx, Claude artifact ortamındaki `window.storage` API'sini kullanıyor.
// Burada aynı isimle gerçek (Supabase destekli) bir sürümünü tanımlıyoruz ki
// App.jsx içinde HİÇBİR SATIR değişmeden, aynı kod hem Claude'da hem burada çalışsın.
window.storage = storage;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
