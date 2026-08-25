import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const assets=path.join(root,"app/src/main/assets");
const read=name=>fs.readFileSync(path.join(assets,name),"utf8");

function specifiers(source){
  return source.split(",").map(part=>part.trim()).filter(Boolean).map(part=>{
    const match=part.match(/^([\w$]+)\s+as\s+([\w$]+)$/);
    return match?{local:match[1],exported:match[2]}:{local:part,exported:part};
  });
}

function objectEntries(entries,source=""){
  return entries.map(({local,exported})=>`${JSON.stringify(exported)}:${source}${local}`).join(",");
}

function bundleCore(){
  let source=read("three.core.min.js");
  const match=source.match(/export\{([^}]*)\};?\s*$/s);
  if(!match)throw new Error("Could not locate the Three.js core exports");
  const exports=specifiers(match[1]);
  source=source.slice(0,match.index);
  return {code:`const __THREE_CORE__=(()=>{${source}\nreturn {${objectEntries(exports)}};})();`,exports};
}

function bundleThree(){
  let source=read("three.module.min.js");
  const importMatch=source.match(/^([\s\S]*?)import\{([^}]*)\}from"\.\/three\.core\.min\.js";/);
  if(!importMatch)throw new Error("Could not locate the Three.js module import");
  const license=importMatch[1];
  const imports=specifiers(importMatch[2]);
  source=source.slice(importMatch[0].length);
  const reexportMatch=source.match(/^export\{([^}]*)\}from"\.\/three\.core\.min\.js";/);
  if(!reexportMatch)throw new Error("Could not locate the Three.js re-exports");
  const reexports=specifiers(reexportMatch[1]);
  source=source.slice(reexportMatch[0].length);
  const finalMatch=source.match(/export\{([^}]*)\};?\s*$/s);
  if(!finalMatch)throw new Error("Could not locate the Three.js module exports");
  const exports=specifiers(finalMatch[1]);
  source=source.slice(0,finalMatch.index);
  // ESM `import { Matrix3 as e }` must become `{ Matrix3: e }` when the
  // imported bindings are reconstructed from the core export object.
  // Reversing this mapping leaves Three.js' minified locals undefined and the
  // Android WebView stops before it can attach the Start button handler.
  const aliases=imports.map(({local,exported})=>`${local}:${exported}`).join(",");
  const all=[...reexports.map(entry=>({...entry,fromCore:true})),...exports.map(entry=>({...entry,fromCore:false}))];
  const entries=all.map(entry=>`${JSON.stringify(entry.exported)}:${entry.fromCore?`__THREE_CORE__.${entry.local}`:entry.local}`).join(",");
  return `${license}const THREE=(()=>{const {${aliases}}=__THREE_CORE__;${source}\nreturn {${entries}};})();`;
}

function bundleSimulation(){
  let source=read("sim.js");
  const names=[];
  source=source.replace(/\bexport\s+(const|function)\s+(\w+)/g,(_,kind,name)=>{names.push(name);return `${kind} ${name}`});
  return `const __BAZAAR_SIM__=(()=>{${source}\nreturn {${[...new Set(names)].join(",")}};})();`;
}

function bundleGame(){
  let source=read("game.js");
  source=source.replace(/^import \* as THREE from "\.\/three\.module\.min\.js";\s*/m,"");
  const match=source.match(/^import \{([\s\S]*?)\} from "\.\/sim\.js";\s*/m);
  if(!match)throw new Error("Could not locate the game simulation import");
  source=source.replace(match[0],`const {${match[1]}}=__BAZAAR_SIM__;\n`);
  return source;
}

const core=bundleCore();
const output=`${core.code}\n${bundleThree()}\n${bundleSimulation()}\n${bundleGame()}`.trimEnd()+"\n";
fs.writeFileSync(path.join(assets,"game.bundle.js"),output);
console.log(`Built game.bundle.js (${Buffer.byteLength(output).toLocaleString("en-US")} bytes)`);
