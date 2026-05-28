# Play Money ADMIN v4

Light theme + Mobile responsive + PWA installabile.

## 🚀 Setup rapido

```bash
npm install
npm run dev
```

App parte su `http://localhost:5173`.

## 📱 Test mobile / PWA

### Test in browser (modalità sviluppo)
1. Apri `http://localhost:5173`
2. Premi `F12` → click sull'icona "Toggle device toolbar" (o `Ctrl+Shift+M`)
3. Scegli iPhone 14 Pro / Pixel 7 / etc.
4. Ricarica

### Test PWA installabile (build produzione)
```bash
npm run build
npm run preview
```
Apre su `http://localhost:4173`. Su Chrome desktop apparirà un'icona "install" nella barra URL. Su mobile, dopo qualche secondo, prompt "Aggiungi a schermata home".

### Test su iPhone reale
1. Apri Safari su iPhone all'indirizzo del PC (es. `http://192.168.1.X:4173`) — assicurati che `npm run preview -- --host` esponga sulla rete locale
2. Tap su "Condividi" → "Aggiungi a Home" → "Aggiungi"
3. L'app sarà installata come app nativa standalone

## 🗂️ Cosa c'è di nuovo in v4

### Mobile
- ✅ Sidebar trasformata in **drawer** scorrevole su mobile (< 768px)
- ✅ **Topbar fissa** mobile con menu hamburger + titolo pagina + search
- ✅ Tutte le **tabelle** convertite in **card stack** su mobile
- ✅ **Modal fullscreen** mobile vs centered desktop
- ✅ **Touch targets** ingranditi (h-9 vs h-8 desktop)
- ✅ Input font-size 16px su mobile per evitare zoom iOS
- ✅ **Filtri in Modal** su mobile (bottone "Filtri") vs inline desktop
- ✅ Safe-area iOS rispettata (notch, home indicator)
- ✅ **No bounce** scroll, no zoom su double-tap

### PWA
- ✅ `vite-plugin-pwa` configurato con autoUpdate
- ✅ Manifest light theme (`#1F2937` sidebar, `#FFFFFF` bg)
- ✅ Icone 192x192 e 512x512 maskable
- ✅ Service worker con cache `NetworkFirst` su Supabase
- ✅ Offline fallback su asset statici
- ✅ Meta Apple per iOS standalone

## 📝 Migration database (una tantum)

Esegui in Supabase SQL Editor:
```sql
-- migrations/01_soft_delete.sql
```
Aggiunge la colonna `deleted_at` a `movements_cassa` per il Cestino.

## 🔑 Variabili ambiente

`.env` (già presente):
```
VITE_SUPABASE_URL=https://ufkgncqqvqgynncswkiv.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

## ⌨️ Scorciatoie (solo desktop)

| Tasto | Azione |
|-------|--------|
| `⌘K` / `Ctrl+K` | Apri Command Palette |
| `⌘B` / `Ctrl+B` | Comprimi sidebar |
| `C` | Cassa |
| `A` | Agenti |
| `L` | Locali |
| `N` | Analisi |
| `M` | Automezzi |
| `T` | Cestino |
| `D` | Admin |

## 🏗️ Build per deploy

```bash
npm run build
```
Genera la cartella `dist/` pronta per Vercel / Netlify / qualsiasi static hosting. Include `sw.js` (service worker), `manifest.webmanifest`, e tutte le icone PWA.
