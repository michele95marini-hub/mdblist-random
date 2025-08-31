import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 10000;

app.use(cors()); // abilita CORS

// URL della tua lista MDBList
const MDLIST_URL = 'https://mdblist.com/lists/mulf95/frusciante-120min/json';

// Funzione per mischiare un array
function shuffle(arr) {
  return arr.sort(() => Math.random() - 0.5);
}

// Endpoint manifest di Stremio
app.get('/manifest.json', (req, res) => {
  res.json({
    id: 'mdblist-random',
    version: '1.0.0',
    name: 'MDBList Random',
    description: 'Lista MDBList mescolata casualmente',
    resources: ['catalog'],
    types: ['movie','series'],
    catalogs: [
      {
        type: 'movie',
        id: 'mdblist-random',
        name: 'MDBList Random',
        extra: []
      }
    ]
  });
});

// Endpoint catalogo Stremio
app.get('/catalog/:type/:id.json', async (req, res) => {
  try {
    const response = await fetch(MDLIST_URL);
    const data = await response.json();

    // Mischia i film ogni volta
    const shuffled = shuffle(data);

    const metas = shuffled.map(item => ({
      id: String(item.imdb_id || item.tmdb_id || item.trakt_id),
      type: req.params.type,
      name: item.title,
      poster: item.poster,
      year: item.year
    }));

    res.json({ metas });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => console.log(`Server in ascolto sulla porta ${port}`));
