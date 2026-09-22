const files = [
  {type:"file",name:"README.md",path:"repository-files/README.md",language:"Markdown"},
  {type:"folder",name:"contracts",id:"contracts",open:true},
  {type:"file",name:"ComponentRegistry.sol",path:"repository-files/contracts/ComponentRegistry.sol",parent:"contracts",language:"Solidity"},
  {type:"file",name:"LicenseMarket.sol",path:"repository-files/contracts/LicenseMarket.sol",parent:"contracts",language:"Solidity"},
  {type:"folder",name:"src",id:"src",open:true},
  {type:"file",name:"kernel.js",path:"repository-files/src/kernel.js",parent:"src",language:"JavaScript"},
  {type:"file",name:"computer.js",path:"repository-files/src/computer.js",parent:"src",language:"JavaScript"},
  {type:"file",name:"artifact-fetcher.js",path:"repository-files/src/artifact-fetcher.js",parent:"src",language:"JavaScript"},
  {type:"file",name:"component-store.js",path:"repository-files/src/component-store.js",parent:"src",language:"JavaScript"},
  {type:"file",name:"license-providers.js",path:"repository-files/src/license-providers.js",parent:"src",language:"JavaScript"},
  {type:"file",name:"market-client.js",path:"repository-files/src/market-client.js",parent:"src",language:"JavaScript"},
  {type:"file",name:"manifest.js",path:"repository-files/src/manifest.js",parent:"src",language:"JavaScript"},
  {type:"file",name:"wasm-loader.js",path:"repository-files/src/wasm-loader.js",parent:"src",language:"JavaScript"},
  {type:"file",name:"permissions.js",path:"repository-files/src/permissions.js",parent:"src",language:"JavaScript"},
  {type:"file",name:"networks.js",path:"repository-files/src/networks.js",parent:"src",language:"JavaScript"},
  {type:"file",name:"hash.js",path:"repository-files/src/hash.js",parent:"src",language:"JavaScript"},
  {type:"file",name:"index.js",path:"repository-files/src/index.js",parent:"src",language:"JavaScript"},
  {type:"folder",name:"examples",id:"examples",open:false},
  {type:"file",name:"demo.mjs",path:"repository-files/examples/demo.mjs",parent:"examples",language:"JavaScript"},
  {type:"folder",name:"scripts",id:"scripts",open:false},
  {type:"file",name:"build.mjs",path:"repository-files/scripts/build.mjs",parent:"scripts",language:"JavaScript"},
  {type:"file",name:"build-web.mjs",path:"repository-files/scripts/build-web.mjs",parent:"scripts",language:"JavaScript"},
  {type:"file",name:"compile-contracts.mjs",path:"repository-files/scripts/compile-contracts.mjs",parent:"scripts",language:"JavaScript"},
  {type:"file",name:"deploy.mjs",path:"repository-files/scripts/deploy.mjs",parent:"scripts",language:"JavaScript"},
  {type:"file",name:"verify.mjs",path:"repository-files/scripts/verify.mjs",parent:"scripts",language:"JavaScript"},
  {type:"folder",name:"test",id:"test",open:false},
  {type:"file",name:"kernel.test.js",path:"repository-files/test/kernel.test.js",parent:"test",language:"JavaScript"},
  {type:"file",name:"artifact-fetcher.test.js",path:"repository-files/test/artifact-fetcher.test.js",parent:"test",language:"JavaScript"},
  {type:"file",name:"component-store.test.js",path:"repository-files/test/component-store.test.js",parent:"test",language:"JavaScript"},
  {type:"file",name:"computer.test.js",path:"repository-files/test/computer.test.js",parent:"test",language:"JavaScript"},
  {type:"file",name:"market-client.test.js",path:"repository-files/test/market-client.test.js",parent:"test",language:"JavaScript"},
  {type:"file",name:"networks.test.js",path:"repository-files/test/networks.test.js",parent:"test",language:"JavaScript"},
  {type:"folder",name:"app",id:"app",open:false},
  {type:"file",name:"index.html",path:"repository-files/app/index.html",parent:"app",language:"HTML"},
  {type:"file",name:"main.js",path:"repository-files/app/main.js",parent:"app",language:"JavaScript"},
  {type:"file",name:"style.css",path:"repository-files/app/style.css",parent:"app",language:"CSS"},
  {type:"file",name:"package.json",path:"repository-files/package.json",language:"JSON"}
];

const tree=document.querySelector("#fileTree"),code=document.querySelector("#codeView");
const scroll=document.querySelector("#codeScroll"),pathLabel=document.querySelector("#currentPath");
const lang=document.querySelector("#languageLabel"),count=document.querySelector("#lineCount");
const state=document.querySelector("#loadState"),copy=document.querySelector("#copyButton");
let active="",raw="";

function esc(value){return value.replace(/[&<>"']/g,function(ch){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[ch]})}
function ext(name){const part=name.split(".").pop();return part===name?"FILE":part.toUpperCase()}

function drawTree(){
  tree.innerHTML="";
  files.forEach(function(item){
    const row=document.createElement("button");
    row.type="button";row.className="row";row.dataset.depth=item.parent?"1":"0";
    if(item.type==="folder"){
      row.classList.toggle("open",item.open);
      row.innerHTML='<span class="chev">▶</span><span class="icon">▰</span><span class="name">'+item.name+'</span><span class="kind">DIR</span>';
      row.onclick=function(){item.open=!item.open;drawTree()};
    }else{
      const parent=item.parent?files.find(function(entry){return entry.id===item.parent}):null;
      if(parent&&!parent.open)row.hidden=true;
      if(item.path===active)row.classList.add("active");
      row.innerHTML='<span class="chev"></span><span class="icon">◇</span><span class="name">'+item.name+'</span><span class="kind">'+ext(item.name)+'</span>';
      row.onclick=function(){openFile(item)};
    }
    tree.appendChild(row);
  });
}

function colorLine(line){
  const safe=esc(line);
  if(/^\s*(\/\/|#)/.test(line))return '<span class="comment">'+safe+'</span>';
  return safe.replace(/(&quot;[^&]*?&quot;)/g,'<span class="string">$1</span>');
}

async function openFile(item){
  active=item.path;
  pathLabel.textContent=item.path.replace("repository-files/","").replaceAll("/"," / ");
  lang.textContent=item.language.toUpperCase();
  state.textContent="READING OBJECT";code.innerHTML="<code>Loading source…</code>";drawTree();
  try{
    const response=await fetch(item.path,{cache:"no-store"});
    if(!response.ok)throw new Error("Source unavailable");
    raw=await response.text();
    const lines=raw.replace(/\n$/,"").split("\n");
    count.textContent=lines.length+" LINES";
    code.innerHTML=lines.map(function(line,index){
      return '<span class="code-line"><span class="num">'+(index+1)+'</span>'+colorLine(line)+'</span>';
    }).join("");
    scroll.scrollTo({top:0,left:0});state.textContent="OBJECT VERIFIED";
  }catch(error){
    raw="";count.textContent="0 LINES";state.textContent="READ ERROR";
    code.innerHTML="<code>Unable to read "+esc(item.path)+".</code>";
  }
}

copy.onclick=async function(){
  if(!raw)return;
  try{await navigator.clipboard.writeText(raw);copy.textContent="COPIED"}
  catch(error){copy.textContent="DENIED"}
  setTimeout(function(){copy.textContent="COPY"},1200);
};

drawTree();
openFile(files.find(function(item){return item.path==="repository-files/src/kernel.js"}));
