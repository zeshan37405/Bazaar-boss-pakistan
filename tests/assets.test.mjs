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
  for(const texture of ["floor-terrazzo.webp","wall-plaster.webp","shelf-wood.webp","road-asphalt.webp"]){
    assert.ok(fs.existsSync(path.join(assets,"textures",texture)),`missing texture ${texture}`);
  }
  assert.ok(fs.readFileSync(path.join(assets,"models/quaternius/QUATERNIUS-CC0-NOTICE.txt"),"utf8").includes("CC0"));
  assert.ok(html.includes("img-src 'self' data:"));
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
  assert.ok(bundle.includes("2026-08-20"));
  assert.ok(bundle.includes("shopping-basket"));
  assert.ok(bundle.includes("shopping-trolley"));
  assert.ok(bundle.includes("cloneSkinnedCharacter"));
  assert.ok(bundle.includes("Superhero_Male_FullBody.gltf"));
  assert.ok(game.includes("function loadCharacterAssets"));
  assert.ok(game.includes("function resolvePeopleOverlaps"));
  assert.ok(game.includes("beginScreenMovement"));
  assert.ok(bundle.includes("queueWait"));
  assert.ok(bundle.includes("Latif Banaspati Ghee"));
  assert.ok(bundle.includes("dispatchTruck"));
  assert.ok(bundle.includes("startUnloading"));
  assert.ok(game.includes('t("pleaseGiveWay")'));
  assert.equal(dictionary().en.pleaseGiveWay,"Please give way");
  assert.ok(game.includes("function positionBlocked"));
  assert.ok(game.includes("function updateOwnerCheckout"));
  assert.ok(html.includes('id="truckBtn"'));
  assert.ok(html.includes('class="joystick dynamic"'));
  assert.ok(bundle.includes("salesFund"));
  assert.ok(bundle.includes("restockerTransfer"));
  assert.ok(bundle.includes("priceAcceptanceChance"));
  assert.ok(!/^\s*import\s/m.test(bundle));
  assert.ok(!/^\s*export\s/m.test(bundle));
  assert.ok(fs.readFileSync(path.join(assets,"THREE-LICENSE.txt"),"utf8").includes("MIT License"));
});

test("rigged male and female models share the animation skeleton and required actions",()=>{
  const modelDir=path.join(assets,"models","quaternius");
  const male=JSON.parse(fs.readFileSync(path.join(modelDir,"Superhero_Male_FullBody.gltf"),"utf8"));
  const female=JSON.parse(fs.readFileSync(path.join(modelDir,"Superhero_Female_FullBody.gltf"),"utf8"));
  const animationBuffer=fs.readFileSync(path.join(modelDir,"UAL1_Standard.glb"));
  let offset=12,animationJson=null;
  while(offset<animationBuffer.length){
    const length=animationBuffer.readUInt32LE(offset),type=animationBuffer.toString("ascii",offset+4,offset+8);
    if(type.startsWith("JSON"))animationJson=JSON.parse(animationBuffer.toString("utf8",offset+8,offset+8+length).replace(/\0+$/,""));
    offset+=8+length;
  }
  assert.ok(animationJson,"missing animation JSON chunk");
  const requiredBones=["root","pelvis","spine_01","Head","hand_l","hand_r","foot_l","foot_r"];
  for(const model of [male,female]){
    const names=new Set(model.nodes.map(node=>node.name));
    for(const bone of requiredBones)assert.ok(names.has(bone),`model missing ${bone}`);
    assert.equal(model.skins.length,1);
    for(const image of model.images||[])assert.ok(fs.existsSync(path.join(modelDir,image.uri)),`missing model texture ${image.uri}`);
    for(const buffer of model.buffers||[])assert.ok(fs.existsSync(path.join(modelDir,buffer.uri)),`missing model buffer ${buffer.uri}`);
  }
  const actions=new Set(animationJson.animations.map(animation=>animation.name));
  for(const action of ["Idle_Loop","Walk_Loop","Sprint_Loop","Push_Loop","PickUp_Table","Interact","Sitting_Idle_Loop","Driving_Loop"]){
    assert.ok(actions.has(action),`animation missing ${action}`);
  }
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
