"use strict";

(() => {
  let failed=false;

  function showFailure(code,error){
    if(failed||window.__BAZAAR_GAME_READY__)return;
    failed=true;
    const render=()=>{
      const loading=document.getElementById("loading");
      const start=document.getElementById("startOverlay");
      const fatal=document.getElementById("webglError");
      const detail=document.getElementById("fatalDetail");
      if(loading)loading.classList.add("hidden");
      if(start)start.classList.add("hidden");
      if(detail)detail.textContent=`Error code: ${code}${error&&error.message?` • ${error.message}`:""}`;
      if(fatal)fatal.classList.remove("hidden");
    };
    if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",render,{once:true});
    else render();
  }

  window.__BAZAAR_BOOT_FAIL__=showFailure;
  window.addEventListener("error",event=>showFailure("SCRIPT_RUNTIME",event.error||new Error(event.message||"Runtime error")));
  window.addEventListener("unhandledrejection",event=>showFailure("ASYNC_RUNTIME",event.reason instanceof Error?event.reason:new Error(String(event.reason||"Promise rejected"))));

  document.addEventListener("DOMContentLoaded",()=>{
    const retry=document.getElementById("retryBtn");
    if(retry)retry.addEventListener("click",()=>window.location.reload());
    window.setTimeout(()=>{
      if(!window.__BAZAAR_GAME_READY__)showFailure("STARTUP_TIMEOUT",new Error("3D engine did not become ready"));
    },15000);
  },{once:true});
})();
