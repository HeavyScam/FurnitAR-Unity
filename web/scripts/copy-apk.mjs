// Ships the Unity build next to the site so the download link is same-origin.
import { copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const at = (p) => fileURLToPath(new URL(p, import.meta.url));
copyFileSync(at('../../Build/FurnitAR.apk'), at('../dist/FurnitAR.apk'));
console.log('copied FurnitAR.apk');
