// Ponto de entrada da aplicação (entry point do Vite).
// É o único lugar que fala diretamente com o DOM do navegador: pega a div
// #root (declarada em index.html) e monta a árvore React dentro dela.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./style.css"; // único arquivo CSS do projeto — sem CSS Modules/styled-components
import App from "./App.jsx";

// <StrictMode> só ativa em desenvolvimento: faz o React invocar de propósito
// certas funções (corpo de componente, efeitos) duas vezes, para ajudar a
// detectar side-effects impuros. Não afeta o build de produção.
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
