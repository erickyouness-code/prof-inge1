/* Standalone (GitHub Pages) runtime: provides window.claude.use("sample") on top of the
   Anthropic API with the user's own key, stored only in this browser. */
(function(){
"use strict";
const KEY="profinge_api_key";
const MODEL="claude-opus-5-5";
const getKey=()=>{try{return localStorage.getItem(KEY)||""}catch(e){return ""}};
const setKey=v=>{try{v?localStorage.setItem(KEY,v):localStorage.removeItem(KEY)}catch(e){}};

/* ---------- settings dialog ---------- */
function openSettings(reason){
  const root=document.getElementById("modalRoot");if(!root)return;
  const k=getKey();
  root.innerHTML=`<div class="overlay" id="ov"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="stT" style="width:min(520px,100%)">
    <h3 id="stT">Clé API Claude</h3>
    <p class="sub">${reason?reason+" ":""}Ce site appelle Claude avec ta propre clé API Anthropic. Elle reste enregistrée uniquement dans ce navigateur et n'est envoyée qu'à Anthropic.</p>
    <div class="field"><label for="apiKey">Clé API (commence par sk-ant-)</label><input id="apiKey" type="password" autocomplete="off" spellcheck="false" placeholder="sk-ant-api03-…" value="${k.replace(/"/g,"&quot;")}"></div>
    <p class="sub" style="font-size:13.5px">Pour obtenir une clé : crée un compte sur <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com</a>, ajoute du crédit (Billing), puis « Create Key ». Le paiement se fait à l'usage, séparément de l'abonnement Claude.</p>
    <div class="modal-foot"><span class="progress" id="stMsg"></span>${k?'<button class="btn" id="stDel">Supprimer la clé</button>':""}<button class="btn" id="stCancel">Fermer</button><button class="btn primary" id="stSave">Enregistrer</button></div>
  </div></div>`;
  const msg=document.getElementById("stMsg");
  document.getElementById("stCancel").onclick=()=>root.innerHTML="";
  const del=document.getElementById("stDel");if(del)del.onclick=()=>{setKey("");root.innerHTML="";refreshFoot()};
  document.getElementById("stSave").onclick=async()=>{
    const v=document.getElementById("apiKey").value.trim();
    if(!/^sk-ant-/.test(v)){msg.textContent="Cette clé ne ressemble pas à une clé Anthropic (sk-ant-…).";return}
    msg.textContent="Vérification…";
    try{
      const c=new Anthropic({apiKey:v,dangerouslyAllowBrowser:true,maxRetries:0});
      await c.models.retrieve(MODEL);
      setKey(v);root.innerHTML="";refreshFoot();
    }catch(e){
      msg.textContent=e&&e.status===401?"Clé refusée par Anthropic. Vérifie-la et réessaie.":"Impossible de vérifier la clé ("+(e&&e.message||"erreur réseau")+").";
    }
  };
  setTimeout(()=>document.getElementById("apiKey").focus(),50);
}
function refreshFoot(){
  const b=document.getElementById("keyBtn");if(b)b.textContent=getKey()?"Clé API ✓":"Ajouter ma clé API";
}
function mountFoot(){
  const foot=document.querySelector(".rail-foot");if(!foot||document.getElementById("keyBtn"))return;
  const b=document.createElement("button");b.id="keyBtn";b.className="btn";b.style.cssText="margin-left:auto;padding:4px 10px;font-size:12.5px";
  b.onclick=()=>openSettings();foot.appendChild(b);refreshFoot();
}

/* ---------- helpers ---------- */
function blobToB64(blob){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(",")[1]);r.onerror=rej;r.readAsDataURL(blob)})}
const MEDIA=["image/jpeg","image/png","image/gif","image/webp"];
async function toMessages(input,images){
  let msgs=typeof input==="string"?[{role:"user",content:input}]:input.map(m=>({role:m.role,content:m.content}));
  if(images&&images.length){
    const last=msgs[msgs.length-1];
    const blocks=[];
    for(const b of images){
      const mt=MEDIA.includes(b.type)?b.type:"image/jpeg";
      blocks.push({type:"image",source:{type:"base64",media_type:mt,data:await blobToB64(b)}});
    }
    blocks.push({type:"text",text:last.content});
    msgs[msgs.length-1]={role:"user",content:blocks};
  }
  return msgs;
}
function mapError(e){
  if(e&&e.code)return e;
  const st=e&&e.status;
  if(e instanceof Anthropic.APIUserAbortError||(e&&e.name==="AbortError"))return {code:"cancelled",message:"aborted"};
  if(st===401)return {code:"not_granted",message:"401",userMessage:"Ta clé API est refusée. Vérifie-la avec le bouton « Clé API » en bas du menu."};
  if(st===403)return {code:"not_granted",message:"403",userMessage:"Ta clé API n'a pas accès à ce modèle."};
  if(st===429)return {code:"rate_limited",message:"429",userMessage:"Trop de demandes en même temps. Réessaie dans une minute."};
  if(st===400&&/credit|balance|billing/i.test(e.message||""))return {code:"not_granted",message:"billing",userMessage:"Ton compte Anthropic n'a plus de crédit. Ajoute du crédit sur console.anthropic.com (Billing)."};
  if(st===400&&/too long|too large|prompt is too long/i.test(e.message||""))return {code:"prompt_too_large",message:e.message};
  if(st===400)return {code:"invalid_request",message:e.message,userMessage:"Requête refusée par l'API : "+(e.message||"")};
  if(st===529||st>=500)return {code:"upstream_error",message:String(st),userMessage:"Les serveurs de Claude sont surchargés. Réessaie dans un instant."};
  return {code:"upstream_error",message:String(e&&e.message||e),userMessage:"Connexion interrompue. Vérifie ta connexion internet et clique sur « Régénérer »."};
}
let useFallbacks=true;

