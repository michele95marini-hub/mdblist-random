import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;

// URL MDBList (formato corretto con /json)
const LIST_URL_1 = process.env.LIST_URL_1 || "https://mdblist.com/lists/mulf95/frusciante-120min/json";
const LIST_URL_2 = process.env.LIST_URL_2 || "https://mdblist.com/lists/mulf95/frusciante-120min-ixf9w5z5br/json";

// Cache 3 ore
const CACHE_MS = 3 * 60 * 60 * 1000;
const cache = {
  one: { metas: [], ts: 0, src: LIST_URL_1 },
  two: { metas: [], ts: 0, src: LIST_URL_2 },
};

app.use(cors());

// Fisher–Yates
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Normalizza item → meta Stremio
function toMeta(item) {
  const id = String(
    item.imdb_id || item.imdbId || item.tmdb_id || item.trakt_id || item.id || ""
  ).trim();

  const name =
    item.title || item.name || item.original_title || item.originalName || "Untitled";

  const posterRaw =
    item.poster || item.poster_path || item.image || item.thumbnail || null;

  const poster =
    typeof posterRaw === "string"
      ? (posterRaw.startsWith("http")
          ? posterRaw
          : `https://image.tmdb.org/t/p/w500${posterRaw}`)
      : undefined;

  const year =
    item.year || (item.release_date ? String(item.release_date).slice(0, 4) : undefined);

  // Se manca l'id, ripiega sul nome per evitare di perdere l’item
  const safeId = id || name;

  return {
    id: safeId,
    type: "movie",
    name,
    poster,
    year: year ? Number(year) : undefined,
  };
}

async function fetchJsonSafe(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Stremio-Addon/1.0",
      "Accept": "application/json,text/plain;q=0.9,*/*;q=0.8",
    },
  });
  const text = await res.text();

  // Se è HTML, non è JSON
  if (/^\s*<(?:!DOCTYPE|html)\b/i.test(text)) {
    throw new Error(`Non-JSON (HTML) da ${url}`);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error("JSON parse error da:", url, "Primi 200 char:", text.slice(0, 200));
    throw e;
  }
}

async function loadList(which) {
  const slot = which === "one" ? cache.one : cache.two;
  const now = Date.now();

  if (!slot.metas.length || now - slot.ts > CACHE_MS) {
    console.log(`[loadList] fetch ${which} → ${slot.src}`);
    const data = await fetchJsonSafe(slot.src);
    const raw = Array.isArray(data) ? data : (data.metas || data.items || data.results || []);
    const metas = raw.map(toMeta).filter(m => m && m.id && m.name);
    slot.metas = shuffle(metas);
    slot.ts = now;
    console.log(`[loadList] ${which}: ${slot.metas.length} titoli in cache`);
  }
  return slot.metas;
}

// Manifest corretto (type sempre "movie")
app.get("/manifest.json", (_req, res) => {
  res.json({
    id: "mdblist-random",
    version: "1.0.0",
    name: "MDBList Random",
    description: "Due cataloghi MDblist mescolati (cache 3h)",
    resources: ["catalog"],
    types: ["movie"],
    catalogs: [
      { type: "movie", id: "frusciante-120",     name: "Frusciante -120min" },
      { type: "movie", id: "frusciante-120plus", name: "Frusciante +120min" },
    ],
  });
});

// Cataloghi (ritornano SEMPRE { metas: [...] })
app.get("/catalog/movie/frusciante-120.json", async (_req, res) => {
  try {
    const metas = await loadList("one");
    res.json({ metas });
  } catch (e) {
    console.error("Catalog one error:", e.message);
    res.status(200).json({ metas: [] }); // mantenere forma corretta
  }
});

app.get("/catalog/movie/frusciante-120plus.json", async (_req, res) => {
  try {
    const metas = await loadList("two");
    res.json({ metas });
  } catch (e) {
    console.error("Catalog two error:", e.message);
    res.status(200).json({ metas: [] }); // mantenere forma corretta
  }
});

// Endpoint di debug
app.get("/health", (_req, res) => {
  res.json({
    one: { count: cache.one.metas.length, cachedAt: cache.one.ts },
    two: { count: cache.two.metas.length, cachedAt: cache.two.ts },
  });
});

app.get("/debug/sample", async (_req, res) => {
  try {
    const one = await loadList("one");
    const two = await loadList("two");
    res.json({
      oneCount: one.length,
      twoCount: two.length,
      oneSample: one.slice(0, 3),
      twoSample: two.slice(0, 3),
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.listen(PORT, () => console.log(`Server attivo su :${PORT}`));
