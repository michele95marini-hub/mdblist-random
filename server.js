
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

// Abilita CORS
app.use(cors());

// Lista film (assicurati che il file si chiami movies.json)
const movies = require('./movies.json').metas;

// Funzione per mescolare (Fisher-Yates)
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Endpoint catalogo per Stremio
app.get('/catalog/movie/mdblist-random.json', (req, res) => {
    const shuffledMovies = shuffle([...movies]); // copia e mescola
    res.json({
        id: "mdblist-random",          // ID del catalogo
        name: "Frusciante 120+",   // ← qui puoi mettere il nome che vuoi
        type: "movie",                 // tipo di contenuto
        metas: shuffledMovies           // lista mescolata
    });
});

// Endpoint info singolo film (opzionale)
app.get('/meta/movie/:id.json', (req, res) => {
    const movie = movies.find(m => m.id === req.params.id);
    if (movie) {
        res.json({ meta: movie });
    } else {
        res.status(404).json({ error: 'Movie not found' });
    }
});

// Avvia server
app.listen(PORT, () => {
    console.log(`Server in ascolto su http://localhost:${PORT}`);
});
