import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const assets=path.join(root,"app/src/main/assets");
const modelDir=path.join(assets,"models/quaternius");

function bundledRuntime(){
  const bundle=fs.readFileSync(path.join(assets,"game.bundle.js"),"utf8");
  const boundary=bundle.indexOf("const __BAZAAR_SIM__");
  const context={
    console,
    setTimeout,clearTimeout,fetch,Request,Response,Headers,Blob,URL,TextDecoder,TextEncoder,atob,btoa,AbortController,AbortSignal,
    ProgressEvent:class ProgressEvent{constructor(type,values={}){this.type=type;Object.assign(this,values)}},
    CustomEvent:class CustomEvent{},
    document:{createElementNS(){return {style:{},addEventListener(){},removeEventListener(){},getContext(){return null}}}}
  };
  context.window=context;context.self=context;vm.createContext(context);
  vm.runInContext(`${bundle.slice(0,boundary)}\nglobalThis.__RIG_TEST__={THREE,GLTFLoader,cloneSkinnedCharacter,bufferFromBase64(value){const raw=atob(value),bytes=new Uint8Array(raw.length);for(let index=0;index<raw.length;index++)bytes[index]=raw.charCodeAt(index);return bytes.buffer}};`,context,{timeout:10000});
  return context.__RIG_TEST__;
}

function parse(loader,data){
  return new Promise((resolve,reject)=>loader.parse(data,"",resolve,reject));
}

function embeddedModel(name){
  const file=path.join(modelDir,name),json=JSON.parse(fs.readFileSync(file,"utf8"));
  const bin=fs.readFileSync(path.join(modelDir,json.buffers[0].uri));
  json.buffers[0].uri=`data:application/octet-stream;base64,${bin.toString("base64")}`;
  delete json.images;delete json.textures;delete json.samplers;
  for(const material of json.materials||[]){
    delete material.normalTexture;delete material.occlusionTexture;delete material.emissiveTexture;
    if(material.pbrMetallicRoughness){delete material.pbrMetallicRoughness.baseColorTexture;delete material.pbrMetallicRoughness.metallicRoughnessTexture}
  }
  return JSON.stringify(json);
}

test("bundled GLTF runtime loads, clones and animates the shipped rigged characters",async()=>{
  const {THREE,GLTFLoader,cloneSkinnedCharacter,bufferFromBase64}=bundledRuntime(),loader=new GLTFLoader();
  const male=await parse(loader,embeddedModel("Superhero_Male_FullBody.gltf"));
  const female=await parse(loader,embeddedModel("Superhero_Female_FullBody.gltf"));
  const glb=fs.readFileSync(path.join(modelDir,"UAL1_Standard.glb"));
  const animations=await parse(loader,bufferFromBase64(glb.toString("base64")));
  for(const loaded of [male,female]){
    assert.ok(loaded.scene.getObjectByName("hand_l"));
    assert.ok(loaded.scene.getObjectByName("hand_r"));
    assert.ok(loaded.scene.getObjectByProperty("isSkinnedMesh",true));
  }
  const clone=cloneSkinnedCharacter(male.scene),clip=animations.animations.find(item=>item.name==="Walk_Loop");
  assert.ok(clip);assert.notEqual(clone,male.scene);
  const mixer=new THREE.AnimationMixer(clone),action=mixer.clipAction(clip,clone);action.play();mixer.update(.25);
  clone.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(clone);
  assert.ok(Number.isFinite(bounds.min.x)&&Number.isFinite(bounds.max.y));
  assert.ok(bounds.max.y>bounds.min.y);
  assert.equal(action.isRunning(),true);
});
