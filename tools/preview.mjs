import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webp':'image/webp','.svg':'image/svg+xml'};
http.createServer((req,res)=>{
  let rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1);
  if(!rel)rel='tests/preview.html';if(rel.startsWith('modules/rts-combat-grid/'))rel=rel.slice('modules/rts-combat-grid/'.length);
  const file=path.resolve(root,rel);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  try{res.writeHead(200,{'Content-Type':types[path.extname(file)] ?? 'text/plain','Cache-Control':'no-store'}).end(fs.readFileSync(file));}catch{res.writeHead(404).end();}
}).listen(4176,'127.0.0.1',()=>console.log('RTS grid preview: http://127.0.0.1:4176'));