/* ---------- sample(): streaming + manual tool loop ---------- */
async function sample(input,opts={}){
  const key=getKey();
  if(!key){openSettings("Il faut d'abord ajouter ta clé API.");throw {code:"not_granted",message:"no key",userMessage:"Ajoute ta clé API Claude pour commencer (bouton en bas du menu)."}}
  const client=new Anthropic({apiKey:key,dangerouslyAllowBrowser:true,maxRetries:2});
  const effort=opts.modelTier==="complex"?"high":opts.modelTier==="quick"?"low":"medium";
  const tools=(opts.tools||[]).map(t=>({name:t.name,description:t.description,input_schema:t.inputSchema||{type:"object",properties:{}}}));
  const byName=Object.fromEntries((opts.tools||[]).map(t=>[t.name,t]));
  let messages;
  try{messages=await toMessages(input,opts.images)}catch(e){throw {code:"image_rejected",message:"read"}}
  let text="";let truncated=false;
  for(let round=0;round<8;round++){
    const params={model:MODEL,max_tokens:32000,output_config:{effort},messages};
    if(tools.length)params.tools=tools;
    if(useFallbacks){params.betas=["server-side-fallback-2026-07-01"];params.fallbacks="default"}
    const prefix=text?text+"\n\n":"";
    let roundText="";
    let final;
    try{
      const stream=client.beta.messages.stream(params,{signal:opts.signal});
      stream.on("text",d=>{roundText+=d;text=prefix+roundText;opts.onText&&opts.onText({text,delta:d})});
      final=await stream.finalMessage();
    }catch(e){
      if(useFallbacks&&e&&e.status===400&&/fallback/i.test(e.message||"")&&!roundText){useFallbacks=false;round--;continue}
      const m=mapError(e);if(text||roundText)m.text=prefix+roundText;throw m;
    }
    text=prefix+roundText;
    if(final.stop_reason==="refusal")throw {code:"refused",message:"refusal"};
    if(final.stop_reason==="max_tokens"){truncated=true;break}
    if(final.stop_reason!=="tool_use")break;
    const uses=final.content.filter(b=>b.type==="tool_use");
    const results=await Promise.all(uses.map(async u=>{
      const t=byName[u.name];
      try{
        if(!t)throw new Error("Outil inconnu");
        const inp=u.input&&typeof u.input==="object"?u.input:{};
        const r=await t.execute(inp,{signal:opts.signal});
        return {type:"tool_result",tool_use_id:u.id,content:typeof r==="string"?r:JSON.stringify(r)};
      }catch(err){return {type:"tool_result",tool_use_id:u.id,content:"Error: "+(err&&err.message||err),is_error:true}}
    }));
    messages=[...messages,{role:"assistant",content:final.content},{role:"user",content:results}];
    if(round===6){/* last round: ask for the answer without tools */tools.length=0}
  }
  if(!text.trim())throw {code:"empty_completion",message:"empty"};
  return {text,truncated};
}
sample.json=async(input,opts={})=>{
  const r=await sample(input,opts);
  const t=r.text;const a=t.indexOf("{"),b=t.lastIndexOf("}");
  try{return JSON.parse(t.slice(a,b+1))}catch(e){throw {code:"invalid_json",message:"parse",text:t}}
};
sample.limits=async()=>({maxPromptBytes:262144,images:{maxCount:5,maxInputBytes:10e6,mediaTypes:MEDIA},tools:{maxCount:8}});

window.claude={use:async name=>name==="sample"?sample:null};
window.__profOpenSettings=openSettings;
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mountFoot);else setTimeout(mountFoot,0);
if(!getKey())setTimeout(()=>openSettings("Bienvenue !"),600);
})();
