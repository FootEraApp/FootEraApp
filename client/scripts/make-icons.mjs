// client/scripts/make-icons.mjs
import fs from "node:fs/promises";
import sharp from "sharp";
import toIco from "to-ico";

const SRC = "public/assets/usuarios/footera-logo.png"; // sua logo
const OUT = "public/";

// Tamanhos PNG
const sizes = [512, 192, 180, 32, 16];
for (const s of sizes) {
  await sharp(SRC)
    .resize(s, s, { fit: "contain", background: { r:255, g:255, b:255, alpha:0 } })
    .png()
    .toFile(`${OUT}icon-${s}.png`);
}

// favicon.ico (16 e 32)
const icoBuf = await toIco([
  await sharp(SRC).resize(16, 16, { fit: "contain", background: { r:255, g:255, b:255, alpha:0 } }).png().toBuffer(),
  await sharp(SRC).resize(32, 32, { fit: "contain", background: { r:255, g:255, b:255, alpha:0 } }).png().toBuffer(),
]);
await fs.writeFile(`${OUT}favicon.ico`, icoBuf);

console.log("Ícones gerados em /client/public/");
