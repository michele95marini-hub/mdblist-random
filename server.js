import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;

const LIST_URL_1 = process.env.LIST_URL_1 || "https://mdblist.com/lists/mulf95/frusciante-120min/json";
const LIST_URL_2 = process.env.LIST_URL_2 || "https://mdblist.com/lists/mulf95/frusciante-120min-ixf9w5z5br/json";

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
  // MDblist può usare vari nomi campo
  const id = String(
    item.imdb_id || item.imdbId || item.tmdb_id || item.trakt_id || item.id || ""
  ).trim();

  // titolo può comparire come title/name/original_title/nome
  const name =
    item.title || item.name || item.original_title || item.originalName || item.nome || "Untitled";

  // poster può essere url o path TMDB
  const posterRaw = item.poster || item.poster_path || item.image || item.thumbnail || null;
  const poster =
    typeof posterRaw === "string"
      ? (posterRaw.startsWith("http")
          ? posterRaw
          : `https://image.tmdb.org/t/p/w500${posterRaw}`)
      : undefined;

  const year =
    item.year || (item.release_date ? String(item.release_date).slice(0, 4) : undefined);

  const safeId = id || name;

  return {
    id: safeId,
    type: "movie", // forza sempre "movie" (niente "film")
    name,
    poster,
    year: year ? Number(year) : undefined,
  };
}

// Mantiene solo le chiavi consentite
function pickMetaFields(m) {
  return {
    id: m.id,
    type: "movie",
    name: m.name,
    poster: m.poster,
    year: m.year,
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
  if (/^\s*<(?:!DOCTYPE|html)\b/i.test(text)) throw new Error(`Non-JSON (HTML) da ${url}`);
  return JSON.parse(text);
}

async function loadList(which) {
  const slot = which === "one" ? cache.one : cache.two;
  const now = Date.now();

  if (!slot.metas.length || now - slot.ts > CACHE_MS) {
    const data = await fetchJsonSafe(slot.src);
    const raw = Array.isArray(data) ? data : (data.metas || data.items || data.results || []);
    const metas = raw.map(toMeta).filter(m => m.id && m.name).map(pickMetaFields);
    slot.metas = shuffle(metas);
    slot.ts = now;
  }
  return slot.metas;
}

// Manifest
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

// Cataloghi
app.get("/catalog/movie/frusciante-120.json", async (_req, res) => {
  try {
    const metas = await loadList("one");
    res.json({ metas });
  } catch (e) {
    res.status(200).json({ metas: [] });
  }
});
app.get("/catalog/movie/frusciante-120plus.json", async (_req, res) => {
  try {
    const metas = await loadList("two");
    res.json({ metas });
  } catch (e) {
    res.status(200).json({ metas: [] });
  }
});

// Admin: svuota cache manualmente (facile per test)
app.get("/purge", (_req, res) => {
  cache.one = { metas: [], ts: 0, src: LIST_URL_1 };
  cache.two = { metas: [], ts: 0, src: LIST_URL_2 };
  res.json({ ok: true, message: "Cache svuotata" });
});

app.listen(PORT, () => console.log(`Server attivo su :${PORT}`));
