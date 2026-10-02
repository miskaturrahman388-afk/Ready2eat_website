const express = require("express");
const session = require("express-session");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_USER = process.env.ADMIN_USER || "adminmtf";
const ADMIN_PASS = process.env.ADMIN_PASS || "adminmtf03";
const WHATSAPP = process.env.WHATSAPP || "01533347873";
const NAGAD_NUMBER = process.env.NAGAD_NUMBER || "01625834419";
const BKASH_NUMBER = process.env.BKASH_NUMBER || "01625834419";

const db = new Database(path.join(__dirname, "ready2eat.db"));
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT DEFAULT '',
  image TEXT DEFAULT '',
  variants TEXT NOT NULL,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  whatsapp TEXT DEFAULT '',
  address TEXT NOT NULL,
  division TEXT DEFAULT '',
  district TEXT DEFAULT '',
  upazila TEXT DEFAULT '',
  area TEXT DEFAULT '',
  city TEXT DEFAULT 'Dhaka',
  postal_code TEXT DEFAULT '',
  payment_method TEXT NOT NULL,
  payment_number TEXT DEFAULT '',
  transaction_id TEXT DEFAULT '',
  subtotal REAL NOT NULL,
  delivery_fee REAL NOT NULL,
  total REAL NOT NULL,
  status TEXT DEFAULT 'Pending',
  items TEXT NOT NULL,
  notes TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);


for (const col of [
  ["division","TEXT DEFAULT ''"],
  ["district","TEXT DEFAULT ''"],
  ["upazila","TEXT DEFAULT ''"]
]) {
  try { db.exec(`ALTER TABLE orders ADD COLUMN ${col[0]} ${col[1]}`); } catch(e) {}
}

const defaultSettings = {
  store_name: "Ready2eat",
  tagline: "Good Food, Anytime",
  whatsapp: WHATSAPP,
  nagad_number: NAGAD_NUMBER,
  bkash_number: "",
  cod_enabled: "1",
  bkash_enabled: "1",
  nagad_enabled: "1",
  delivery_fee: "60",
  free_delivery_minimum: "1000"
};
const insertSetting = db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)");
for (const [k,v] of Object.entries(defaultSettings)) insertSetting.run(k, v);

const count = db.prepare("SELECT COUNT(*) AS c FROM products").get().c;
if (count === 0) {
  const ins = db.prepare(`
    INSERT INTO products(name,category,description,image,variants)
    VALUES(?,?,?,?,?)
  `);
  const seed = [
    ["Chicken Nuggets","Chicken","Crispy chicken nuggets, ready to fry.","","[{\"grams\":250,\"price\":220},{\"grams\":500,\"price\":410},{\"grams\":1000,\"price\":780}]"],
    ["Chicken Sausage","Chicken","Juicy frozen chicken sausage.","","[{\"grams\":250,\"price\":190},{\"grams\":500,\"price\":360},{\"grams\":1000,\"price\":680}]"],
    ["Chicken Spring Roll","Snacks","Crispy frozen spring rolls.","","[{\"grams\":250,\"price\":180},{\"grams\":500,\"price\":340},{\"grams\":1000,\"price\":640}]"],
    ["French Fries","Snacks","Classic crispy-cut frozen fries.","","[{\"grams\":500,\"price\":240},{\"grams\":1000,\"price\":440},{\"grams\":2000,\"price\":820}]"],
    ["Chicken Momos","Snacks","Frozen chicken momos for quick meals.","","[{\"grams\":250,\"price\":200},{\"grams\":500,\"price\":380},{\"grams\":1000,\"price\":720}]"],
    ["Fish Finger","Seafood","Golden crispy frozen fish fingers.","","[{\"grams\":250,\"price\":260},{\"grams\":500,\"price\":500},{\"grams\":1000,\"price\":960}]"]
  ];
  for (const row of seed) ins.run(...row);
}

app.use(express.json({limit:"2mb"}));
app.use(express.urlencoded({extended:true}));
app.use(session({
  secret: process.env.SESSION_SECRET || "ready2eat-change-this-secret",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly:true, sameSite:"lax", secure:process.env.NODE_ENV==="production", maxAge: 1000*60*60*8 }
}));

function settingsObj(){
  return Object.fromEntries(db.prepare("SELECT key,value FROM settings").all().map(x=>[x.key,x.value]));
}
function auth(req,res,next){
  if (!req.session.admin) return res.status(401).json({error:"Unauthorized"});
  next();
}

app.get("/api/store", (req,res)=>{
  const settings = settingsObj();
  const products = db.prepare("SELECT * FROM products WHERE active=1 ORDER BY id DESC").all()
    .map(p=>({...p,variants:JSON.parse(p.variants)}));
  res.json({settings, products});
});

app.post("/api/admin/login",(req,res)=>{
  const {username,password}=req.body||{};
  if(username===ADMIN_USER && password===ADMIN_PASS){
    req.session.admin=true;
    res.json({ok:true});
  } else res.status(401).json({error:"Invalid admin credentials"});
});
app.post("/api/admin/logout",(req,res)=>req.session.destroy(()=>res.json({ok:true})));
app.get("/api/admin/me",(req,res)=>res.json({authenticated:!!req.session.admin}));

