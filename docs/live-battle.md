# Live vs Battle (UI \u0026 Stare)

## Principiu
- Interfața de Live rămâne baza: top bar + chat (overlay) rămân vizibile și funcționale.
- Battle este un overlay peste zona principală de conținut (video), cu tranziție fade de 300ms.

## Comutare moduri
- Activare battle: URL conține `?battle=1`.
- Ieșire battle: `battle` este eliminat din URL.
- Comutarea este SPA (fără refresh).

## Ce rămâne vizibil în Battle
- Top bar: rămâne vizibil și clickable.
- Chat principal: rămâne vizibil (ChatOverlay), inclusiv butonul de Like pe mesaje.
- Battle overlay: acoperă doar zona de conținut principal.

## Evenimente de tranziție
Aplicația emite evenimente pe `window`:
- `beforeEnterBattle`
- `afterEnterBattle` (după 300ms)
- `beforeExitBattle`
- `afterExitBattle` (după 300ms)

Exemplu de ascultare:

```ts
window.addEventListener('beforeEnterBattle', (e) => {
  console.log('beforeEnterBattle', (e as CustomEvent).detail);
});
```

## Implementare (fișiere)
- `src/contexts/LiveModeContext.tsx`: state pentru moduri + emitere evenimente.
- `src/components/BattleOverlay.tsx`: UI battle.
- `src/pages/LiveStream.tsx`: sincronizare URL, render overlay (lazy) + fade.

