// Test cases. Run both storage modes with: npm test
const test=require("node:test"),assert=require("node:assert/strict"),http=require("http"),fs=require("fs"),os=require("os"),path=require("path"),crypto=require("crypto");
const hmac=(k,t)=>crypto.createHmac("sha256",k).update(t).digest("hex");
let base,mock,redis,server;const rz=[];
const MODE=process.env.TEST_MODE||"file";
function redisMock(){
  const kv=new Map(),zs=new Map(),ls=new Map();
  return http.createServer((q,s)=>{let b="";q.on("data",d=>b+=d);q.on("end",()=>{
    if(q.headers.authorization!=="Bearer tok"){s.writeHead(401);return s.end("{}")}
    const [c,...a]=JSON.parse(b);let r=null;
    switch(c.toUpperCase()){
      case"SET":if(a.includes("NX")&&kv.has(a[0])){r=null}else{kv.set(a[0],a[1]);r="OK"}break;
      case"GET":r=kv.get(a[0])??null;break;
      case"DEL":r=kv.delete(a[0])?1:0;break;
      case"ZADD":{const z=zs.get(a[0])||new Map();z.set(a[2],+a[1]);zs.set(a[0],z);r=1;break}
      case"ZREVRANGE":r=[...(zs.get(a[0])||new Map())].sort((x,y)=>y[1]-x[1]).map(x=>x[0]);break;
      case"MGET":r=a.map(k=>kv.get(k)??null);break;
      case"RPUSH":{const l=ls.get(a[0])||[];l.push(a[1]);ls.set(a[0],l);r=l.length;break}
      case"LRANGE":r=ls.get(a[0])||[];break;
      case"INCR":{const n=(+kv.get(a[0])||0)+1;kv.set(a[0],String(n));r=n;break}
      case"EXPIRE":r=1;break;
      default:s.writeHead(400,{"Content-Type":"application/json"});return s.end(JSON.stringify({error:"unknown "+c}))}
    s.writeHead(200,{"Content-Type":"application/json"});s.end(JSON.stringify({result:r}));
  })});
}
const call=async(m,u,b,h={})=>{const r=await fetch(base+u,{method:m,headers:{"Content-Type":"application/json",...h},body:b===undefined?undefined:(typeof b==="string"?b:JSON.stringify(b))});return {s:r.status,j:await r.json().catch(()=>null)}};
const cust={name:"Aarav Shah",phone:"98765 43210",email:"aarav@example.com",addr:"12 MG Road, Pune 411001"};
const ADM={"x-admin-key":"adm"};
async function place(items,coupon){const r=await call("POST","/api/order",{customer:cust,items,coupon});assert.equal(r.s,200,JSON.stringify(r.j));return r.j}
const pay=(o,id="pay_1")=>({orderId:o.orderId,razorpay_order_id:o.rzpOrderId,razorpay_payment_id:id,razorpay_signature:hmac("sec",o.rzpOrderId+"|"+id)});

test.before(async()=>{
  mock=http.createServer((q,s)=>{let b="";q.on("data",d=>b+=d);q.on("end",()=>{const o=JSON.parse(b);rz.push({o,auth:q.headers.authorization});s.writeHead(200,{"Content-Type":"application/json"});s.end(JSON.stringify({id:"order_T"+rz.length}))})});
  await new Promise(r=>mock.listen(0,r));
  if(MODE==="redis"){redis=redisMock();await new Promise(r=>redis.listen(0,r));Object.assign(process.env,{UPSTASH_REDIS_REST_URL:"http://127.0.0.1:"+redis.address().port,UPSTASH_REDIS_REST_TOKEN:"tok"})}
  Object.assign(process.env,{RAZORPAY_KEY_ID:"rzp_test_x",RAZORPAY_KEY_SECRET:"sec",ADMIN_KEY:"adm",RAZORPAY_WEBHOOK_SECRET:"hook",DATA_DIR:fs.mkdtempSync(path.join(os.tmpdir(),"ob-")),RAZORPAY_API:"http://127.0.0.1:"+mock.address().port});
  server=require("./server").server;await new Promise(r=>server.listen(0,r));base="http://127.0.0.1:"+server.address().port;
});
test.after(()=>{server.closeAllConnections();server.close();mock.close();if(redis)redis.close()});

