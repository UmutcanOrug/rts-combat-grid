import {THEMES, ASSETS, escape as e, slotView, statView} from "./core.mjs";
const image = (src,alt="",css="") => `<img src="${e(src)}" alt="${e(alt)}" class="${css}" draggable="false">`;
export function renderPanel(controller) {
  const {token,config,page,editing,pinned}=controller, actor=token.actor;
  const stats=statView(actor), selected=config.pages[page];
  const portrait=config.portrait || actor.img || token.document.texture?.src;
  const slots=Array.from({length:config.columns*config.rows},(_,i)=>{
    const slot=selected.slots[i], view=slotView(slot,actor,game,config.theme);
    return `<button type="button" class="rcg-slot ${view.empty ? "empty" : ""} ${view.active ? "active" : ""} ${view.disabled ? "unavailable" : ""}" data-slot="${i}" ${slot && editing ? 'draggable="true"' : ""} aria-label="${e(view.label)}" aria-disabled="${!editing && (view.empty || view.disabled)}" title="${e(`${view.label}\n${view.hint}${editing ? "\nClick: edit · Drag: move" : "\nRight-click: actions · Shift+click: edit"}`)}">
      <span class="rcg-key">${i+1}</span><span class="rcg-glyph">${e(view.glyph)}</span>${view.icon ? image(view.icon,view.label,"rcg-slot-icon") : ""}<span class="rcg-slot-frame"></span>
      ${view.badge ? `<span class="rcg-ammo">${e(view.badge)}</span>` : ""}${config.labels ? `<span class="rcg-label">${e(view.label)}</span>` : ""}</button>`;
  }).join("");
  return `<header class="rcg-header" data-drag-handle><span class="rcg-signal">▰▰▰</span><span class="rcg-header-title">${config.theme === "coh2" ? "FIELD COMMAND" : "TACTICAL UPLINK"}</span><span class="rcg-header-actions"><button type="button" data-ui="pin" class="${pinned ? "active" : ""}" title="${pinned ? "Unpin token" : "Pin this token"}" aria-label="Pin">⌖</button><button type="button" data-ui="edit" class="${editing ? "active" : ""}" title="Edit buttons" aria-label="Edit buttons">✎</button><button type="button" data-ui="settings" title="Theme and panel settings" aria-label="Panel settings">⚙</button><button type="button" data-ui="close" title="Close (Esc)" aria-label="Close">×</button></span></header>
  <div class="rcg-body"><aside class="rcg-unit"><button type="button" class="rcg-portrait" data-ui="sheet" title="Open character sheet">${portrait ? image(portrait,actor.name) : "◇"}<span class="rcg-portrait-vignette"></span></button>
    <div class="rcg-unit-name">${e(config.title || token.document.name || actor.name)}</div><div class="rcg-unit-role">${actor.system?.wildcard ? "★ WILD CARD" : "FIELD UNIT"}</div>
    <div class="rcg-stats"><span title="Parry">PAR <b>${e(stats.parry)}</b></span><span title="Toughness">TGH <b>${e(stats.toughness)}</b></span></div>
    <div class="rcg-health" title="Wounds"><span>WND</span><div>${Array.from({length:Math.min(12,Number(actor.system?.wounds?.max) || 3)},(_,i)=>`<i class="${i<Number(actor.system?.wounds?.value) ? "spent" : ""}"></i>`).join("")}</div><b>${e(stats.wounds)}</b></div>
    <div class="rcg-resources"><span title="Fatigue">F <b>${e(stats.fatigue)}</b></span><span title="Bennies">★ <b>${e(stats.bennies)}</b></span><span title="Power Points">ϟ <b>${e(stats.pp)}</b></span></div>
  </aside><main class="rcg-command-area"><nav class="rcg-tabs" aria-label="Command pages">${config.pages.map((p,i)=>`<button type="button" data-page="${i}" class="${i===page ? "active" : ""}" aria-pressed="${i===page}">${e(p.name)}</button>`).join("")}</nav>
  <div class="rcg-command-strip">${[["sheet","▤","Sheet"],["run","➜","Run"],["spirit","◉","Spirit"],["vigor","✚","Vigor"],["target","⌖","Target"]].map(([ref,glyph,label])=>`<button type="button" data-command="${ref}" title="${label}">${glyph}<span>${label}</span></button>`).join("")}</div>
  <div class="rcg-grid" role="group" aria-label="${e(selected.name)}">${slots}</div>
  <footer class="rcg-footer"><span>${editing ? "EDIT MODE · Click / drag" : "LEFT CLICK · Use    RIGHT CLICK · Actions"}</span><span>${e(THEMES[config.theme])}</span></footer></main></div><div class="rcg-feedback" role="status" aria-live="polite"></div>`;
}
