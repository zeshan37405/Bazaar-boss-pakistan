import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const assets=path.join(root,"app/src/main/assets");
const html=fs.readFileSync(path.join(assets,"index.html"),"utf8");
const game=fs.readFileSync(path.join(assets,"game.js"),"utf8");
const bundle=fs.readFileSync(path.join(assets,"game.bundle.js"),"utf8");

function dictionary(){
  const context={window:{}};vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(assets,"translations.js"),"utf8"),context);
  return context.window.BAZAAR_TEXT;
}

test("Android entry page uses only packaged assets",()=>{
  const refs=[...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match=>match[1]);
  assert.ok(refs.includes("game.bundle.js"));
  assert.ok(!html.includes('type="module"'));
  for(const ref of refs){
    assert.ok(!/^https?:/.test(ref),`external asset ${ref}`);
    assert.ok(fs.existsSync(path.join(assets,ref)),`missing asset ${ref}`);
  }
});

test("every translated HTML label exists in all languages",()=>{
  const text=dictionary();
  const keys=[...html.matchAll(/data-t(?:a)?="([^"]+)"/g)].map(match=>match[1]);
  for(const language of ["ur","hi","en"]){
    for(const key of keys)assert.ok(text[language][key],`${language} missing ${key}`);
  }
});

test("literal translation calls in game logic have dictionary entries",()=>{
  const text=dictionary();
  const keys=[...game.matchAll(/\bt\("([A-Za-z0-9]+)"/g)].map(match=>match[1]);
  for(const key of new Set(keys))assert.ok(text.ur[key],`missing translation ${key}`);
});

test("shipped game is a self-contained classic bundle with the Three.js license",()=>{
  assert.ok(bundle.length>400000);
  assert.ok(bundle.includes("Copyright 2010-2026 Three.js Authors"));
  assert.ok(bundle.includes("2026-07-30"));
  assert.ok(bundle.includes("shopping-basket"));
  assert.ok(bundle.includes("queueWait"));
  assert.ok(!/^\s*import\s/m.test(bundle));
  assert.ok(fs.readFileSync(path.join(assets,"THREE-LICENSE.txt"),"utf8").includes("MIT License"));
});
