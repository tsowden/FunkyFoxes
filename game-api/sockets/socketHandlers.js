// sockets/socketHandlers.js

const TurnManager = require('../game/turnManager');
const { getCardHandlerForCategory } = require('../game/cardHandlers');
const redisClient = require('../config/redis');
const getRandomCard = require('../models/card');

const handleSocketEvents = (io, socket) => {
  console.log('Backend: Socket.IO: Nouveau joueur connecté');


  // -----------------------------------------------------
  // FONCTION Tutorial
  // -----------------------------------------------------

  socket.on('finishTutorial', async ({ gameId, playerId }) => {
    console.log(`Backend: Player ${playerId} finished tutorial in game ${gameId}`);

    try {
      const gameData = await redisClient.hGetAll(`game:${gameId}`);
      if (!gameData) return;

      const players = JSON.parse(gameData.players || '[]');
      const player = players.find(p => p.playerId === playerId);
      if (!player) return;

      player.tutorialDone = true;

      await redisClient.hSet(`game:${gameId}`, 'players', JSON.stringify(players));

      const allDone = players.every(p => p.tutorialDone === true);

      if (allDone) {
        const gameData = await redisClient.hGetAll(`game:${gameId}`);
        const players = JSON.parse(gameData.players || '[]');
        const maze = JSON.parse(gameData.maze || '[]');
        const activePlayerId = gameData.activePlayerId;
        const activePlayer = players.find((p) => p.playerId === activePlayerId);
        
        io.to(gameId).emit('tutorialAllFinished', {
          maze,
          players,
          activePlayerName: activePlayer ? activePlayer.playerName : null,
        });
      }

    } catch (error) {
      console.error("Backend: Error in finishTutorial:", error);
    }
  });



  // -----------------------------------------------------
  // FONCTION UTILE: broadcastGameInfos
  // -----------------------------------------------------
  async function broadcastGameInfos(gameId) {
    try {
      const gameData = await redisClient.hGetAll(`game:${gameId}`);
      if (!gameData) return;

      const players = JSON.parse(gameData.players || '[]');
      const activePlayerId = gameData.activePlayerId;

      console.log("Backend: broadcastGameInfos -> players =", players);

      const sorted = [...players].sort((a, b) => (b.berries || 0) - (a.berries || 0));

      const playersInfo = sorted.map((p, index) => {
        return {
          playerId: p.playerId,
          playerName: p.playerName,
          berries: p.berries || 0,
          rank: index + 1,
        };
      });

      let activePlayerName = null;
      const activePlayer = players.find((p) => p.playerId === activePlayerId);
      if (activePlayer) {
        activePlayerName = activePlayer.playerName;
      }

      console.log("Backend: broadcastGameInfos -> sending playersInfo with avatarBase64 to front...");

      io.to(gameId).emit('gameInfos', {
        players: playersInfo,
        activePlayerName: activePlayerName,
        // activePlayerAvatar: activePlayer?.avatarUrl || null
      });
    } catch (error) {
      console.error('broadcastGameInfos: Erreur lors de la récupération des infos de jeu:', error);
    }
  }

  // -----------------------------------------------------
  // LOBBY LOGIC
  // -----------------------------------------------------
  socket.on('playerReady', async ({ gameId, playerName, isReady }) => {
    console.log(`Backend: Mise à jour du statut prêt pour ${playerName} dans la partie ${gameId} : ${isReady}`);
    try {
      const gameData = await redisClient.hGetAll(`game:${gameId}`);
      const players = JSON.parse(gameData.players || '[]');
      const player = players.find((p) => p.playerName === playerName);
      if (player) {
        player.ready = isReady;
        await redisClient.hSet(`game:${gameId}`, 'players', JSON.stringify(players));

        io.to(gameId).emit('readyStatusUpdate', { playerName, isReady });

        const allReady = players.every((p) => p.ready);
        if (allReady) {
          console.log(`Backend: Tous les joueurs sont prêts dans la partie ${gameId}`);
          io.to(gameId).emit('allPlayersReady');
        }
      }

      await broadcastGameInfos(gameId);

    } catch (error) {
      console.error('Backend: Erreur lors de la mise à jour de l\'état "Prêt" du joueur:', error);
    }
  });

  socket.on('joinRoom', async (gameId) => {
    socket.join(gameId);
    console.log(`Backend: Socket ${socket.id} a rejoint la salle ${gameId}`);

    try {
      const gameData = await redisClient.hGetAll(`game:${gameId}`);
      const players = JSON.parse(gameData.players || '[]');

      console.log(`Backend: Envoi de la liste des joueurs de la partie ${gameId}`);
      io.to(gameId).emit('currentPlayers', players);

      // Nouveau: broadcast infos
      await broadcastGameInfos(gameId);

    } catch (error) {
      console.error('Backend: Erreur lors de la récupération des joueurs:', error);
    }
  });

  socket.on('updateAvatar', async ({ gameId, playerId, avatarBase64 }) => {
    console.log(`Backend: updateAvatar event for playerId=${playerId}, len(avatarBase64)=${avatarBase64?.length}`);
  
    try {
      const gameData = await redisClient.hGetAll(`game:${gameId}`);
      if (!gameData) {
        console.error(`Backend: Game not found for id=${gameId}`);
        return;
      }
  
      const players = JSON.parse(gameData.players || '[]');
      const player = players.find(p => p.playerId === playerId);
  
      if (!player) {
        console.error(`Backend: Player with ID ${playerId} not found in game ${gameId}`);
        return;
      }
  
      player.avatarBase64 = avatarBase64;
      console.log(`Backend: Storing avatarBase64 for ${player.playerName} in game ${gameId}`);
  
      await redisClient.hSet(`game:${gameId}`, 'players', JSON.stringify(players));
  
      await broadcastGameInfos(gameId);
  
    } catch (err) {
      console.error('Backend: updateAvatar error:', err);
    }
  });
  

  // -----------------------------------------------------
  // START OF THE GAME LOGIC
  // -----------------------------------------------------
  socket.on('startGame', async ({ gameId }) => {
    console.log(`Backend: Demande de démarrage du jeu pour la partie ${gameId}`);
    try {
      const gameData = await redisClient.hGetAll(`game:${gameId}`);
      const maze = JSON.parse(gameData.maze || '[]');
      const players = JSON.parse(gameData.players || '[]');

      if (players.length === 0) {
        console.error(`Backend: Aucun joueur trouvé pour le jeu ${gameId}`);
        return;
      }

      const firstPlayer = players[0];
      const activePlayerName = firstPlayer.playerName;
      await redisClient.hSet(`game:${gameId}`, 'activePlayerId', firstPlayer.playerId);

      io.to(gameId).emit('startGame', {
        maze,
        players,
        activePlayerName,
      });

      const card = await getRandomCard();
      const handler = getCardHandlerForCategory(gameId, io, card.card_category);
      await handler.handleCard(firstPlayer.playerId, card);

      console.log(`Backend: Premier joueur actif défini : ${activePlayerName} (ID: ${firstPlayer.playerId})`);

      // broadcast infos
      await broadcastGameInfos(gameId);

    } catch (error) {
      console.error(`Backend: Erreur lors du démarrage du jeu pour ${gameId} :`, error);
    }
  });

  // -----------------------------------------------------
  // TURN LOGIC
  // -----------------------------------------------------
  socket.on('endTurn', async (gameId) => {
    if (typeof gameId !== 'string') {
      console.error(`Backend: gameId reçu dans un format incorrect:`, gameId);
      return;
    }

    console.log(`Backend: Fin du tour reçu pour la partie ${gameId}`);
    try {
      const turnManager = new TurnManager(gameId, io);
      await turnManager.changeActivePlayer();

      await broadcastGameInfos(gameId);

    } catch (error) {
      console.error('Backend: Erreur lors de endTurn:', error);
    }
  });

  socket.on('getActivePlayer', async ({ gameId }) => {
    console.log(`Backend: Reçu demande de getActivePlayer pour la partie ${gameId}`);
    try {
      const gameData = await redisClient.hGetAll(`game:${gameId}`);
      if (!gameData || !gameData.activePlayerId) {
        socket.emit('activePlayer', { activePlayerName: null });
        return;
      }

      const players = JSON.parse(gameData.players || '[]');
      const activePlayerId = gameData.activePlayerId;
      const activePlayer = players.find((p) => p.playerId === activePlayerId);

      if (activePlayer) {
        console.log(`Backend: Joueur actif pour le jeu ${gameId} : ${activePlayer.playerName}`);
        socket.emit('activePlayer', { activePlayerName: activePlayer.playerName });
      } else {
        console.error(`Backend: Aucun joueur actif trouvé pour le jeu ${gameId}`);
        socket.emit('activePlayer', { activePlayerName: null });
      }
    } catch (error) {
      console.error('Backend: Erreur lors de la récupération du joueur actif :', error);
      socket.emit('activePlayer', { activePlayerName: null });
    }
  });

  // -----------------------------------------------------
  // MOVE LOGIC
  // -----------------------------------------------------
  socket.on('playerMove', async ({ gameId, playerId, move }) => {
    console.log(`Backend: Player ${playerId} moves ${move} in game ${gameId}`);
    try {
      const turnManager = new TurnManager(gameId, io);
      await turnManager.handleMove(playerId, move);

      await broadcastGameInfos(gameId);

    } catch (error) {
      console.error('Backend: Error processing player move:', error);
      socket.emit('moveError', { message: 'Error processing move' });
    }
  });

  socket.on('getValidMoves', async ({ gameId, playerId }) => {
    try {
      const gameData = await redisClient.hGetAll(`game:${gameId}`);
      const players = JSON.parse(gameData.players || '[]');
      const player = players.find((p) => p.playerId === playerId);

      if (!player) {
        socket.emit('validMoves', { error: 'Player not found' });
        return;
      }

      const turnManager = new TurnManager(gameId, io);
      const maze = require('../models/map');
      const validMoves = turnManager.getValidMoves(player, maze);

      console.log(`Backend: Valid moves for player ${playerId}:`, validMoves);
      socket.emit('validMoves', validMoves);
    } catch (error) {
      console.error('Backend: Error getting valid moves:', error);
      socket.emit('validMoves', { error: 'Error getting valid moves' });
    }
  });

  // -----------------------------------------------------
  // CHALLENGE LOGIC (BETS)
  // -----------------------------------------------------
  socket.on('startBetting', async ({ gameId, playerId }) => {
    console.log(`Backend: Player ${playerId} is starting the betting phase in game ${gameId}`);
    try {
      const handler = getCardHandlerForCategory(gameId, io, 'Challenge');
      await handler.startBetting();

      await broadcastGameInfos(gameId);

    } catch (error) {
      console.error('Backend: Error starting betting phase:', error);
    }
  });

  socket.on('placeBet', async ({ gameId, playerId, bet }) => {
    console.log(`Backend: Player ${playerId} placed a bet in game ${gameId}`);
    try {
      const handler = getCardHandlerForCategory(gameId, io, 'Challenge');
      await handler.handleBet(playerId, bet);

      const gameData = await redisClient.hGetAll(`game:${gameId}`);
      const players = JSON.parse(gameData.players || '[]');
      const player = players.find((p) => p.playerId === playerId);

      if (!player) {
        console.error(`Player not found for ID: ${playerId}`);
        return;
      }

      console.log(`Backend: Emitting betPlaced event with playerName: ${player.playerName}`);
      io.to(gameId).emit('betPlaced', {
        playerName: player.playerName,
        bet: bet,
      });

      await broadcastGameInfos(gameId);

    } catch (error) {
      console.error('Backend: Error processing bet:', error);
    }
  });

  socket.on('placeChallengeVote', async ({ gameId, playerId, vote }) => {
    console.log(`Backend: Player ${playerId} placed a challenge vote in game ${gameId}`);
    try {
      const handler = getCardHandlerForCategory(gameId, io, 'Challenge');
      await handler.handleChallengeVote(playerId, vote);

      await broadcastGameInfos(gameId);

    } catch (error) {
      console.error('Backend: Error processing challenge vote:', error);
    }
  });

  // -----------------------------------------------------
  // QUIZ LOGIC
  // -----------------------------------------------------
  socket.on('startQuiz', async ({ gameId, playerId, chosenTheme }) => {
    console.log(`Backend: Player ${playerId} starts the quiz with theme=${chosenTheme} in game=${gameId}`);
    try {
      const handler = getCardHandlerForCategory(gameId, io, 'Quiz');
      await handler.startQuiz(playerId, chosenTheme);

      await broadcastGameInfos(gameId);

    } catch (error) {
      console.error('Backend: Error starting quiz:', error);
    }
  });
  
  socket.on('quizAnswer', async ({ gameId, playerId, answer }) => {
    console.log(`Backend: Player ${playerId} answered quiz question in game=${gameId}`);
    try {
      const handler = getCardHandlerForCategory(gameId, io, 'Quiz');
      await handler.handleAnswer(playerId, answer);

      // broadcast infos
      await broadcastGameInfos(gameId);

    } catch (error) {
      console.error('Backend: Error processing quizAnswer:', error);
    }
  });
  
  // END
  socket.on('disconnect', () => {
    console.log('Backend: Socket.IO: Un joueur s\'est déconnecté');
  });
};

module.exports = handleSocketEvents;
