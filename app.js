let products=[], cart=[], settings={};

const money = n => "৳" + Number(n||0).toLocaleString("en-BD",{maximumFractionDigits:0});
const $ = s => document.querySelector(s);

async function loadStore(){
  const r=await fetch("/api/store"); const d=await r.json();
  settings=d.settings; products=d.products;
  $("#waNumber").textContent=settings.whatsapp;
  $("#waLink").href="https://wa.me/88"+String(settings.whatsapp).replace(/\D/g,"");
  $("#bkashNumber").textContent=settings.bkash_number || "Set by store admin";
  $("#nagadNumber").textContent=settings.nagad_number || "Set by store admin";
  document.querySelector('input[name="payment_method"][value="cod"]').closest(".pay-option").style.display = settings.cod_enabled==="1" ? "" : "none";
  document.querySelector('input[name="payment_method"][value="bkash"]').closest(".pay-option").style.display = settings.bkash_enabled==="1" ? "" : "none";
  document.querySelector('input[name="payment_method"][value="nagad"]').closest(".pay-option").style.display = settings.nagad_enabled==="1" ? "" : "none";
  renderFilters(); renderProducts();
}
function renderFilters(){
  const cats=["All",...new Set(products.map(p=>p.category))];
  $("#filters").innerHTML=cats.map((c,i)=>`<button class="filter ${i===0?"active":""}" data-cat="${c}">${c}</button>`).join("");
  document.querySelectorAll(".filter").forEach(b=>b.onclick=()=>{document.querySelectorAll(".filter").forEach(x=>x.classList.remove("active"));b.classList.add("active");renderProducts(b.dataset.cat)});
}
function emojiFor(p){return ({Chicken:"🍗",Snacks:"🍟",Seafood:"🐟",Beef:"🥩",Vegetables:"🥦"})[p.category]||"❄️"}
function renderProducts(cat="All"){
  const list=cat==="All"?products:products.filter(p=>p.category===cat);
  $("#products").innerHTML=list.map(p=>{
    const first=p.variants[0];
    return `<article class="product">
      <div class="product-image">${p.image?`<img src="${esc(p.image)}" alt="${esc(p.name)}">`:`<div class="product-placeholder">${emojiFor(p)}</div>`}</div>
      <div class="product-body"><h3>${esc(p.name)}</h3><p>${esc(p.description||"Ready to cook and enjoy.")}</p>
      <div class="row"><select class="select" id="v-${p.id}">${p.variants.map(v=>`<option value="${v.grams}" data-price="${v.price}">${v.grams>=1000?(v.grams/1000)+"kg":v.grams+"g"} — ${money(v.price)}</option>`).join("")}</select><input class="qty" id="q-${p.id}" type="number" min="1" max="99" value="1"><button class="primary add" onclick="addToCart(${p.id})">Add</button></div></div>
    </article>`
  }).join("");
}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function addToCart(id){
  const p=products.find(x=>x.id===id); const grams=Number($(`#v-${id}`).value); const qty=Math.max(1,Number($(`#q-${id}`).value)||1);
  const v=p.variants.find(x=>Number(x.grams)===grams);
  const existing=cart.find(x=>x.product_id===id&&x.grams===grams);
  if(existing) existing.quantity=Math.min(99,existing.quantity+qty); else cart.push({product_id:id,name:p.name,grams,price:Number(v.price),quantity:qty});
  saveCart(); openCart();
}
function saveCart(){localStorage.setItem("ready2eat_cart",JSON.stringify(cart));renderCart()}
function renderCart(){
  $("#cartCount").textContent=cart.reduce((a,x)=>a+x.quantity,0);
  if(!cart.length){$("#cartItems").innerHTML='<div class="loading">Your cart is empty.</div>';$("#cartSubtotal").textContent=money(0);$("#cartDelivery").textContent=money(0);$("#cartTotal").textContent=money(0);$("#checkoutTotal").textContent=money(0);return}
  $("#cartItems").innerHTML=cart.map((x,i)=>`<div class="cart-item"><div class="cart-thumb">❄️</div><div><h4>${esc(x.name)}</h4><small>${x.grams>=1000?(x.grams/1000)+"kg":x.grams+"g"} × ${x.quantity} · ${money(x.price)}</small><div class="cart-controls"><button onclick="changeQty(${i},-1)">−</button><b>${x.quantity}</b><button onclick="changeQty(${i},1)">+</button><button onclick="removeItem(${i})">×</button></div></div><strong>${money(x.price*x.quantity)}</strong></div>`).join("");
  const sub=cart.reduce((a,x)=>a+x.price*x.quantity,0), fee=sub>=Number(settings.free_delivery_minimum||1000)?0:Number(settings.delivery_fee||60), total=sub+fee;
  $("#cartSubtotal").textContent=money(sub);$("#cartDelivery").textContent=fee?money(fee):"FREE";$("#cartTotal").textContent=money(total);$("#checkoutTotal").textContent=money(total);
}
function changeQty(i,d){cart[i].quantity+=d;if(cart[i].quantity<=0)cart.splice(i,1);saveCart()}
function removeItem(i){cart.splice(i,1);saveCart()}
function openCart(){$("#cartDrawer").classList.add("open");$("#backdrop").classList.add("show")}
function closeCart(){$("#cartDrawer").classList.remove("open");$("#backdrop").classList.remove("show")}
$("#openCart").onclick=openCart;$("#closeCart").onclick=closeCart;$("#backdrop").onclick=closeCart;
$("#checkoutBtn").onclick=()=>{if(!cart.length)return alert("Please add an item first.");closeCart();$("#checkoutModal").classList.add("show")};
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>$("#"+b.dataset.close).classList.remove("show"));
document.querySelectorAll('input[name="payment_method"]').forEach(x=>x.onchange=()=>$("#onlinePaymentFields").classList.toggle("hidden",x.value==="cod"?true:!x.checked));

$("#checkoutForm").onsubmit=async e=>{
 e.preventDefault(); if(!cart.length)return;
 const f=new FormData(e.target), data=Object.fromEntries(f.entries()); data.items=cart;
 if(data.payment_method!=="cod"&&!data.transaction_id.trim()){ $("#checkoutMessage").textContent="Please enter your transaction ID for online payment.";return }
 $("#checkoutMessage").textContent="Placing your order…";
 const r=await fetch("/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
 const d=await r.json();
 if(!r.ok){$("#checkoutMessage").textContent=d.error||"Could not place order.";return}
 cart=[];saveCart();e.target.reset();$("#checkoutModal").classList.remove("show");$("#orderNumber").textContent="#R2E"+String(d.order_id).padStart(5,"0");
 $("#successWhatsapp").href="https://wa.me/88"+String(d.whatsapp).replace(/\D/g,"")+"?text="+encodeURIComponent(`Hello Ready2eat, I placed order #R2E${String(d.order_id).padStart(5,"0")}.`);
 $("#successModal").classList.add("show");
};
try{cart=JSON.parse(localStorage.getItem("ready2eat_cart")||"[]")}catch{cart=[]}
loadStore().then(renderCart);
