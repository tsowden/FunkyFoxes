// models/card.js
const db = require('../config/db'); 


// async function getRandomCard() {
//   try {
//     const [rows] = await db.query('SELECT * FROM cards ORDER BY RAND() LIMIT 1');

//     if (!rows || rows.length === 0) {
//       return null;
//     }
//     return rows[0];
//   } catch (error) {
//     console.error('Erreur lors de la récupération de la carte:', error);
//     throw error; 
//   }
// }


const DEBUG_CARD_ID = 3; // Remplace 1 par l'ID que tu veux tester

async function getRandomCard() {
  try {
    let query = 'SELECT * FROM cards ORDER BY RAND() LIMIT 1';
    let params = [];

    // Si un ID spécifique est défini pour le debug, on le récupère directement
    if (DEBUG_CARD_ID) {
      query = 'SELECT * FROM cards WHERE card_id = ? LIMIT 1';
      params = [DEBUG_CARD_ID];
    }

    const [rows] = await db.query(query, params);

    if (!rows || rows.length === 0) {
      return null;
    }
    return rows[0];
  } catch (error) {
    console.error('Erreur lors de la récupération de la carte:', error);
    throw error;
  }
}



module.exports = getRandomCard;



