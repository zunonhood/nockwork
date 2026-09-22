import {
  createPublicClient,
  createWalletClient,
  custom,
  getAddress,
  http,
  parseEther
} from "viem";
import { MarketClient } from "../src/market-client.js";
import { robinhoodMainnet, robinhoodTestnet } from "../src/networks.js";

const catalog = [
  {
    id:"creative/pixel-forge",listingId:0,name:"Pixel Forge",icon:"PF",
    category:"Creative",price:"0.004 ETH",wei:parseEther("0.004"),term:"30 DAYS",
    developer:"0x7A3F…91C2",
    description:"A local image workspace with non-destructive layers and export tools.",
    permissions:["storage:read","storage:write"]
  },
  {
    id:"agents/research-node",listingId:1,name:"Research Node",icon:"RN",
    category:"Agents",price:"0.002 ETH",wei:parseEther("0.002"),term:"7 DAYS",
    developer:"0x19B4…A08E",
    description:"A source-first research agent that produces traceable working notes.",
    permissions:["network:fetch","storage:write"]
  },
  {
    id:"compute/render-grid",listingId:2,name:"Render Grid",icon:"RG",
    category:"Compute",price:"0.006 ETH",wei:parseEther("0.006"),term:"24 HOURS",
    developer:"0xE620…4F12",
    description:"A metered pool of remote rendering capacity for short production jobs.",
    permissions:["network:fetch"]
  },
  {
    id:"storage/quiet-vault",listingId:3,name:"Quiet Vault",icon:"QV",
    category:"Storage",price:"0.003 ETH",wei:parseEther("0.003"),term:"30 DAYS",
    developer:"0x82D1…77AB",
    description:"Encrypted, content-addressed storage controlled by the owner's key.",
    permissions:["storage:read","storage:write","network:fetch"]
  },
  {
    id:"system/mono-shell",listingId:4,name:"Mono Shell",icon:"MS",
    category:"Interface",price:"FREE",wei:0n,term:"PERPETUAL",
    developer:"0x41C0…3B99",
    description:"A restrained keyboard-first shell for the Shellwork environment.",
    permissions:["storage:read"]
  },
  {
    id:"tools/ledger-sheet",listingId:5,name:"Ledger Sheet",icon:"LS",
    category:"Productivity",price:"0.001 ETH",wei:parseEther("0.001"),term:"90 DAYS",
    developer:"0xB506…D440",
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
      '<button data-buy="'+item.id+'">'+(installed?"INSTALLED":item.wei===0n?"INSTALL":"ACQUIRE")+'</button></div></article>';
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
    (installed?"LAUNCH COMPONENT":item.wei===0n?"INSTALL LOCALLY":"ACQUIRE LICENSE")+
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
  return state.config.network==="mainnet"?robinhoodMainnet:robinhoodTestnet;
}

function chainConfigured(){
  return Boolean(state.config.registryAddress&&state.config.marketAddress);
}

async function acquire(item){
  if(state.installed.includes(item.id)){launch(item);return}
  setStatus("Preparing "+item.name+"…");
  try{
    if(item.wei>0n&&chainConfigured()){
      if(!state.account)await connectWallet();
      if(!state.account)throw new Error("Wallet connection was not approved");
      const activeChain=chain();
      const transport=custom(window.ethereum);
      const walletClient=createWalletClient({
        account:state.account,chain:activeChain,transport
      });
      const publicClient=createPublicClient({
        chain:activeChain,transport:http(activeChain.rpcUrls.default.http[0])
      });
      const market=new MarketClient({
        walletClient,publicClient,
        registryAddress:state.config.registryAddress,
        marketAddress:state.config.marketAddress
      });
      const receipt=await market.purchase(item.listingId);
      if(receipt.status!=="success")throw new Error("Transaction was not successful");
      addActivity("LICENSE ACQUIRED",item,"ONCHAIN");
    }else{
      await new Promise(resolve=>setTimeout(resolve,450));
      addActivity(item.wei===0n?"COMPONENT INSTALLED":"DEMO LICENSE",item,"LOCAL");
    }
    state.installed.push(item.id);save();
    setStatus(item.name+" installed and verified");
    renderCatalog();renderInspector();renderInstalled();
  }catch(error){
    setStatus(error.shortMessage??error.message);
    addActivity("INSTALL FAILED",item,"ERROR");
  }
}

function launch(item){
  setStatus(item.name+" launch handed to the local capability runtime");
  addActivity("COMPONENT LAUNCHED",item,"LOCAL");
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

async function ensureNetwork(activeChain){
  const hex="0x"+activeChain.id.toString(16);
  try{
    await window.ethereum.request({
      method:"wallet_switchEthereumChain",params:[{chainId:hex}]
    });
  }catch(error){
    if(error.code!==4902)throw error;
    await window.ethereum.request({
      method:"wallet_addEthereumChain",
      params:[{
        chainId:hex,chainName:activeChain.name,
        nativeCurrency:activeChain.nativeCurrency,
        rpcUrls:activeChain.rpcUrls.default.http,
        blockExplorerUrls:[activeChain.blockExplorers.default.url]
      }]
    });
  }
}

async function connectWallet(){
  if(!window.ethereum){
    setStatus("No EVM browser wallet detected");
    return;
  }
  try{
    const accounts=await window.ethereum.request({method:"eth_requestAccounts"});
    await ensureNetwork(chain());
    state.account=getAddress(accounts[0]);
    $("#identityText").textContent=state.account.slice(0,6)+"…"+state.account.slice(-4);
    $("#walletButton").textContent="CONNECTED";
    addActivity("WALLET CONNECTED",{name:chain().name},"READY");
    updateMode();
  }catch(error){setStatus(error.shortMessage??error.message)}
}

function updateMode(){
  const live=chainConfigured();
  $("#modeText").textContent=live?(chain().testnet?"TESTNET MODE":"MAINNET MODE"):"LOCAL DEMO";
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
  $("#networkInput").value=state.config.network??"testnet";
  $("#registryInput").value=state.config.registryAddress??"";
  $("#marketInput").value=state.config.marketAddress??"";
}

$("#settingsForm").onsubmit=event=>{
  event.preventDefault();
  try{
    const registry=$("#registryInput").value.trim();
    const market=$("#marketInput").value.trim();
    if(Boolean(registry)!==Boolean(market)){
      throw new Error("Enter both contract addresses or leave both empty");
    }
    state.config={
      network:$("#networkInput").value,
      registryAddress:registry?getAddress(registry):"",
      marketAddress:market?getAddress(market):""
    };
    localStorage.setItem("shellwork-config",JSON.stringify(state.config));
    loadSettings();updateMode();
    setStatus(chainConfigured()?"Chain configuration saved":"Local demo mode enabled");
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

if(window.ethereum?.on){
  window.ethereum.on("accountsChanged",accounts=>{
    state.account=accounts[0]?getAddress(accounts[0]):null;
    $("#identityText").textContent=state.account
      ?state.account.slice(0,6)+"…"+state.account.slice(-4)
      :"LOCAL USER";
    $("#walletButton").textContent=state.account?"CONNECTED":"CONNECT WALLET";
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