test("catalog and pricing",async()=>{
  const c=await call("GET","/api/products");assert.equal(c.s,200);assert.ok(c.j.products.length>0);
  const q=(items,coupon)=>call("POST","/api/quote",{items,coupon});
  let r=await q([{id:1,qty:2}]);assert.deepEqual([r.j.sub,r.j.shipping,r.j.total],[398,49,447]);
  r=await q([{id:5,qty:2}]);assert.deepEqual([r.j.sub,r.j.shipping,r.j.total],[1098,0,1098]);
  r=await q([{id:1,qty:2}],"otaku10");assert.deepEqual([r.j.discount,r.j.total],[40,407]);
  r=await q([{id:1,qty:2}],"FLAT100");assert.ok(r.j.couponError);assert.equal(r.j.total,447);
  r=await q([{id:5,qty:2}],"FLAT100");assert.equal(r.j.total,1047);
  r=await q([{id:1,qty:2}],"FREESHIP");assert.equal(r.j.total,398);
  r=await q([{id:1,qty:2}],"NOPE");assert.equal(r.j.couponError,"That coupon code isn't valid");
  for(const bad of [[],[{id:99,qty:1}],[{id:1,qty:0}],[{id:1,qty:1.5}],[{id:1,qty:21}],[{id:1,qty:1},{id:1,qty:1}],"x"]){assert.equal((await q(bad)).s,400)}
});

test("order, payment verification, tracking",async()=>{
  assert.equal((await call("POST","/api/order",{customer:{...cust,phone:"123"},items:[{id:1,qty:1}]})).s,400);
  assert.equal((await call("POST","/api/order","{bad json")).s,400);
  const o=await place([{id:1,qty:2}]);
  assert.equal(o.amount,44700);assert.equal(rz.at(-1).o.amount,44700);assert.match(rz.at(-1).auth,/^Basic /);
  assert.equal((await call("GET",`/api/track/${o.orderId}?phone=9876543210`)).s,404,"unpaid order must not track");
  assert.equal((await call("POST","/api/verify",{...pay(o),razorpay_signature:"0".repeat(64)})).s,400);
  assert.equal((await call("POST","/api/verify",pay(o))).s,200);
  assert.equal((await call("POST","/api/verify",pay(o))).s,200,"verify is repeatable");
  const t=await call("GET",`/api/track/${o.orderId.toLowerCase()}?phone=%2B91%2098765%2043210`);assert.equal(t.s,200);assert.deepEqual([t.j.stage,t.j.total],[0,447]);
  assert.equal((await call("GET",`/api/track/${o.orderId}?phone=9999999999`)).s,404);
});

test("reviews only from verified buyers",async()=>{
  const o=await place([{id:1,qty:1}]);await call("POST","/api/verify",pay(o,"pay_r"));
  const rv=(productId,extra={})=>call("POST","/api/reviews",{orderId:o.orderId,phone:cust.phone,productId,rating:5,text:"Love it",...extra});
  assert.equal((await rv(2)).s,400);assert.equal((await rv(1,{phone:"1111111111"})).s,400);assert.equal((await rv(1,{rating:9})).s,400);
  assert.equal((await rv(1)).s,200);assert.equal((await rv(1)).s,400,"one review per order");
  const l=await call("GET","/api/reviews/1");assert.equal(l.j.list[0].name,"Aarav");assert.equal(l.j.avg,5);
});

