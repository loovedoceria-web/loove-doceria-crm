import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import Pedido from "./Pedido.jsx";
import "./theme.css";

// /pedido é a página pública do QR Code; o resto é o CRM (com login)
const isPedido = window.location.pathname.replace(/\/+$/, "").toLowerCase() === "/pedido";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>{isPedido ? <Pedido /> : <App />}</React.StrictMode>
);
