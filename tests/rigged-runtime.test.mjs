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

function bundledGameRuntime(){
  const bundle=fs.readFileSync(path.join(assets,"game.bundle.js"),"utf8");
  const boundary=bundle.lastIndexOf("\ninitialize();");
  assert.ok(boundary>0,"missing game initialization boundary");
  const context={
    console,
    setTimeout,clearTimeout,fetch,Request,Response,Headers,Blob,URL,TextDecoder,TextEncoder,atob,btoa,AbortController,AbortSignal,structuredClone,
    localStorage:{getItem(){return null},setItem(){},removeItem(){}},navigator:{},
    BAZAAR_TEXT:{ur:{},hi:{},en:{}},
    ProgressEvent:class ProgressEvent{constructor(type,values={}){this.type=type;Object.assign(this,values)}},
    CustomEvent:class CustomEvent{},
    document:{createElementNS(){return {style:{},addEventListener(){},removeEventListener(){},getContext(){return null}}}}
  };
  context.window=context;context.self=context;vm.createContext(context);
  vm.runInContext(`${bundle.slice(0,boundary)}
globalThis.__OUTFIT_TEST__={
  THREE,GLTFLoader,
  bufferFromBase64(value){const raw=atob(value),bytes=new Uint8Array(raw.length);for(let index=0;index<raw.length;index++)bytes[index]=raw.charCodeAt(index);return bytes.buffer},
  install(male,female,animations){characterAssets.male=prepareCharacterAsset(male);characterAssets.female=prepareCharacterAsset(female);characterAssets.clips=new Map(animations.map(clip=>[clip.name,clip]));characterAssets.ready=true},
  create(style,gender,kind=0){return createHumanoid(0x426f9a,0xd39a73,false,{style,gender,kind})},
  animate(character,name,delta){setCharacterAction(character,name);character.userData.mixer.update(delta);character.updateMatrixWorld(true)},
  navigateAroundCounter(){
    blockers.length=0;blockers.push({kind:"checkout",minX:5.57,maxX:10.1,minZ:8.12,maxZ:10.82});
    const mesh=new THREE.Group();mesh.position.set(4.45,0,9.35);mesh.userData={collisionRadius:.44,personId:9001,blockedTime:0,avoidance:null};
    const target=new THREE.Vector3(11.1,0,9.35),visited=[];let done=false;
    for(let step=0;step<320&&!done;step++){worldTime+=.05;done=moveToward({mesh,speed:2},target,.11);visited.push(mesh.position.clone())}
    return {done,position:mesh.position.clone(),visited,crossed:visited.some(point=>point.x>5.57&&point.x<10.1&&point.z>8.12&&point.z<10.82)};
  },
  navigateAroundPeople(){
    blockers.length=0;customers.length=0;
    const person=(x,z,id)=>{const mesh=new THREE.Group();mesh.position.set(x,0,z);mesh.userData={collisionRadius:.44,personId:id,blockedTime:0,avoidance:null,customer:{phase:"walking"}};customers.push({mesh,phase:"walking"});return mesh};
    person(.9,0,9101);person(1.25,.58,9102);person(1.25,-.58,9103);
    const mesh=new THREE.Group();mesh.position.set(0,0,0);mesh.userData={collisionRadius:.44,personId:9001,blockedTime:0,avoidance:null,customer:{phase:"walking"}};
    const target=new THREE.Vector3(3,0,0);let done=false;
    for(let step=0;step<320&&!done;step++){worldTime+=.05;done=moveToward({mesh,speed:2},target,.08)}
    return {done,position:mesh.position.clone(),gaveWay:mesh.userData.giveWayUntil>0};
  }
};`,context,{timeout:10000});
  return context.__OUTFIT_TEST__;
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

test("shipped male, female and staff characters wear animated bone-attached outfits",async()=>{
  const runtime=bundledGameRuntime(),loader=new runtime.GLTFLoader();
  const male=await parse(loader,embeddedModel("Superhero_Male_FullBody.gltf"));
  const female=await parse(loader,embeddedModel("Superhero_Female_FullBody.gltf"));
  const glb=fs.readFileSync(path.join(modelDir,"UAL1_Standard.glb"));
  const animations=await parse(loader,runtime.bufferFromBase64(glb.toString("base64")));
  runtime.install(male,female,animations.animations);
  const roles=[["owner","male"],["customer","male"],["customer","female"],["cashier","male"],["restocker","male"],["labourer","male"],["driver","male"],["vendor","male"]];
  for(const [style,gender] of roles){
    const character=runtime.create(style,gender,gender==="female"?1:0),pieces=character.userData.outfit.pieces;
    assert.ok(pieces.length>=13,`${style} ${gender} is missing clothes`);
    assert.ok(pieces.every(piece=>piece.isMesh&&piece.parent?.isBone),`${style} clothes must follow bones`);
    assert.ok(pieces.every(piece=>piece.userData.isCharacterClothing&&piece.userData.role===style));
    for(const name of ["outfit-kameez","outfit-upper-sleeve-l","outfit-upper-sleeve-r","outfit-shalwar-thigh-l","outfit-shalwar-thigh-r","outfit-shoe-l","outfit-shoe-r"]){
      assert.ok(pieces.some(piece=>piece.name===name),`${style} missing ${name}`);
    }
    character.updateMatrixWorld(true);
    const characterBounds=new runtime.THREE.Box3().setFromObject(character);
    assert.ok(characterBounds.max.y-characterBounds.min.y<2.15,`${style} ${gender} is still oversized`);
    const bounds=new runtime.THREE.Box3();for(const piece of pieces)bounds.expandByObject(piece);
    assert.ok(Number.isFinite(bounds.min.y)&&bounds.max.y>bounds.min.y);
    const sleeve=pieces.find(piece=>piece.name==="outfit-upper-sleeve-l"),before=sleeve.getWorldPosition(new runtime.THREE.Vector3());
    runtime.animate(character,"Walk_Loop",.35);
    const after=sleeve.getWorldPosition(new runtime.THREE.Vector3());
    assert.ok(before.distanceTo(after)>.001,`${style} clothes did not follow the walk animation`);
  }
});

test("women's braid is attached behind the head",async()=>{
  const runtime=bundledGameRuntime(),loader=new runtime.GLTFLoader();
  const male=await parse(loader,embeddedModel("Superhero_Male_FullBody.gltf"));
  const female=await parse(loader,embeddedModel("Superhero_Female_FullBody.gltf"));
  const glb=fs.readFileSync(path.join(modelDir,"UAL1_Standard.glb"));
  const animations=await parse(loader,runtime.bufferFromBase64(glb.toString("base64")));
  runtime.install(male,female,animations.animations);
  let braid=[];
  for(let index=0;index<8&&!braid.length;index++)braid=runtime.create("customer","female",0).userData.hair.pieces.filter(piece=>piece.name.startsWith("hair-braid-"));
  assert.equal(braid.length,5);
  assert.ok(braid.every(piece=>piece.position.z<0),"braid segments must sit behind the head, not over the face");
});

test("a character automatically turns and walks around the checkout counter",()=>{
  const result=bundledGameRuntime().navigateAroundCounter();
  assert.equal(result.done,true);
  assert.equal(result.crossed,false,"character crossed through the checkout counter");
  assert.ok(result.position.x>11&&Math.abs(result.position.z-9.35)<.2);
  assert.ok(result.visited.some(point=>point.z<7.7||point.z>11.2),"character never chose a route around the counter");
});

test("a character side-steps around a group of people instead of waiting forever",()=>{
  const result=bundledGameRuntime().navigateAroundPeople();
  assert.equal(result.done,true);assert.ok(result.position.x>2.9);assert.equal(result.gaveWay,true);
});