test("webhook marks paid and rejects forgeries",async()=>{
  const o=await place([{id:2,qty:1}]);
  const ev=JSON.stringify({event:"payment.captured",payload:{payment:{entity:{id:"pay_w",order_id:o.rzpOrderId,amount:o.amount}}}});
  assert.equal((await call("POST","/api/webhook",ev,{"x-razorpay-signature":"bad"})).s,400);
  assert.equal((await call("POST","/api/webhook",ev,{"x-razorpay-signature":hmac("hook",ev)})).s,200);
  assert.equal((await call("GET",`/api/track/${o.orderId}?phone=9876543210`)).s,200);
  const o2=await place([{id:2,qty:1}]);
  const wrong=JSON.stringify({event:"payment.captured",payload:{payment:{entity:{id:"pay_x",order_id:o2.rzpOrderId,amount:100}}}});
  await call("POST","/api/webhook",wrong,{"x-razorpay-signature":hmac("hook",wrong)});
  assert.equal((await call("GET",`/api/track/${o2.orderId}?phone=9876543210`)).s,404,"wrong amount must not mark paid");
});

test("admin",async()=>{
  assert.equal((await call("GET","/api/admin/orders",undefined,{"x-admin-key":"no"})).s,401);
  const l=await call("GET","/api/admin/orders",undefined,ADM);assert.equal(l.s,200);assert.ok(l.j.length>=2&&l.j.every(o=>o.paid));
  const id=l.j[0].id;
  assert.equal((await call("POST","/api/admin/orders/"+id,{stage:7},ADM)).s,400);
  const u=await call("POST","/api/admin/orders/"+id,{stage:"2",tracking:" DL123 "},ADM);assert.deepEqual([u.s,u.j.stage,u.j.tracking],[200,2,"DL123"]);
  const t=await call("GET",`/api/track/${id}?phone=9876543210`);assert.deepEqual([t.j.stage,t.j.tracking],[2,"DL123"]);
});

test("static files and path traversal",async()=>{
  const g=u=>new Promise(r=>http.get(base+u,x=>{x.resume();r(x.statusCode)}));
  assert.equal(await g("/"),200);assert.equal(await g("/admin.html"),200);
  for(const u of ["/..%2fserver.js","/..%2f.env","/%2e%2e/server.js","/nope.html"])assert.equal(await g(u),404,u);
});

test("config validation catches mistakes",()=>{
  const {validateConfig:v}=require("./server");
  const ok={shipping:49,freeShippingOver:999,products:[{id:1,name:"A",cat:"C",price:100}]};
  v(ok,{});v(require("./products.json"),require("./coupons.json"));
  const bad=[{...ok,products:[{id:1,name:"A",cat:"C",price:99.5}]},{...ok,products:[{id:1,name:"A",cat:"C",price:10},{id:1,name:"B",cat:"C",price:10}]},{...ok,products:[{id:1,name:"A",price:10}]},{...ok,shipping:"49"},{...ok,products:[{id:1,name:"A",cat:"C",price:10,c:"red;x"}]},{...ok,products:[]}];
  for(const b of bad)assert.throws(()=>v(b,{}));
  for(const cp of [{ab:{type:"flat",value:5}},{X:{type:"bogus"}},{X:{type:"percent",value:150}},{X:{type:"flat",value:5.5}}])assert.throws(()=>v(ok,cp));
});

test("pages are well formed",()=>{
  for(const f of ["index.html","admin.html"]){
    const h=fs.readFileSync(path.join(__dirname,"public",f),"utf8").replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g,"");
    const stack=[],voids=new Set(["meta","link","img","input","br","hr"]);
    for(const m of h.matchAll(/<(\/?)([a-z][a-z0-9]*)\b[^>]*?(\/?)>/gi)){
      const [,close,tag,self]=m,t=tag.toLowerCase();
      if(voids.has(t)||self)continue;
      if(close){assert.equal(stack.pop(),t,f+": mismatched </"+t+">")}else stack.push(t);
    }
    assert.deepEqual(stack,[],f+": unclosed tags");
  }
});
