// Small standard ZIP writer (stored entries); no shell or external dependencies.
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "module.json"), "utf8"));
const files = ["module.json", "README.md"];
function walk(relative) {
  for (const entry of fs.readdirSync(path.join(root, relative), {withFileTypes: true})) {
    const name = `${relative}/${entry.name}`;
    if (entry.isDirectory()) walk(name); else files.push(name);
  }
}
for (const directory of ["scripts", "styles", "assets"]) walk(directory);
function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
const contents = [], central = [];
let offset = 0;
for (const relative of files) {
  const name = Buffer.from(`${manifest.id}/${relative}`, "utf8");
  const data = fs.readFileSync(path.join(root, relative));
  const crc = crc32(data);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x800, 6);
  local.writeUInt16LE(33, 12); local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26);
  contents.push(local, name, data);
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0); header.writeUInt16LE(20, 4); header.writeUInt16LE(20, 6);
  header.writeUInt16LE(0x800, 8); header.writeUInt16LE(33, 14); header.writeUInt32LE(crc, 16);
  header.writeUInt32LE(data.length, 20); header.writeUInt32LE(data.length, 24);
  header.writeUInt16LE(name.length, 28); header.writeUInt32LE(offset, 42);
  central.push(header, name); offset += local.length + name.length + data.length;
}
const directory = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
fs.mkdirSync(path.join(root, "dist"), {recursive: true});
const destination = path.join(root, "dist", `${manifest.id}-v${manifest.version}.zip`);
fs.writeFileSync(destination, Buffer.concat([...contents, directory, end]));
console.log(destination);

