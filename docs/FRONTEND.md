# Frontend

React, TypeScript i SCSS bez dodatkowego frameworka UI. Moduły interfejsu znajdują się w `src/renderer/src/features`, komponenty wspólne w `components`. `navigation.ts` zawiera definicje stron, a `App.tsx` koordynuje stan aplikacji i preferencje układu. Zapisy przechodzą przez walidowany kontrakt IPC do SQLite, nie localStorage.

`ResizeHandle` rozdziela podgląd zmiany wymiarów od zapisu po zakończeniu przeciągania. Style motywów i układów znajdują się w `styles/base.scss`.