app.get("/api/admin/orders",auth,(req,res)=>{
  const orders=db.prepare("SELECT * FROM orders ORDER BY id DESC").all();
  res.json(orders.map(o=>({...o,items:JSON.parse(o.items)})));
});
app.patch("/api/admin/orders/:id",auth,(req,res)=>{
  const allowed=["Pending","Accepted","Preparing","Out for Delivery","Delivered","Cancelled"];
  if(!allowed.includes(req.body.status)) return res.status(400).json({error:"Invalid status"});
  db.prepare("UPDATE orders SET status=? WHERE id=?").run(req.body.status,req.params.id);
  res.json({ok:true});
});
app.delete("/api/admin/orders/:id",auth,(req,res)=>{
  db.prepare("DELETE FROM orders WHERE id=?").run(req.params.id);
  res.json({ok:true});
});

app.get("/api/admin/products",auth,(req,res)=>{
  res.json(db.prepare("SELECT * FROM products ORDER BY id DESC").all().map(p=>({...p,variants:JSON.parse(p.variants)})));
});
app.post("/api/admin/products",auth,(req,res)=>{
  const {name,category,description,image,variants,active=true}=req.body;
  if(!name || !category || !Array.isArray(variants) || !variants.length) return res.status(400).json({error:"Name, category and variants are required"});
  const clean=variants.map(v=>({grams:Number(v.grams),price:Number(v.price)})).filter(v=>v.grams>0&&v.price>=0);
  const info=db.prepare("INSERT INTO products(name,category,description,image,variants,active) VALUES(?,?,?,?,?,?)")
    .run(name,category,description||"",image||"",JSON.stringify(clean),active?1:0);
  res.json({id:info.lastInsertRowid});
});
app.put("/api/admin/products/:id",auth,(req,res)=>{
  const {name,category,description,image,variants,active=true}=req.body;
  const clean=(variants||[]).map(v=>({grams:Number(v.grams),price:Number(v.price)})).filter(v=>v.grams>0&&v.price>=0);
  db.prepare("UPDATE products SET name=?,category=?,description=?,image=?,variants=?,active=? WHERE id=?")
    .run(name,category,description||"",image||"",JSON.stringify(clean),active?1:0,req.params.id);
  res.json({ok:true});
});
app.delete("/api/admin/products/:id",auth,(req,res)=>{
  db.prepare("DELETE FROM products WHERE id=?").run(req.params.id);
  res.json({ok:true});
});

app.get("/api/admin/settings",auth,(req,res)=>res.json(settingsObj()));
app.put("/api/admin/settings",auth,(req,res)=>{
  const allowed=["store_name","tagline","whatsapp","nagad_number","bkash_number","cod_enabled","bkash_enabled","nagad_enabled","delivery_fee","free_delivery_minimum"];
  const up=db.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value");
  const tx=db.transaction((body)=>allowed.forEach(k=>{if(body[k]!==undefined) up.run(k,String(body[k]));}));
  tx(req.body||{});
  res.json({ok:true,settings:settingsObj()});
});

app.post("/api/orders",(req,res)=>{
  const {customer_name,phone,whatsapp,address,division,district,upazila,area,city,postal_code,payment_method,payment_number,transaction_id,items,notes}=req.body||{};
  if(!customer_name||!phone||!address||!payment_method||!Array.isArray(items)||!items.length) return res.status(400).json({error:"Please complete customer, address, payment and cart information."});
  const productRows=db.prepare("SELECT * FROM products WHERE active=1").all();
  const map=new Map(productRows.map(p=>[p.id,p]));
  let subtotal=0;
  const safeItems=[];
  for(const item of items){
    const p=map.get(Number(item.product_id));
    const v=(p?.variants?JSON.parse(p.variants):[]).find(x=>Number(x.grams)===Number(item.grams));
    const qty=Math.max(1,Math.min(99,Number(item.quantity)||1));
    if(!p||!v) return res.status(400).json({error:"One or more cart items are no longer available."});
    subtotal += Number(v.price)*qty;
    safeItems.push({product_id:p.id,name:p.name,grams:Number(v.grams),price:Number(v.price),quantity:qty});
  }
  const s=settingsObj();
  const delivery = subtotal >= Number(s.free_delivery_minimum||1000) ? 0 : Number(s.delivery_fee||60);
  const total=subtotal+delivery;
  const info=db.prepare(`
    INSERT INTO orders(customer_name,phone,whatsapp,address,division,district,upazila,area,city,postal_code,payment_method,payment_number,transaction_id,subtotal,delivery_fee,total,status,items,notes)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'Pending',?,?)
  `).run(customer_name,phone,whatsapp||"",address,division||"",district||"",upazila||"",area||"",city||"Dhaka",postal_code||"",payment_method,payment_number||"",transaction_id||"",subtotal,delivery,total,JSON.stringify(safeItems),notes||"");
  res.json({ok:true,order_id:info.lastInsertRowid,total,delivery_fee:delivery,whatsapp:s.whatsapp});
});

app.use(express.static(path.join(__dirname,"public")));
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));

app.listen(PORT,()=>console.log(`Ready2eat running on port ${PORT}`));
