import { PublicKey } from "@solana/web3.js";
import { MarketClient } from "../src/market-client.js";
import { ChainLicenseProvider } from "../src/license-providers.js";
import { createConnection, solanaDevnet, solanaMainnet } from "../src/networks.js";

let walletProvider = null;
const catalog = [
  {
    id:"creative/pixel-forge",listingId:0,name:"Pixel Forge",icon:"PF",
    category:"Creative",price:"0.004 SOL",lamports:4_000_000n,term:"30 DAYS",
    developer:"LOCAL SAMPLE",
    description:"A local image workspace with non-destructive layers and export tools.",
    permissions:["storage:read","storage:write"]
  },
  {
    id:"agents/research-node",listingId:1,name:"Research Node",icon:"RN",
    category:"Agents",price:"0.002 SOL",lamports:2_000_000n,term:"7 DAYS",
    developer:"LOCAL SAMPLE",
    description:"A source-first research agent that produces traceable working notes.",
    permissions:["network:fetch","storage:write"]
  },
  {
    id:"compute/render-grid",listingId:2,name:"Render Grid",icon:"RG",
    category:"Compute",price:"0.006 SOL",lamports:6_000_000n,term:"24 HOURS",
    developer:"LOCAL SAMPLE",
    description:"A metered pool of remote rendering capacity for short production jobs.",
    permissions:["network:fetch"]
  },
  {
    id:"storage/quiet-vault",listingId:3,name:"Quiet Vault",icon:"QV",
    category:"Storage",price:"0.003 SOL",lamports:3_000_000n,term:"30 DAYS",
    developer:"LOCAL SAMPLE",
    description:"Encrypted, content-addressed storage controlled by the owner's key.",
    permissions:["storage:read","storage:write","network:fetch"]
  },
  {
    id:"system/mono-shell",listingId:4,name:"Mono Shell",icon:"MS",
    category:"Interface",price:"FREE",lamports:0n,term:"PERPETUAL",
    developer:"LOCAL SAMPLE",
    description:"A restrained keyboard-first shell for the Shellwork environment.",
    permissions:["storage:read"]
  },
  {
    id:"tools/ledger-sheet",listingId:5,name:"Ledger Sheet",icon:"LS",
    category:"Productivity",price:"0.001 SOL",lamports:1_000_000n,term:"90 DAYS",
    developer:"LOCAL SAMPLE",
    description:"A programmable local spreadsheet with verifiable calculation modules.",
    permissions:["storage:read","storage:write"]
  }
];

const $ = selector => document.querySelector(selector);
const stored = (key, fallback) => JSON.parse(
  localStorage.getItem("shellwork-" + key) ??
  localStorage.getItem("nockwork-" + key) ??
  fallback
);
const state = {
  selected:catalog[0],
  filter:"All",
  search:"",
  account:null,
  installed:stored("installed", "[]"),
  activity:stored("activity", "[]"),
  config:stored("config", "{}")
};

