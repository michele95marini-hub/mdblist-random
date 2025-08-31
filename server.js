import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;

// URL delle due liste (metti i .json corretti)
const LIST_URL_1 = process.env.LIST_URL_1 || "https://mdblist.com/lists/mulf95/frusciante-120min.json";
const LIST_URL_2 = process.env.LIST_URL_2 || "https://mdblist.com/lists/mulf95/frusciante-120min-ixf9w5z5br.json";

// cache in memoria (3 ore)
const CACHE_MS = 3 * 60 * 60 * 1000;
const cache = {
  one: { metas: [], ts: 0 },
  two: { metas: [], ts: 0 }
};

app.use(cors());

// shuffle Fisher–Yates
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function loadList(which) {
  const now = Date.now();
  const slot = which === "one" ? cache.one : cache.two;
  const url = which === "one" ? LIST_URL_1 : LIST_URL_2;

  if (!slot.metas.length || now - slot.ts > CACHE_MS) {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }});
    // MDblist deve rispondere JSON con un array "metas" o un array simple
    const data = await res.json();
    const metas = Array.isArray(data) ? data : (data.metas || data);
    slot.metas = shuffle(metas || []);
    slot.ts = now;
  }
  return slot.metas;
}

// Manifest (facoltativo, ma utile se lo aggiungi come addon “da URL”)
app.get("/manifest.json", (req, res) => {
  res.json({
    id: "mdblist-random",
    version: "1.0.0",
    name: "MDBList Random",
    description: "Due cataloghi MDblist mescolati (cache 3h)",
    resources: ["catalog"],
    types: ["movie"],
    catalogs: [
      { type: "movie", id: "frusciante-120", name: "Frusciante -120min" },
      { type: "movie", id: "frusciante-120plus", name: "Frusciante +120min" }
    ]
  });
});

// Catalogo 1 (-120)
app.get("/catalog/movie/frusciante-120.json", async (req, res) => {
  try {
    const metas = await loadList("one");
    res.json({ metas });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Catalogo 2 (+120)
app.get("/catalog/movie/frusciante-120plus.json", async (req, res) => {
  try {
    const metas = await loadList("two");
    res.json({ metas });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.listen(PORT, () => {
  console.log(`Server attivo su :${PORT}`);
});
