"use strict";
// The Otaku Bazaar server. No dependencies except optional nodemailer for emails.
const http=require("http"),fs=require("fs"),path=require("path"),crypto=require("crypto");
const ROOT=__dirname,PUB=path.join(ROOT,"public");
try{for(const l of fs.readFileSync(path.join(ROOT,".env"),"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(m&&!(m[1] in process.env))process.env[m[1]]=m[2].replace(/^["']|["']$/g,"")}}catch{}
const E=process.env;
const API=E.RAZORPAY_API||"https://api.razorpay.com",DATA=E.DATA_DIR||ROOT,PORT=+(E.PORT||3000);
const NEED=["RAZORPAY_KEY_ID","RAZORPAY_KEY_SECRET","ADMIN_KEY"].filter(k=>!E[k]);
if(NEED.length&&require.main===module){console.error("Missing "+NEED.join(", ")+" (see .env.example)");process.exit(1)}
const RURL=E.UPSTASH_REDIS_REST_URL||E.KV_REST_API_URL,RTOK=E.UPSTASH_REDIS_REST_TOKEN||E.KV_REST_API_TOKEN;

class Fail extends Error{constructor(m,c=400){super(m);this.code=c}}
const STAGES=["Order placed","Packed","Shipped","Delivered"],DAY=86400;
const readJson=(f,d)=>{try{return JSON.parse(fs.readFileSync(f,"utf8"))}catch(e){if(e.code==="ENOENT")return d;throw e}};
const writeJson=(f,v)=>{const t=f+".tmp";fs.writeFileSync(t,JSON.stringify(v,null,1));fs.renameSync(t,f)};
// products.json / coupons.json are checked once so a typo gives a clear message instead of a broken shop.
function validateConfig(cat,cp){
  const bad=m=>{throw new Error(m)};
  if(!isObj(cat)||!Array.isArray(cat.products)||!cat.products.length)bad("products.json needs a non-empty list called products");
  for(const k of ["shipping","freeShippingOver"])if(!Number.isInteger(cat[k])||cat[k]<0)bad(`products.json: "${k}" must be a whole number of rupees`);
  const ids=new Set();
  for(const p of cat.products){
    const w="products.json, product "+(p&&p.name||JSON.stringify(p));
    if(!isObj(p)||!Number.isInteger(p.id)||p.id<1||ids.has(p.id))bad(w+": id must be a unique whole number starting at 1");
    ids.add(p.id);
    if(typeof p.name!=="string"||!p.name.trim()||typeof p.cat!=="string"||!p.cat.trim())bad(w+": needs a name and a cat (category)");
    if(!Number.isInteger(p.price)||p.price<1)bad(w+": price must be a whole number of rupees, at least 1");
    if(p.imgs!==undefined&&!(Array.isArray(p.imgs)&&p.imgs.every(u=>typeof u==="string")))bad(w+": imgs must be a list of image links");
    if(p.desc!==undefined&&typeof p.desc!=="string")bad(w+": desc must be text");
    if(p.c!==undefined&&!/^#[0-9a-f]{3,8}$/i.test(p.c))bad(w+": c must be a colour like #3a1418");
  }
  if(!isObj(cp))bad("coupons.json must be an object of coupon codes");
  for(const [k,c] of Object.entries(cp)){
    if(k!==k.toUpperCase()||!/^[A-Z0-9]+$/.test(k))bad(`coupons.json: code ${k} must be CAPITAL letters and numbers only`);
    if(!isObj(c)||!["percent","flat","freeship"].includes(c.type))bad(`coupons.json ${k}: type must be percent, flat or freeship`);
    if(c.type==="percent"&&!(c.value>0&&c.value<=100))bad(`coupons.json ${k}: percent value must be between 1 and 100`);
    if(c.type==="flat"&&!(Number.isInteger(c.value)&&c.value>0))bad(`coupons.json ${k}: flat value must be whole rupees`);
    if(c.min!==undefined&&!(Number.isInteger(c.min)&&c.min>=0))bad(`coupons.json ${k}: min must be whole rupees`);
  }
}
let cfgOk=false;
const catalog=()=>{
  const c=require("./products.json");
  if(!cfgOk){try{validateConfig(c,require("./coupons.json"))}catch(e){throw new Fail("Store setup problem: "+e.message,500)}cfgOk=true}
  return c;
};
const coupons=()=>require("./coupons.json");
const digits=s=>String(s||"").replace(/\D/g,"").slice(-10);
const hmac=(k,t)=>crypto.createHmac("sha256",k).update(t).digest("hex");
const same=(a,b)=>{a=Buffer.from(String(a));b=Buffer.from(String(b));return a.length===b.length&&crypto.timingSafeEqual(a,b)};
const isObj=j=>j&&typeof j==="object"&&!Array.isArray(j);

// ---- Storage: Upstash Redis (Vercel) when configured, otherwise JSON files (local) ----
let store;
if(RURL){
  const R=async(...cmd)=>{
    const r=await fetch(RURL,{method:"POST",headers:{Authorization:"Bearer "+RTOK,"Content-Type":"application/json"},body:JSON.stringify(cmd.map(String))});
    const d=await r.json().catch(()=>({}));
    if(!r.ok||d.error)throw new Error("Database error: "+(d.error||r.status));
    return d.result;
  };
  store={
    reserve:async id=>(await R("SET","order:"+id,"{}","NX","EX",2*DAY))==="OK",
    drop:id=>R("DEL","order:"+id),
    async get(id){const v=await R("GET","order:"+id),o=v&&JSON.parse(v);return o&&o.customer?o:null},
    async save(o){await R("SET","order:"+o.id,JSON.stringify(o),...(o.paid?[]:["EX",2*DAY]));if(o.paid)await R("ZADD","paid",o.paidAt,o.id)},
    linkRz:(rz,id)=>R("SET","rz:"+rz,id,"EX",7*DAY),
    async byRz(rz){const id=await R("GET","rz:"+rz);return id?this.get(id):null},
    async paidList(){const ids=await R("ZREVRANGE","paid",0,199);if(!ids.length)return[];return(await R("MGET",...ids.map(i=>"order:"+i))).filter(Boolean).map(x=>JSON.parse(x))},
    async once(k){return(await R("SET","once:"+k,"1","NX","EX",30*DAY))==="OK"},
    async addReview(r){if((await R("SET",`revd:${r.orderId}:${r.productId}`,"1","NX"))!=="OK")return false;await R("RPUSH","rev:"+r.productId,JSON.stringify(r));return true},
    async reviews(pid){return(await R("LRANGE","rev:"+pid,0,-1)).map(x=>JSON.parse(x))},
    async hit(k,max){const n=await R("INCR","rl:"+k);if(n===1)await R("EXPIRE","rl:"+k,60);return n<=max}
  };
}else{
  const OF=path.join(DATA,"orders.json"),RF=path.join(DATA,"reviews.json"),orders=()=>readJson(OF,{}),seen=new Set(),mem=new Map();
  setInterval(()=>mem.clear(),6e5).unref();
  store={
    async reserve(id){const d=orders();if(d[id])return false;const cut=Date.now()-2*DAY*1e3;for(const k in d)if(!d[k].paid&&d[k].at<cut)delete d[k];d[id]={id,at:Date.now()};writeJson(OF,d);return true},
    async drop(id){const d=orders();if(d[id]&&!d[id].customer){delete d[id];writeJson(OF,d)}},
    async get(id){const o=orders()[id];return o&&o.customer?o:null},
    async save(o){const d=orders();d[o.id]=o;writeJson(OF,d)},
    async linkRz(){},
    async byRz(rz){return Object.values(orders()).find(o=>o.rzpOrderId===rz)||null},
    async paidList(){return Object.values(orders()).filter(o=>o.paid).sort((a,b)=>b.paidAt-a.paidAt).slice(0,200)},
    async once(k){if(seen.has(k))return false;seen.add(k);return true},
    async addReview(r){const a=readJson(RF,[]);if(a.some(x=>x.orderId===r.orderId&&x.productId===r.productId))return false;a.push(r);writeJson(RF,a);return true},
    async reviews(pid){return readJson(RF,[]).filter(r=>r.productId===pid)},
    async hit(k,max){const n=Date.now(),a=(mem.get(k)||[]).filter(t=>n-t<6e4);if(a.length>=max)return false;a.push(n);mem.set(k,a);return true}
  };
}

// Emails are awaited so they still go out on serverless hosts that freeze after the response.
let mailer=null;
if(E.SMTP_HOST){try{mailer=require("nodemailer").createTransport({host:E.SMTP_HOST,port:+(E.SMTP_PORT||587),auth:{user:E.SMTP_USER,pass:E.SMTP_PASS}})}catch{console.error("Emails are off: run npm install to add nodemailer")}}
const send=async(to,subject,text)=>{if(mailer&&to)try{await mailer.sendMail({from:E.MAIL_FROM||E.SMTP_USER,to,subject,text})}catch(e){console.error("Email failed:",e.message)}};

async function limit(req,name,max){
  const ip=((E.TRUST_PROXY||E.VERCEL)&&String(req.headers["x-forwarded-for"]||"").split(",")[0].trim())||req.socket.remoteAddress;
  if(!(await store.hit(name+"|"+ip,max)))throw new Fail("Too many attempts. Please wait a minute and try again.",429);
}

// Single pricing function for quotes and orders. Browser prices are never trusted.
function price(items,code){
  const {products,shipping,freeShippingOver}=catalog();
  if(!Array.isArray(items)||!items.length||items.length>50)throw new Fail("Your cart is empty");
  const lines=[];let sub=0;
  for(const i of items){
    const p=isObj(i)&&products.find(x=>x.id===i.id);
    if(!p||!Number.isInteger(i.qty)||i.qty<1||i.qty>20||lines.some(l=>l.id===p.id))throw new Fail("Something in your cart is no longer available");
    sub+=p.price*i.qty;lines.push({id:p.id,name:p.name,price:p.price,qty:i.qty});
  }
  let discount=0,ship=shipping,couponError="",applied="";
  const k=String(code||"").trim().toUpperCase();
  if(k){
    const c=Object.hasOwn(coupons(),k)?coupons()[k]:null;
    if(!c)couponError="That coupon code isn't valid";
    else if(sub<(c.min||0))couponError="This coupon needs a cart of at least ₹"+c.min;
    else{applied=k;if(c.type==="percent")discount=Math.round(sub*c.value/100);if(c.type==="flat")discount=Math.min(c.value,sub);if(c.type==="freeship")ship=0}
  }
  if(sub-discount>=freeShippingOver)ship=0;
  const total=sub-discount+ship;
  if(total<1)throw new Fail("Invalid order total");
  return {lines,sub,discount,shipping:ship,total,coupon:applied,couponError,hint:ship?"Add ₹"+(freeShippingOver-(sub-discount))+" more for free shipping":""};
}

async function rzpOrder(rupees,receipt){
  let r,d={};
  try{
    r=await fetch(API+"/v1/orders",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Basic "+Buffer.from(E.RAZORPAY_KEY_ID+":"+E.RAZORPAY_KEY_SECRET).toString("base64")},body:JSON.stringify({amount:rupees*100,currency:"INR",receipt})});
    d=await r.json().catch(()=>({}));
  }catch(e){console.error("Razorpay unreachable:",e.message)}
  if(!r||!r.ok||!d.id){console.error("Razorpay order failed:",r&&r.status,d);throw new Fail("Payment service is unavailable. Please try again in a moment.",502)}
  return d.id;
}

async function markPaid(o,payId){
  if(o.paid)return;
  o.paid=true;o.paymentId=payId;o.paidAt=Date.now();await store.save(o);
  if(!(await store.once("paid:"+o.id)))return;
  const items=o.lines.map(l=>"- "+l.name+" x "+l.qty).join("\n");
  await Promise.all([
    send(o.customer.email,"Order "+o.id+" confirmed",`Hi ${o.customer.name},\n\nThanks for your order. We received ₹${o.total}.\n\n${items}\n\nDelivering to:\n${o.customer.addr}\n\nTrack it on our website with order ID ${o.id} and the phone number you used at checkout.\n\nThe Otaku Bazaar`),
    send(E.OWNER_EMAIL,"New paid order "+o.id,`${o.customer.name}, ${o.customer.phone}\n₹${o.total}\n${items}\n${o.customer.addr}`)
  ]);
}

async function createOrder(j){
  const c=isObj(j.customer)?j.customer:{};
  const name=String(c.name||"").trim(),email=String(c.email||"").trim(),addr=String(c.addr||"").trim();
  if(!name||!/^\S+@\S+\.\S+$/.test(email)||addr.length<10||digits(c.phone).length<10)throw new Fail("Please fill in your name, a valid email, 10-digit phone and full address");
  if(name.length>80||addr.length>400)throw new Fail("Name or address is too long");
  const p=price(j.items,j.coupon);
  let id;
  for(let i=0;i<8&&!id;i++){const c2="OB-"+crypto.randomInt(10000,100000);if(await store.reserve(c2))id=c2}
  if(!id)throw new Fail("Please try again");
  let rz;
  try{rz=await rzpOrder(p.total,id)}catch(e){await store.drop(id);throw e}
  await store.save({id,customer:{name,email,phone:digits(c.phone),addr},lines:p.lines,sub:p.sub,discount:p.discount,coupon:p.coupon,shipping:p.shipping,total:p.total,rzpOrderId:rz,paid:false,stage:0,tracking:"",at:Date.now()});
  await store.linkRz(rz,id);
  return {orderId:id,rzpOrderId:rz,amount:p.total*100,key:E.RAZORPAY_KEY_ID};
}

async function verify(j){
  const o=await store.get(String(j.orderId||""));
  if(!o||o.rzpOrderId!==j.razorpay_order_id||typeof j.razorpay_payment_id!=="string")throw new Fail("Order not found");
  if(!same(j.razorpay_signature||"",hmac(E.RAZORPAY_KEY_SECRET,o.rzpOrderId+"|"+j.razorpay_payment_id)))throw new Fail("Payment could not be verified");
  await markPaid(o,j.razorpay_payment_id);
  return {ok:true};
}

// Razorpay calls this even if the customer closes the tab right after paying.
async function webhook(req,raw){
  if(!E.RAZORPAY_WEBHOOK_SECRET)throw new Fail("Not found",404);
  if(!same(req.headers["x-razorpay-signature"]||"",hmac(E.RAZORPAY_WEBHOOK_SECRET,raw.toString("utf8"))))throw new Fail("Bad signature",400);
  let ev;try{ev=JSON.parse(raw)}catch{throw new Fail("Bad request")}
  const pay=ev&&ev.payload&&ev.payload.payment&&ev.payload.payment.entity;
  if(ev.event==="payment.captured"&&pay){
    const o=await store.byRz(pay.order_id);
    if(o&&pay.amount===o.total*100)await markPaid(o,pay.id);
  }
  return {ok:true};
}

async function track(req,id,phone){
  await limit(req,"track",20);
  const o=await store.get(id.toUpperCase());
  if(!o||!o.paid||o.customer.phone!==digits(phone))throw new Fail("No paid order found for that ID and phone number",404);
  return {id:o.id,total:o.total,stage:o.stage,tracking:o.tracking};
}

async function reviewsOf(pid){
  const l=await store.reviews(pid);
  return {avg:l.length?Math.round(l.reduce((a,r)=>a+r.rating,0)/l.length*10)/10:0,list:l.slice(-30).reverse().map(({name,rating,text})=>({name,rating,text}))};
}
async function addReview(req,j){
  await limit(req,"review",10);
  const o=await store.get(String(j.orderId||"").toUpperCase()),r=Number(j.rating),text=String(j.text||"").trim();
  if(!o||!o.paid||o.customer.phone!==digits(j.phone)||!o.lines.some(l=>l.id===j.productId))throw new Fail("We couldn't match a paid order for this product");
  if(!Number.isInteger(r)||r<1||r>5||!text)throw new Fail("Please add a star rating and a short review");
  if(!(await store.addReview({orderId:o.id,productId:j.productId,name:o.customer.name.split(" ")[0],rating:r,text:text.slice(0,300),at:Date.now()})))throw new Fail("You've already reviewed this product");
  return {ok:true};
}

async function adminApi(req,p,j){
  await limit(req,"admin",30);
  if(!same(req.headers["x-admin-key"]||"",E.ADMIN_KEY))throw new Fail("Wrong admin key",401);
  if(req.method==="GET"&&p==="/api/admin/orders")return store.paidList();
  const m=p.match(/^\/api\/admin\/orders\/([\w-]+)$/);
  if(req.method==="POST"&&m){
    const o=await store.get(m[1]),st=j.stage,s=Number(st);
    if(!o||!o.paid)throw new Fail("Order not found",404);
    if(st===""||st===null||!Number.isInteger(s)||s<0||s>3)throw new Fail("Invalid status");
    const changed=s!==o.stage;o.stage=s;o.tracking=String(j.tracking||"").trim().slice(0,100);await store.save(o);
    if(changed&&s>0)await send(o.customer.email,`Order ${o.id}: ${STAGES[s]}`,`Hi ${o.customer.name},\n\nYour order ${o.id} is now: ${STAGES[s]}.${o.tracking?"\nTracking number: "+o.tracking:""}\n\nThe Otaku Bazaar`);
    return o;
  }
  throw new Fail("Not found",404);
}

async function route(req,p,q,j,raw){
  const m=req.method;let x;
  if(m==="GET"&&p==="/api/products")return catalog();
  if(m==="POST"&&p==="/api/quote")return price(j.items,j.coupon);
  if(m==="POST"&&p==="/api/order")return createOrder(j);
  if(m==="POST"&&p==="/api/verify")return verify(j);
  if(m==="POST"&&p==="/api/webhook")return webhook(req,raw);
  if(m==="POST"&&p==="/api/reviews")return addReview(req,j);
  if(m==="GET"&&(x=p.match(/^\/api\/track\/([\w-]+)$/)))return track(req,x[1],q.get("phone"));
  if(m==="GET"&&(x=p.match(/^\/api\/reviews\/(\d+)$/)))return reviewsOf(+x[1]);
  if(p.startsWith("/api/admin/"))return adminApi(req,p,j);
  throw new Fail("Not found",404);
}

const body=req=>new Promise((ok,no)=>{
  // Some hosts read the body before our code runs; use it if so.
  if(req.readableEnded&&req.body!==undefined)return ok(Buffer.from(typeof req.body==="string"?req.body:JSON.stringify(req.body)));
  const c=[];let n=0;req.on("data",d=>{n+=d.length;if(n>65536){no(new Fail("Request too large",413));req.destroy()}else c.push(d)});req.on("end",()=>ok(Buffer.concat(c)));req.on("error",no)});
const TYPES={".html":"text/html; charset=utf-8",".js":"text/javascript",".css":"text/css",".json":"application/json",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".webp":"image/webp",".svg":"image/svg+xml",".ico":"image/x-icon"};
function serveStatic(req,res,p){
  if(req.method!=="GET"&&req.method!=="HEAD"){res.writeHead(405);return res.end()}
  let rel;try{rel=decodeURIComponent(p)}catch{res.writeHead(400);return res.end()}
  if(rel.endsWith("/"))rel+="index.html";
  const f=path.resolve(PUB,"."+rel);
  if(!f.startsWith(PUB+path.sep)){res.writeHead(404);return res.end("Not found")}
  fs.readFile(f,(e,d)=>{
    if(e){res.writeHead(404,{"Content-Type":"text/plain"});return res.end("Not found")}
    res.writeHead(200,{"Content-Type":TYPES[path.extname(f).toLowerCase()]||"application/octet-stream","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});
    res.end(req.method==="HEAD"?undefined:d);
  });
}

async function handler(req,res){
  const u=new URL(req.url,"http://localhost"),p=u.pathname;
  const out=(c,o)=>{res.writeHead(c,{"Content-Type":"application/json","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"});res.end(JSON.stringify(o))};
  if(!p.startsWith("/api/"))return serveStatic(req,res,p);
  try{
    if(NEED.length)throw new Fail("Store is not set up yet. Missing settings: "+NEED.join(", "),500);
    if(E.VERCEL&&!RURL)throw new Fail("Database not connected. In Vercel, open Storage, add Upstash Redis to this project, then redeploy.",500);
    const raw=req.method==="POST"?await body(req):Buffer.alloc(0);
    let j={};
    if(raw.length&&p!=="/api/webhook"){try{j=JSON.parse(raw)}catch{throw new Fail("Bad request")}}
    if(!isObj(j))throw new Fail("Bad request");
    out(200,await route(req,p,u.searchParams,j,raw));
  }catch(e){
    if(e instanceof Fail)return out(e.code,{error:e.message});
    console.error(e);out(500,{error:"Something went wrong on our side. Please try again."});
  }
}
const server=http.createServer(handler);
if(require.main===module)server.listen(PORT,()=>console.log("Store running on http://localhost:"+PORT));
module.exports={server,handler,validateConfig};