function escapeHtml(value){
  return String(value).replace(/[&<>"']/g,ch=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  })[ch]);
}

function renderFilters(){
  const categories=["All",...new Set(catalog.map(item=>item.category))];
  $("#filters").innerHTML=categories.map(category=>
    '<button class="'+(state.filter===category?"active":"")+'" data-filter="'+category+'">'+category.toUpperCase()+'</button>'
  ).join("");
  $("#filters").querySelectorAll("button").forEach(button=>{
    button.onclick=()=>{state.filter=button.dataset.filter;renderFilters();renderCatalog()};
  });
}

function renderCatalog(){
  const query=state.search.toLowerCase();
  const items=catalog.filter(item=>
    (state.filter==="All"||item.category===state.filter)&&
    (item.name+" "+item.description+" "+item.id).toLowerCase().includes(query)
  );
  $("#catalog").innerHTML=items.map(item=>{
    const installed=state.installed.includes(item.id);
    return '<article class="card '+(state.selected?.id===item.id?"selected":"")+'" data-id="'+item.id+'">'+
      '<div class="card-top"><span class="card-icon">'+item.icon+'</span><span class="card-category">'+item.category.toUpperCase()+'</span></div>'+
      '<h2>'+escapeHtml(item.name)+'</h2><p>'+escapeHtml(item.description)+'</p>'+
      '<div class="card-foot"><div class="price"><strong>'+item.price+'</strong><small>'+item.term+'</small></div>'+
      '<button data-buy="'+item.id+'">'+(installed?"INSTALLED":item.lamports===0n?"INSTALL":"ACQUIRE")+'</button></div></article>';
  }).join("")||'<div class="empty-list">No components match this search.</div>';
  $("#catalog").querySelectorAll(".card").forEach(card=>{
    card.onclick=event=>{
      state.selected=catalog.find(item=>item.id===card.dataset.id);
      renderCatalog();renderInspector();
      if(event.target.dataset.buy)acquire(state.selected);
    };
  });
}

function renderInspector(){
  const item=state.selected;
  const installed=state.installed.includes(item.id);
  $("#inspector").innerHTML=
    '<div class="inspect-label">COMPONENT / '+escapeHtml(item.category.toUpperCase())+'</div>'+
    '<h2>'+escapeHtml(item.name)+'</h2><div class="publisher">PUBLISHED BY '+item.developer+'</div>'+
    '<p class="description">'+escapeHtml(item.description)+'</p>'+
    '<div class="inspect-section"><h3>REQUESTED CAPABILITIES</h3>'+
    item.permissions.map(permission=>'<div class="permission"><span>'+permission+'</span><b class="safe">DECLARED</b></div>').join("")+
    '</div><div class="inspect-section"><h3>LICENSE</h3><div class="license-box">'+
    '<div><span>PRICE</span><b>'+item.price+'</b></div><div><span>DURATION</span><b>'+item.term+'</b></div>'+
    '<div><span>STATUS</span><b>'+(installed?"INSTALLED":"AVAILABLE")+'</b></div></div></div>'+
    '<div class="inspect-actions"><button class="action primary" id="inspectAcquire">'+
    (installed?"LAUNCH COMPONENT":item.lamports===0n?"INSTALL LOCALLY":"ACQUIRE LICENSE")+
    '</button><button class="action" id="inspectSource">VIEW COMPONENT ID</button></div>';
  $("#inspectAcquire").onclick=()=>installed?launch(item):acquire(item);
  $("#inspectSource").onclick=()=>setStatus(item.id);
}

function save(){
  localStorage.setItem("shellwork-installed",JSON.stringify(state.installed));
  localStorage.setItem("shellwork-activity",JSON.stringify(state.activity.slice(0,50)));
  $("#installedCount").textContent=state.installed.length;
}

function addActivity(action,item,status="COMPLETE"){
  state.activity.unshift({
    time:new Date().toISOString(),action,item:item.name,status
  });
  save();renderActivity();
}

function setStatus(message){
  $("#statusMessage").textContent=message;
}

function chain(){
  return state.config.network==="mainnet"?solanaMainnet:solanaDevnet;
}

function chainConfigured(){
  return Boolean(state.config.programId);
}

function connection(){
  return createConnection(chain(),state.config.rpcUrl||chain().rpcUrl);
}

async function acquire(item){
  setStatus("Preparing "+item.name+"...");
  try{
  if(state.installed.includes(item.id)){
    if(!chainConfigured()||item.lamports===0n){await launch(item);return}
    if(state.account){
      const licenses=new ChainLicenseProvider({
        programId:state.config.programId,connection:connection()
      });
      if(await licenses.hasAccess(state.account,item.id)){await launch(item);return}
    }
  }
    if(item.lamports>0n&&chainConfigured()){
      if(!state.account)await connectWallet();
      if(!state.account)throw new Error("Connect a Solana wallet first");
      const market=new MarketClient({
        wallet:walletProvider,connection:connection(),programId:state.config.programId
      });
      await market.purchase(item.id,item.lamports);
      addActivity("LICENSE ACQUIRED",item,"SOLANA");
    }else{
      await new Promise(resolve=>setTimeout(resolve,450));
      addActivity(item.lamports===0n?"COMPONENT INSTALLED":"DEMO LICENSE",item,"LOCAL");
    }
    if(!state.installed.includes(item.id))state.installed.push(item.id);save();
    setStatus(item.name+" installed in this local profile");
    renderCatalog();renderInspector();renderInstalled();
  }catch(error){
    setStatus(error.message);
    addActivity("INSTALL FAILED",item,"ERROR");
  }
}

async function launch(item){
  try{
    if(item.lamports>0n&&chainConfigured()){
      if(!state.account)throw new Error("Connect a Solana wallet first");
      const licenses=new ChainLicenseProvider({
        programId:state.config.programId,connection:connection()
      });
      if(!await licenses.hasAccess(state.account,item.id)){
        throw new Error("No active Solana license for this component");
      }
    }
    setStatus(item.name+" launch handed to the local capability runtime");
    addActivity("COMPONENT LAUNCHED",item,"LOCAL");
  }catch(error){setStatus(error.message)}
}

function uninstall(item){
  state.installed=state.installed.filter(id=>id!==item.id);
  addActivity("COMPONENT REMOVED",item,"LOCAL");
  save();renderCatalog();renderInspector();renderInstalled();
  setStatus(item.name+" removed from this profile");
}

function renderInstalled(){
  const items=state.installed.map(id=>catalog.find(item=>item.id===id)).filter(Boolean);
  $("#installedList").innerHTML=items.map(item=>
    '<article class="installed-item"><span class="card-icon">'+item.icon+'</span><div><strong>'+
    escapeHtml(item.name)+'</strong><small>'+escapeHtml(item.id)+' · VERIFIED</small></div>'+
    '<div><button class="action primary" data-launch="'+item.id+'">LAUNCH</button> '+
    '<button class="action" data-remove="'+item.id+'">REMOVE</button></div></article>'
  ).join("")||'<div class="empty-list">No components installed in this local profile.<br>Acquire one from the marketplace.</div>';
  $("#installedList").querySelectorAll("[data-launch]").forEach(button=>{
    button.onclick=()=>launch(catalog.find(item=>item.id===button.dataset.launch));
  });
  $("#installedList").querySelectorAll("[data-remove]").forEach(button=>{
    button.onclick=()=>uninstall(catalog.find(item=>item.id===button.dataset.remove));
  });
}

function renderActivity(){
  $("#activityList").innerHTML=state.activity.map(entry=>
    '<article class="activity-item"><time>'+new Date(entry.time).toLocaleTimeString([],{
      hour:"2-digit",minute:"2-digit"
    })+'</time><div><b>'+escapeHtml(entry.action)+'</b><small>'+escapeHtml(entry.item)+'</small></div>'+
    '<em>'+escapeHtml(entry.status)+'</em></article>'
  ).join("")||'<div class="empty-list">Activity will appear here after a component is installed or launched.</div>';
}

async function connectWallet(){
  const provider=window.phantom?.solana??window.solflare??window.solana;
  if(!provider?.connect||!provider?.signTransaction){
    setStatus("Install a Solana wallet that supports signTransaction");
    return;
  }
  try{
    const response=await provider.connect();
    walletProvider=provider;
    state.account=(response.publicKey??provider.publicKey).toBase58();
    $("#identityText").textContent=state.account.slice(0,6)+"..."+state.account.slice(-4);
    $("#walletButton").textContent="CONNECTED";
    addActivity("WALLET CONNECTED",{name:chain().name},"READY");
    updateMode();
  }catch(error){setStatus(error.message)}
}

function updateMode(){
  const live=chainConfigured();
  $("#modeText").textContent=live?(chain().cluster==="devnet"?"DEVNET MODE":"MAINNET MODE"):"LOCAL DEMO";
  document.querySelector(".system-health p:last-child").classList.toggle("muted",!live);
}

function openView(name){
  document.querySelectorAll(".view").forEach(view=>view.classList.remove("active"));
  document.querySelectorAll("#navigation button").forEach(button=>
    button.classList.toggle("active",button.dataset.view===name)
  );
  $("#"+name+"View").classList.add("active");
  if(name==="installed")renderInstalled();
  if(name==="activity")renderActivity();
}

function loadSettings(){
  $("#networkInput").value=state.config.network==="mainnet"?"mainnet":"devnet";
  $("#programInput").value=state.config.programId??"";
  $("#rpcInput").value=state.config.rpcUrl??"";
}

$("#settingsForm").onsubmit=event=>{
  event.preventDefault();
  try{
    const programId=$("#programInput").value.trim();
    const rpcUrl=$("#rpcInput").value.trim();
    if(programId)new PublicKey(programId);
    if(rpcUrl&&!/^https:\/\//.test(rpcUrl)&&!/^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(rpcUrl)){
      throw new Error("RPC URL must use HTTPS or local HTTP");
    }
    state.config={
      network:$("#networkInput").value,
      programId,
      rpcUrl
    };
    localStorage.setItem("shellwork-config",JSON.stringify(state.config));
    loadSettings();updateMode();
    setStatus(chainConfigured()?"Solana program configured":"Local demo mode enabled");
  }catch(error){setStatus(error.message)}
};

$("#navigation").querySelectorAll("button").forEach(button=>{
  button.onclick=()=>openView(button.dataset.view);
});
$("#walletButton").onclick=connectWallet;
$("#searchInput").oninput=event=>{state.search=event.target.value;renderCatalog()};

function tick(){
  $("#clock").textContent=new Date().toLocaleTimeString([],{
    hour:"2-digit",minute:"2-digit"
  });
}

loadSettings();
renderFilters();
renderCatalog();
renderInspector();
renderInstalled();
renderActivity();
save();
updateMode();
tick();
setInterval(tick,30_000);
