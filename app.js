/* =========================================================
   app.js — MVP Ventas Sandwichería (offline con localStorage)
   - 3 pantallas: HOY / NUEVA VENTA / PRODUCTOS (CRUD)
   - Productos editables desde UI (sin tocar código)
   - Botones mini en listas (+/−/✕ y Editar/Borrar)
   - Backup productos: Exportar / Importar (JSON)
========================================================= */

const STORAGE_KEY = "sandwicheria_store_v2";
const OLD_KEYS = ["sandwicheria_store_v1"]; // para migrar si existía algo previo

/* -------------------------
   Helpers fecha / storage
------------------------- */
function isoToday() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function loadJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function loadStoreAny() {
  const current = loadJSON(STORAGE_KEY);
  if (current) return current;

  // si hay store viejo, lo traemos para no perder ventas
  for (const k of OLD_KEYS) {
    const old = loadJSON(k);
    if (old) return old;
  }
  return null;
}

function saveStore(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function uid(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`;
}

const moneyFmt = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
function money(n) {
  const val = Number(n) || 0;
  return `$${moneyFmt.format(val)}`;
}

function formatTopDate(d = new Date()) {
  const weekday = new Intl.DateTimeFormat("es-AR", { weekday: "short" }).format(d);
  const dm = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit" }).format(d);
  const w = weekday.replace(".", "");
  return `${w.charAt(0).toUpperCase() + w.slice(1)} ${dm}`;
}

function formatTime(ts) {
  return new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit" }).format(new Date(ts));
}

/* -------------------------
   Defaults (solo primer arranque)
------------------------- */
const DEFAULT_PRODUCTS = [
  { id: uid("p"), category: "Lomitos", name: "Lomito completo", prices: { unidad: 4500 } },
  { id: uid("p"), category: "Lomitos", name: "Lomito simple", prices: { unidad: 3800 } },
  { id: uid("p"), category: "Hamburguesas", name: "Hamburguesa clásica", prices: { unidad: 3200 } },
  { id: uid("p"), category: "Hamburguesas", name: "Hamburguesa completa", prices: { unidad: 3900 } },
  { id: uid("p"), category: "Bebidas", name: "Coca Cola 500ml", prices: { unidad: 1500 } },
  { id: uid("p"), category: "Bebidas", name: "Agua 500ml", prices: { unidad: 900 } },
];

/* -------------------------
   Estado global
------------------------- */
let store = null;
let cart = [];
let editingProductId = null;

/* -------------------------
   DOM refs
------------------------- */
const el = {
  // Screens
  screenHoy: document.getElementById("screen-hoy"),
  screenVenta: document.getElementById("screen-venta"),
  screenProducts: document.getElementById("screen-products"),

  // Top
  dateText: document.getElementById("dateText"),

  // HOY KPIs
  totalDia: document.getElementById("totalDia"),
  kpiVentas: document.getElementById("kpiVentas"),
  kpiItems: document.getElementById("kpiItems"),
  kpiPromedio: document.getElementById("kpiPromedio"),
  listaVentas: document.getElementById("listaVentas"),

  // HOY botones
  btnNuevaVenta: document.getElementById("btnNuevaVenta"),
  btnExportCSV: document.getElementById("btnExportCSV"),
  btnNewDay: document.getElementById("btnNewDay"),
  btnCierre: document.getElementById("btnCierre"),
  btnProductos: document.getElementById("btnProductos"),

  // VENTA
  ventaInfo: document.getElementById("ventaInfo"),
  totalTicket: document.getElementById("totalTicket"),
  btnCancelarVenta: document.getElementById("btnCancelarVenta"),
  btnGuardarVenta: document.getElementById("btnGuardarVenta"),
  selCategoria: document.getElementById("selCategoria"),
  selProducto: document.getElementById("selProducto"),
  inpCantidad: document.getElementById("inpCantidad"),
  selPrecio: document.getElementById("selPrecio"),
  btnAgregarItem: document.getElementById("btnAgregarItem"),
  listaItems: document.getElementById("listaItems"),
  hintVacio: document.getElementById("hintVacio"),

  // PRODUCTOS
  btnVolverDesdeProductos: document.getElementById("btnVolverDesdeProductos"),
  categoriesList: document.getElementById("categoriesList"),
  prodCategory: document.getElementById("prodCategory"),
  prodName: document.getElementById("prodName"),
  prodPriceUnidad: document.getElementById("prodPriceUnidad"),
  prodPriceDocena: document.getElementById("prodPriceDocena"),
  btnSaveProduct: document.getElementById("btnSaveProduct"),
  btnCancelProductEdit: document.getElementById("btnCancelProductEdit"),
  listaProductos: document.getElementById("listaProductos"),
  hintProductosVacio: document.getElementById("hintProductosVacio"),

  // BACKUP productos
  btnExportProductos: document.getElementById("btnExportProductos"),
  btnImportProductos: document.getElementById("btnImportProductos"),
  fileImportProductos: document.getElementById("fileImportProductos"),
};

/* -------------------------
   Store init / day
------------------------- */
function ensureStore() {
  const todayISO = isoToday();
  const loaded = loadStoreAny();

  if (!loaded) {
    store = {
      schemaVersion: 2,
      currentDay: todayISO,
      days: {},
      products: DEFAULT_PRODUCTS,
    };
  } else {
    store = loaded;

    // Normalizar / migrar a v2
    store.schemaVersion = 2;
    store.days = store.days || {};
    store.currentDay = store.currentDay || todayISO;

    if (!store.products || !Array.isArray(store.products) || store.products.length === 0) {
      store.products = DEFAULT_PRODUCTS;
    }
  }

  // Cambio de fecha automático
  if (store.currentDay !== todayISO) {
    store.currentDay = todayISO;
  }

  if (!store.days[store.currentDay]) {
    store.days[store.currentDay] = { date: store.currentDay, sales: [] };
  }

  saveStore(store);
}

function getDayData() {
  return store.days[store.currentDay] || { date: store.currentDay, sales: [] };
}

/* -------------------------
   Navegación
------------------------- */
function showHoy() {
  el.screenHoy.hidden = false;
  el.screenVenta.hidden = true;
  el.screenProducts.hidden = true;
}
function showVenta() {
  el.screenHoy.hidden = true;
  el.screenVenta.hidden = false;
  el.screenProducts.hidden = true;
}
function showProducts() {
  el.screenHoy.hidden = true;
  el.screenVenta.hidden = true;
  el.screenProducts.hidden = false;
}

/* -------------------------
   Productos (Store)
------------------------- */
function getProducts() {
  return store.products || [];
}

function setProducts(products) {
  store.products = products;
  saveStore(store);
  refreshProductDependentUI();
}

function getCategories() {
  const cats = new Set();
  for (const p of getProducts()) {
    const c = (p.category || "").trim();
    if (c) cats.add(c);
  }
  return Array.from(cats).sort((a, b) => a.localeCompare(b, "es"));
}

function refreshProductDependentUI() {
  // datalist categorías (admin)
  const cats = getCategories();
  if (el.categoriesList) {
    el.categoriesList.innerHTML = "";
    for (const c of cats) {
      const opt = document.createElement("option");
      opt.value = c;
      el.categoriesList.appendChild(opt);
    }
  }

  // selector categorías (venta)
  const prevCat = el.selCategoria.value;
  el.selCategoria.innerHTML = `<option value="">Elegí…</option>`;
  for (const c of cats) {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    el.selCategoria.appendChild(opt);
  }
  if (cats.includes(prevCat)) el.selCategoria.value = prevCat;

  renderProductsList();

  if (!el.screenVenta.hidden) {
    onCategoryChange();
  }
}

/* -------------------------
   Render HOY
------------------------- */
function computeDayStats(day) {
  const sales = day.sales || [];
  let total = 0;
  let itemsQty = 0;

  for (const s of sales) {
    total += Number(s.total) || 0;
    for (const it of (s.items || [])) itemsQty += Number(it.qty) || 0;
  }

  const ventas = sales.length;
  const promedio = ventas > 0 ? total / ventas : 0;
  return { total, ventas, itemsQty, promedio };
}

function renderHoy() {
  el.dateText.textContent = formatTopDate(new Date());

  const day = getDayData();
  const stats = computeDayStats(day);

  el.totalDia.textContent = money(stats.total);
  el.kpiVentas.textContent = String(stats.ventas);
  el.kpiItems.textContent = String(stats.itemsQty);
  el.kpiPromedio.textContent = money(stats.promedio);

  const salesSorted = [...(day.sales || [])].sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const last = salesSorted.slice(0, 10);

  el.listaVentas.innerHTML = "";
  for (const s of last) {
    const li = document.createElement("li");

    const left = document.createElement("span");
    left.innerHTML = `<span class="time">${formatTime(s.ts)}</span> · Venta`;

    const right = document.createElement("strong");
    right.textContent = money(s.total);

    li.appendChild(left);
    li.appendChild(right);
    el.listaVentas.appendChild(li);
  }
}

/* -------------------------
   Nueva Venta
------------------------- */
function resetVentaForm() {
  cart = [];
  el.totalTicket.textContent = money(0);

  el.selCategoria.value = "";
  el.selProducto.innerHTML = `<option value="">Elegí…</option>`;
  el.inpCantidad.value = 1;
  el.selPrecio.value = "unidad";
  setDocenaEnabled(false);

  el.btnAgregarItem.disabled = true;
  el.btnGuardarVenta.disabled = true;

  renderCart();
}

function productsByCategory(category) {
  return getProducts().filter((p) => p.category === category);
}

function onCategoryChange() {
  const cat = el.selCategoria.value;
  const list = productsByCategory(cat);

  el.selProducto.innerHTML = `<option value="">Elegí…</option>`;
  for (const p of list) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name;
    el.selProducto.appendChild(opt);
  }

  el.btnAgregarItem.disabled = true;
  setDocenaEnabled(false);
}

function getSelectedProduct() {
  const id = el.selProducto.value;
  return getProducts().find((p) => p.id === id) || null;
}

function setDocenaEnabled(enabled) {
  const optDocena = Array.from(el.selPrecio.options).find((o) => o.value === "docena");
  if (optDocena) optDocena.disabled = !enabled;
  if (!enabled && el.selPrecio.value === "docena") el.selPrecio.value = "unidad";
}

function onProductChange() {
  const p = getSelectedProduct();
  el.btnAgregarItem.disabled = !p;

  const hasDocena = !!(p && p.prices && Number(p.prices.docena) > 0);
  setDocenaEnabled(hasDocena);
}

function getUnitPrice(product, priceType) {
  if (!product || !product.prices) return 0;
  const price = Number(product.prices[priceType] ?? 0);
  if (!price) return 0;
  return price;
}

function addItemToCart() {
  const product = getSelectedProduct();
  if (!product) return;

  const qty = Math.max(1, parseInt(el.inpCantidad.value || "1", 10));
  const priceType = el.selPrecio.value || "unidad";
  const unitPrice = getUnitPrice(product, priceType);

  if (!unitPrice) {
    alert("Ese producto no tiene precio cargado para ese tipo.");
    return;
  }

  const existing = cart.find((it) => it.productId === product.id && it.priceType === priceType);
  if (existing) {
    existing.qty += qty;
    existing.lineTotal = existing.qty * existing.unitPrice;
  } else {
    cart.push({
      id: uid("it"),
      productId: product.id,
      name: product.name,
      category: product.category,
      priceType,
      unitPrice,
      qty,
      lineTotal: qty * unitPrice,
    });
  }

  el.inpCantidad.value = 1;
  renderCart();
}

function cartTotal() {
  return cart.reduce((acc, it) => acc + (Number(it.lineTotal) || 0), 0);
}

function renderCart() {
  el.listaItems.innerHTML = "";
  el.hintVacio.hidden = cart.length !== 0;

  for (const it of cart) {
    const li = document.createElement("li");

    const left = document.createElement("span");
    left.innerHTML = `<strong>${it.qty}×</strong> ${it.name} <span class="time">· ${it.priceType}</span>`;

    const right = document.createElement("div");
    right.className = "rightControls";

    const total = document.createElement("strong");
    total.textContent = money(it.lineTotal);

    const btnMinus = document.createElement("button");
    btnMinus.type = "button";
    btnMinus.className = "miniBtn";
    btnMinus.textContent = "−";
    btnMinus.title = "Restar 1";
    btnMinus.addEventListener("click", () => {
      it.qty = Math.max(1, it.qty - 1);
      it.lineTotal = it.qty * it.unitPrice;
      renderCart();
    });

    const btnPlus = document.createElement("button");
    btnPlus.type = "button";
    btnPlus.className = "miniBtn";
    btnPlus.textContent = "+";
    btnPlus.title = "Sumar 1";
    btnPlus.addEventListener("click", () => {
      it.qty += 1;
      it.lineTotal = it.qty * it.unitPrice;
      renderCart();
    });

    const btnDel = document.createElement("button");
    btnDel.type = "button";
    btnDel.className = "miniBtn danger";
    btnDel.textContent = "✕";
    btnDel.title = "Borrar ítem";
    btnDel.addEventListener("click", () => {
      cart = cart.filter((x) => x.id !== it.id);
      renderCart();
    });

    right.appendChild(total);
    right.appendChild(btnMinus);
    right.appendChild(btnPlus);
    right.appendChild(btnDel);

    li.appendChild(left);
    li.appendChild(right);
    el.listaItems.appendChild(li);
  }

  el.totalTicket.textContent = money(cartTotal());
  el.btnGuardarVenta.disabled = cart.length === 0;
}

function saveSale() {
  if (cart.length === 0) return;

  const day = getDayData();
  const ts = Date.now();

  const sale = {
    id: uid("s"),
    ts,
    items: cart.map((it) => ({ ...it })),
    total: cartTotal(),
  };

  day.sales.push(sale);
  store.days[store.currentDay] = day;
  saveStore(store);

  showHoy();
  renderHoy();
}

function cancelSale() {
  if (cart.length > 0) {
    const ok = confirm("¿Cancelar la venta actual? Se perderán los ítems.");
    if (!ok) return;
  }
  showHoy();
}

/* -------------------------
   Export CSV
------------------------- */
function exportCSV() {
  const day = getDayData();
  const sales = day.sales || [];
  if (sales.length === 0) {
    alert("No hay ventas para exportar hoy.");
    return;
  }

  const headers = [
    "date",
    "time",
    "sale_id",
    "category",
    "product",
    "price_type",
    "qty",
    "unit_price",
    "line_total",
    "sale_total",
  ];
  const rows = [headers.join(";")];

  for (const s of sales) {
    const time = formatTime(s.ts);
    for (const it of (s.items || [])) {
      const row = [
        day.date,
        time,
        s.id,
        it.category,
        it.name,
        it.priceType,
        it.qty,
        it.unitPrice,
        it.lineTotal,
        s.total,
      ].map((v) => `"${String(v).replaceAll('"', '""')}"`);
      rows.push(row.join(";"));
    }
  }

  const csv = rows.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `ventas_${day.date}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

/* -------------------------
   Nuevo día (manual)
------------------------- */
function newDayManual() {
  const ok = confirm("¿Empezar un nuevo día ahora? Esto vacía las ventas del día actual.");
  if (!ok) return;

  store.days[store.currentDay] = { date: store.currentDay, sales: [] };
  saveStore(store);
  renderHoy();
}

/* -------------------------
   Cierre de caja (mínimo útil)
------------------------- */
function cierreCaja() {
  const day = getDayData();
  const { total, ventas, itemsQty, promedio } = computeDayStats(day);

  alert(
    `Cierre de caja (hoy)\n` +
      `Ventas: ${ventas}\n` +
      `Items: ${itemsQty}\n` +
      `Total: ${money(total)}\n` +
      `Promedio: ${money(promedio)}`
  );
}

/* -------------------------
   PRODUCTOS — CRUD UI
------------------------- */
function resetProductForm() {
  editingProductId = null;
  el.prodCategory.value = "";
  el.prodName.value = "";
  el.prodPriceUnidad.value = "";
  el.prodPriceDocena.value = "";
  el.btnCancelProductEdit.disabled = true;
  el.btnSaveProduct.textContent = "Guardar producto";
}

function startEditProduct(productId) {
  const p = getProducts().find((x) => x.id === productId);
  if (!p) return;

  editingProductId = p.id;
  el.prodCategory.value = p.category || "";
  el.prodName.value = p.name || "";
  el.prodPriceUnidad.value = Number(p.prices?.unidad ?? 0) || "";
  el.prodPriceDocena.value = Number(p.prices?.docena ?? 0) || "";

  el.btnCancelProductEdit.disabled = false;
  el.btnSaveProduct.textContent = "Guardar cambios";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function deleteProduct(productId) {
  const p = getProducts().find((x) => x.id === productId);
  if (!p) return;

  const ok = confirm(`¿Eliminar "${p.name}"?`);
  if (!ok) return;

  const next = getProducts().filter((x) => x.id !== productId);
  setProducts(next);

  if (editingProductId === productId) resetProductForm();
}

function saveProductFromForm() {
  const category = (el.prodCategory.value || "").trim();
  const name = (el.prodName.value || "").trim();
  const unidad = Number(el.prodPriceUnidad.value || 0);
  const docenaRaw = el.prodPriceDocena.value;
  const docena = docenaRaw === "" ? 0 : Number(docenaRaw || 0);

  if (!category) return alert("Poné una categoría.");
  if (!name) return alert("Poné un nombre.");
  if (!unidad || unidad <= 0) return alert("Poné un precio unidad válido (mayor a 0).");
  if (docenaRaw !== "" && (isNaN(docena) || docena < 0)) return alert("Precio docena inválido.");

  const products = [...getProducts()];
  const payload = {
    category,
    name,
    prices: { unidad, ...(docena > 0 ? { docena } : {}) },
  };

  if (editingProductId) {
    const idx = products.findIndex((p) => p.id === editingProductId);
    if (idx === -1) return alert("No se encontró el producto para editar.");
    products[idx] = { ...products[idx], ...payload };
  } else {
    products.push({ id: uid("p"), ...payload });
  }

  setProducts(products);
  resetProductForm();
}

function renderProductsList() {
  const products = getProducts();
  el.listaProductos.innerHTML = "";
  el.hintProductosVacio.hidden = products.length !== 0;

  const sorted = [...products].sort((a, b) => {
    const c = (a.category || "").localeCompare(b.category || "", "es");
    if (c !== 0) return c;
    return (a.name || "").localeCompare(b.name || "", "es");
  });

  for (const p of sorted) {
    const li = document.createElement("li");

    const left = document.createElement("span");
    const u = Number(p.prices?.unidad || 0);
    const d = Number(p.prices?.docena || 0);

    left.innerHTML =
      `<strong>${p.name}</strong> <span class="time">· ${p.category}</span>` +
      `<div class="time" style="margin-top:4px;">Unidad: ${money(u)}${d ? ` · Docena: ${money(d)}` : ""}</div>`;

    const right = document.createElement("div");
    right.className = "rightControls";

    const btnEdit = document.createElement("button");
    btnEdit.type = "button";
    btnEdit.className = "miniBtn";
    btnEdit.textContent = "Editar";
    btnEdit.addEventListener("click", () => startEditProduct(p.id));

    const btnDel = document.createElement("button");
    btnDel.type = "button";
    btnDel.className = "miniBtn danger";
    btnDel.textContent = "Borrar";
    btnDel.addEventListener("click", () => deleteProduct(p.id));

    right.appendChild(btnEdit);
    right.appendChild(btnDel);

    li.appendChild(left);
    li.appendChild(right);
    el.listaProductos.appendChild(li);
  }
}

/* -------------------------
   BACKUP Productos (Export / Import)
------------------------- */
function downloadTextFile(filename, text, mime = "application/json") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportProductosJSON() {
  const data = {
    schema: "products-v1",
    exportedAt: new Date().toISOString(),
    products: getProducts(),
  };
  const yyyy = new Date().toISOString().slice(0, 10);
  downloadTextFile(`productos-${yyyy}.json`, JSON.stringify(data, null, 2));
}

function validateImportedProducts(products) {
  if (!Array.isArray(products)) throw new Error("El archivo no contiene un array de productos.");

  for (const p of products) {
    if (!p || typeof p !== "object") throw new Error("Producto inválido.");
    if (!p.id || !p.name || !p.category) throw new Error("Faltan campos (id, name, category).");
    if (!p.prices || typeof p.prices !== "object") throw new Error("Falta prices{}.");

    const unidad = Number(p.prices.unidad || 0);
    const docena = p.prices.docena == null ? 0 : Number(p.prices.docena);

    if (!unidad || unidad <= 0) throw new Error(`Precio unidad inválido en: ${p.name}`);
    if (isNaN(docena) || docena < 0) throw new Error(`Precio docena inválido en: ${p.name}`);
  }
}

async function importProductosJSON(file) {
  const text = await file.text();
  const parsed = JSON.parse(text);

  const products = Array.isArray(parsed) ? parsed : parsed.products;
  validateImportedProducts(products);

  setProducts(products);
  alert("Productos importados OK ✅");
}

/* -------------------------
   Eventos
------------------------- */
function bindEvents() {
  // HOY
  el.btnNuevaVenta.addEventListener("click", () => {
    resetVentaForm();
    showVenta();
  });
  el.btnExportCSV.addEventListener("click", exportCSV);
  el.btnNewDay.addEventListener("click", newDayManual);
  el.btnCierre.addEventListener("click", cierreCaja);

  el.btnProductos.addEventListener("click", () => {
    resetProductForm();
    renderProductsList();
    showProducts();
  });

  // VENTA
  el.btnCancelarVenta.addEventListener("click", cancelSale);
  el.btnGuardarVenta.addEventListener("click", saveSale);

  el.selCategoria.addEventListener("change", onCategoryChange);
  el.selProducto.addEventListener("change", onProductChange);

  el.btnAgregarItem.addEventListener("click", addItemToCart);

  el.inpCantidad.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && el.selProducto.value) addItemToCart();
  });

  // PRODUCTOS
  el.btnVolverDesdeProductos.addEventListener("click", () => {
    showHoy();
    renderHoy();
  });

  el.btnSaveProduct.addEventListener("click", saveProductFromForm);
  el.btnCancelProductEdit.addEventListener("click", resetProductForm);

  // BACKUP Productos
  if (el.btnExportProductos) {
    el.btnExportProductos.addEventListener("click", exportProductosJSON);
  }

  if (el.btnImportProductos && el.fileImportProductos) {
    el.btnImportProductos.addEventListener("click", () => el.fileImportProductos.click());

    el.fileImportProductos.addEventListener("change", async () => {
      const file = el.fileImportProductos.files?.[0];
      if (!file) return;

      try {
        await importProductosJSON(file);
      } catch (e) {
        alert("No pude importar: " + (e?.message || "archivo inválido"));
      } finally {
        el.fileImportProductos.value = "";
      }
    });
  }
}

/* -------------------------
   Init
------------------------- */
function init() {
  ensureStore();
  el.dateText.textContent = formatTopDate(new Date());

  showHoy();
  bindEvents();

  refreshProductDependentUI();
  renderHoy();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

document.addEventListener("DOMContentLoaded", init);
