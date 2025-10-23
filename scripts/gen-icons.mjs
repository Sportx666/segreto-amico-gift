import sharp from "sharp";

const src = "src/img/logo.png";

await sharp(src).resize(192, 192).toFile("public/android-chrome-192x192.png");
await sharp(src).resize(512, 512).toFile("public/android-chrome-512x512.png");
await sharp(src).resize(180, 180).toFile("public/apple-touch-icon.png");
await sharp(src).resize(48, 48).toFile("public/favicon-48.png");
await sharp(src).resize(32, 32).toFile("public/favicon-32.png");
await sharp(src).resize(16, 16).toFile("public/favicon-16.png");

