import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors'; // IMPORTA CORS

const app = express();
const port = process.env.PORT || 3000;

app.use(cors()); // ABILITA CORS per tutte le richieste

// Sostituisci con l'URL JSON della tua lista mdblist
const MDLIST_URL = 'https://mdblist.com/lists/mulf95/frusciante-120min/json';

// Funzione per mischiare un array
function shuffle(arr) {
  return arr.sort(() => Math.random() - 0.5);
}

// Endpoint per il manifest di Stremio
app.get('/manifest.json', (req, res) => {
  res.json({
    id: 'mdblist-random',
    version: '1.0.0',
    name: 'MDBList Random',
    description: 'Lista MDBList mescolata casualmente',
    resources: ['catalog'],
    types: ['movie', 'series'],
    catalogs: [
      {
        type: 'movie',
        id: 'mdblist-random',
        name: 'MDBList Random'
      }
    ]
  });
});

// Endpoint per il catalogo di Stremio
app.get('/catalog/:type/:id.json', async (req, res) => {
  try {
    const response = await fetch(MDLIST_URL);
    const data = await response.json();

    // Mischia i risultati
    const shuffled = shuffle(data);

    // Adatta al formato Stremio
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

app.listen(port, () => {
  console.log(`Server in ascolto sulla porta ${port}`);
});

