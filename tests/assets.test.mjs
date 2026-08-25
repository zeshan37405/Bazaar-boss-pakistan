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
const activity=fs.readFileSync(path.join(root,"app/src/main/java/com/zeeshan/bazaarboss/MainActivity.java"),"utf8");

function dictionary(){
  const context={window:{}};vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(assets,"translations.js"),"utf8"),context);
  return context.window.BAZAAR_TEXT;
}

test("Android entry page uses only packaged assets",()=>{
  const refs=[...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match=>match[1]);
  assert.ok(refs.includes("boot.js"));
  assert.ok(refs.includes("game.bundle.js"));
  assert.ok(!html.includes('type="module"'));
  for(const ref of refs){
    assert.ok(!/^https?:/.test(ref),`external asset ${ref}`);
    assert.ok(fs.existsSync(path.join(assets,ref)),`missing asset ${ref}`);
  }
});

test("Android serves packaged assets from a secure same-origin URL",()=>{
  assert.ok(activity.includes("WebViewAssetLoader"));
  assert.ok(activity.includes("https://appassets.androidplatform.net/assets/index.html"));
  assert.ok(!activity.includes('loadUrl("file:///android_asset/index.html")'));
  assert.ok(activity.includes("settings.setAllowFileAccess(false)"));
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
  assert.ok(bundle.includes("Latif Ghee"));
  assert.ok(bundle.includes("dispatchTruck"));
  assert.ok(bundle.includes("salesFund"));
  assert.ok(!/^\s*import\s/m.test(bundle));
  assert.ok(!/^\s*export\s/m.test(bundle));
  assert.ok(fs.readFileSync(path.join(assets,"THREE-LICENSE.txt"),"utf8").includes("MIT License"));
});

test("the bundled Three.js runtime executes with valid imported aliases",()=>{
  const boundary=bundle.indexOf("const __BAZAAR_SIM__");
  assert.ok(boundary>0,"missing simulation bundle boundary");
  const context={
    console:{log(){},warn(){},error(){}},
    document:{createElementNS(){return {style:{},addEventListener(){},removeEventListener(){},getContext(){return null}}}},
    CustomEvent:class CustomEvent{}
  };
  context.window=context;context.self=context;
  vm.createContext(context);
  vm.runInContext(`${bundle.slice(0,boundary)}\nglobalThis.__THREE_TEST__=THREE;`,context,{timeout:5000});
  assert.equal(typeof context.__THREE_TEST__.Scene,"function");
  assert.equal(typeof context.__THREE_TEST__.WebGLRenderer,"function");
  assert.equal(typeof context.__THREE_TEST__.BoxGeometry,"function");
});
