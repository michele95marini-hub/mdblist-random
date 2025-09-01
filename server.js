import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;

const LIST_URL_1 = process.env.LIST_URL_1 || "https://mdblist.com/lists/mulf95/frusciante-120min/json";
const LIST_URL_2 = process.env.LIST_URL_2 || "https://mdblist.com/lists/mulf95/frusciante-120min-ixf9w5z5br/json";

const CACHE_MS = 3 * 60 * 60 * 1000;
const cache = {
  one: { metas: [], ts: 0 },
  two: { metas: [], ts: 0 },
};

app.use(cors());

// Shuffle Fisher–Yates
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Normalizza vari formati di item in meta Stremio
function toMeta(item) {
  // Prova diversi campi tipici di mdblist/tmdb/imdb
  const id =
    String(item.imdb_id || item.imdbId || item.tmdb_id || item.trakt_id || item.id || "").trim();
  const name = item.title || item.name || item.original_title || item.originalName || "Untitled";
  const poster =
    item.poster || item.poster_path || item.image || item.thumbnail || null;
  const year =
    item.year || (item.release_date ? String(item.release_date).slice(0, 4) : undefined);

  return {
    id: id || name,      // Stremio richiede un id, ripieghiamo sul nome
    type: "movie",
    name,
    poster: typeof poster === "string"
      ? (poster.startsWith("http") ? poster : `https://image.tmdb.org/t/p/w500${poster}`)
      : undefined,
    year: year ? Number(year) : undefined,
  };
}

async function fetchJsonSafe(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Stremio-Addon/1.0 (+https://render.com)",
      "Accept": "application/json,text/plain;q=0.9,*/*;q=0.8",
    },
    // timeout “manuale”
  });
  const text = await res.text();

  // Se risponde HTML, non è JSON
  if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
    throw new Error(`Non-JSON response (HTML) from ${url}`);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    // Log utile per capire cosa torna davvero
    console.error("JSON parse error from:", url, "First 200 chars:", text.slice(0, 200));
    throw e;
  }
}

async function loadList(which) {
  const now = Date.now();
  const slot = which === "one" ? cache.one : cache.two;
  const url = which === "one" ? LIST_URL_1 : LIST_URL_2;

  if (!slot.metas.length || now - slot.ts > CACHE_MS) {
    console.log(`[loadList] fetching ${which} from`, url);
    const data = await fetchJsonSafe(url);

    // mdblist talvolta può dare un array diretto oppure un oggetto con .metas o .items
    const raw = Array.isArray(data) ? data : (data.metas || data.items || data.results || []);
    const metas = raw.map(toMeta).filter(m => m.id && m.name);

    slot.metas = shuffle(metas);
    slot.ts = now;

    console.log(`[loadList] ${which}: cached ${slot.metas.length} items @ ${new Date(slot.ts).toISOString()}`);
  }
  return slot.metas;
}

// Manifest
app.get("/manifest.json", (req, res) => {
  res.json({
    id: "mdblist-random",
    version: "1.0.0",
    name: "MDBList Random",
    description: "Due cataloghi MDblist mescolati (cache 3h)",
    resources: ["catalog"],
    types: ["movie"],
    catalogs: [
      { type: "movie", id: "frusciante-120",     name: "Frusciante -120min" },
      { type: "movie", id: "frusciante-120plus", name: "Frusciante +120min" }
    ]
  });
});

// Cataloghi
app.get("/catalog/movie/frusciante-120.json", async (req, res) => {
  try {
    const metas = await loadList("one");
    res.json({ metas });
  } catch (e) {
    console.error("Catalog one error:", e.message);
    res.status(500).json({ metas: [] });
  }
});

app.get("/catalog/movie/frusciante-120plus.json", async (req, res) => {
  try {
    const metas = await loadList("two");
    res.json({ metas });
  } catch (e) {
    console.error("Catalog two error:", e.message);
    res.status(500).json({ metas: [] });
  }
});

app.listen(PORT, () => console.log(`Server attivo su :${PORT}`));
