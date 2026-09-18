import {mkdir,copyFile} from 'node:fs/promises';
await mkdir('public',{recursive:true});
for(const file of ['index.html','style.css','app.js','video.js','scratch.js','scene.js','penguin-studio.png','pip-cutout.png','analytics.js','generic-cover.svg','social-preview.png','favicon-32.png','icon-192.png','apple-touch-icon.png'])await copyFile(file,`public/${file}`);
