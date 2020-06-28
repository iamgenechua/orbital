// ===================================================== START OF GLOBAL VARIABLES ===================================================== //

// import dependencies
let ArrayList = require('arraylist');
let HashMap = require('hashmap');
let express = require('express');
let socketIO = require('socket.io');

// create and run the server
const PORT = process.env.PORT || 3000;
const INDEX = '/index.html';

const server = express()
  .use((req, res) => res.sendFile(INDEX, { root: __dirname }))
  .listen(PORT, () => console.log(`Listening on ${PORT}`));

const io = socketIO(server);

// Constructor for player whenever someone joins the server
function Player(socketID, score, hand = [], name) {
    this.socketID = socketID;
    this.score = score;
    this.hand = hand;
    this.name = name;
}

// Constructor for a package of modifiable room attributes to be passed to client for customizing
function roomAttributes(ROOM_NAME) {
    let gameRoom = roomMap.get(ROOM_NAME);
    this.roomName = ROOM_NAME;
    this.ROUND_TIME = gameRoom.ROUND_TIME;
    this.REST_TIME = gameRoom.REST_TIME;
    this.MAX_HAND = gameRoom.MAX_HAND;
    this.NUMBER_ROUNDS = gameRoom.NUMBER_ROUNDS;
}

// Create a mutable hashmap with roomName being the Key and json object containing the room info as Value
let roomMap = new HashMap();

// Create a mutable hashmap to keep track of which socketID belongs to which room
let roomNameSocketIdMap = new HashMap();

// ===================================================== END OF GLOBAL VARIABLES ===================================================== //

// ===================================================== START OF FUNCTIONS ===================================================== //
// FISHER-YATES SHUFFLE ALGORITHM
function shuffleDeck(deckArray) {
    const deckSize = deckArray.length; // get size of the deck
    // start from last element and swap one by one
    // don't need to run till first element. Hence position > 0
    for (let position = deckSize - 1; position > 0; position--) {
        let randIndex = Math.floor(Math.random() * (position+1)); // pick a random index from 0 to position
        // swap newDeck[position] with element at random index
        let temp = deckArray[position];
        deckArray[position] = deckArray[randIndex];
        deckArray[randIndex] = temp;
    }
}

// Create a room when player creates a room
function createRoom(roomName) {

    // import cards from the database
    let cardDeck = require('./database');

    shuffleDeck(questionsDatabase); // shuffle the questions deck everytime you create a room
    shuffleDeck(answersDatabase); // shuffle the answers deck everytime you create a room

    let gameRoom = {
        ROUND_TIME : 10,
        REST_TIME : 5,
        MAX_HAND : 5,
        NUMBER_ROUNDS : 10,
        voterIndex : 0, // the index of the voter. Loop around with %.
        questions : cardDeck.questionsDatabase.slice(), // array of questions
        answers : cardDeck.answersDatabase.slice(), // array of answers
        questionIndex : 0,
        answerIndex : 0,
        currRoundNumber : 0, // the current round number. Increments every round
        voterHasVoted : false,
        gameStarted : false,
        players : new ArrayList,// Create a mutable arraylist of players
        playerNames : new ArrayList,// Create a mutable arraylist with all the player names
        // Create a mutable array of the cards in the play area
        playArea : []
    }
    roomMap.set(roomName, gameRoom);// Create a Key-Value pair of roomName with the room object
}

// Reset a room after a game ends and the players decide to play again in the same room
function resetRoom(roomName) {
    // import a different permutation of cards than previous games
    let cardDeck = require('./database');
    shuffleDeck(questionsDatabase); 
    shuffleDeck(answersDatabase); 

    // reset key attributes back to starting conditions
    let gameRoom = roomMap.get(roomName);
    for (let i = 0; i < gameRoom.players.size(); i++) {
        gameRoom.players.get(i).score = 0;
    }
    gameRoom.voterIndex = 0;
    gameRoom.questions = cardDeck.questionsDatabase.slice();
    gameRoom.answers = cardDeck.answersDatabase.slice();
    gameRoom.questionIndex = 0;
    gameRoom.answerIndex = 0;
    gameRoom.currRoundNumber = 0;
    gameRoom.voterHasVoted = false;
    gameRoom.gameStarted = false;
    gameRoom.playArea = [];
}

// Create a player when player connects to Server
function createPlayer(roomName, socketID, name) {
    roomNameSocketIdMap.set(socketID, roomName);// register ID-roomName relationship inside the map
    let gameRoom = roomMap.get(roomName);
    player = new Player(socketID, 0, [], name);
    for (let i = 0; i < gameRoom.MAX_HAND; i++) {
        let answerPosition = gameRoom.answerIndex % gameRoom.answers.length; // prevent arrayOutOfBoundsException
        player.hand.push(gameRoom.answers[answerPosition]); // deal MAX_HAND to each player's hand upon connection
        gameRoom.answerIndex++;
    }
    gameRoom.players.add(player);// to add the newly created player into the respective room
    gameRoom.playerNames.add(name);// to keep track of playerNames for the sake of namelist
    io.to(player.socketID).emit('answer', player.hand); // emitting an array
}

// Update room attributes when the player wishes to customize room settings
function updateRoomAttributes(attributeBox) { // attributeBox is a package of info received from client, refer to function roomAttributes for more info
    roomName = attributeBox.roomName;
    
    let gameRoom = roomMap.get(roomName);
    gameRoom.ROUND_TIME = attributeBox.ROUND_TIME;
    gameRoom.REST_TIME = attributeBox.REST_TIME;
    gameRoom.MAX_HAND = attributeBox.MAX_HAND;
    gameRoom.NUMBER_ROUNDS = attributeBox.NUMBER_ROUNDS;
}

// Reset and/or update variables before the round starts
function updateVariables(roomName) {
    let gameRoom = roomMap.get(roomName);

    console.log("\x1b[5m%s\x1b[0m", "Round Starting now"); // logs the start of the round. (Testing purposes)
    console.log("\x1b[33m%s\x1b[0m", "Total online players: " + gameRoom.players.length); // logs how many players playing this round. To change to emitting the list of players online
    
    gameRoom.voterHasVoted = false; // reset voter to state to haven't voted yet

    // increment the round number
    gameRoom.currRoundNumber = gameRoom.currRoundNumber + 1;
    io.in(roomName).emit("updateRoundNumber", gameRoom.currRoundNumber);
    
    // update playArea
    gameRoom.playArea.length = 0; // clear the play Area
    io.in(roomName).emit('updatePlayArea', gameRoom.playArea); // emit the updated play area
}

// Change player turn
function changeVoter(roomName) {
    let gameRoom = roomMap.get(roomName);

    let totalPlayers = gameRoom.players.length // get the total number of players in the game
    if (totalPlayers == 0) { // if no one playing
        console.log("\x1b[31m%s\x1b[0m", "Cannot assign voter. No one playing"); // (Testing purposes)
    } else {
        let voterForTheRound = gameRoom.voterIndex % totalPlayers; // change the voter for the round
        for (let i = 0; i < totalPlayers; i++) {
            if (i == voterForTheRound) {
                // Emit voting rights to the client
                let voter = gameRoom.players.get(i);
                io.to(voter.socketID).emit('voter', 0);
            } else {
                // Emit answering rights to the client
                let answerer = gameRoom.players.get(i);
                io.to(answerer.socketID).emit('answerer', 0);
            }
        }
        gameRoom.voterIndex++;
    }
};

// helper function sleep
function sleep(sec) {
    return new Promise(resolve => setTimeout(resolve, sec*1000));
}

// helper function to deal question card for all players to see
function dealQuestionCard(roomName) {
    let gameRoom = roomMap.get(roomName);
    let questionPosition = gameRoom.questionIndex % gameRoom.questions.length; // prevent arrayOutOfBoundsException
    io.in(roomName).emit('question', gameRoom.questions[questionPosition]); // emit the question from the shuffled array
    gameRoom.questionIndex++;
}
// helper function to deal individual answer cards to each player
function dealAnswerCards(roomName) {
    let gameRoom = roomMap.get(roomName);
    try {
        for (let player = 0; player < gameRoom.players.length; player++) {
            let answerPosition = gameRoom.answerIndex % gameRoom.answers.length; // prevent arrayOutOfBoundsException
            let currentPlayer = gameRoom.players.get(player);
            if (currentPlayer.hand.length < gameRoom.MAX_HAND) { // if the player's hand doesn't have the maximum number of cards, deal card
                currentPlayer.hand.push(gameRoom.answers[answerPosition]);
                console.log(currentPlayer.socketID); // (Testing purposes to see who is dealt the card)
                gameRoom.answerIndex++;
            }
            io.to(currentPlayer.socketID).emit('answer', currentPlayer.hand); // emitting an array
        }
    } catch (e) {
        console.log(e.message);
    }
}

function noMoreAnswering(roomName) {
    io.in(roomName).emit('noMoreAnswering', 0); // signal to all clients that they cannot submit answers anymore
}

function checkIfNoAnswer(roomName) {
    let gameRoom = roomMap.get(roomName);
    if (gameRoom.playArea.length == 0) { // if there's no one in the playArea
        gameRoom.voterHasVoted = true; // make it as if voter has voted, skipping the voting round all together
        // use the 'generalBroadcast' socket with the message "No one answered this round. Going to next round."
        io.in(roomName).emit("generalBroadcast", "No one answered this round. Going to next round.");
    }
}

function checkToPenaliseVoter(roomName) {
    let gameRoom = roomMap.get(roomName);
    if (gameRoom.voterHasVoted == false) { // if voter has not voted
        let totalPlayers = gameRoom.players.length // get the total number of players in the game
        let voterForTheRound = gameRoom.voterIndex % totalPlayers;
        let voter = gameRoom.players.get(voterForTheRound); // find the voter for the round
        if (voter.score > 0) {
            voter.score = voter.score - 1; // decrease one from the voter's score
        }
        // optional TODO: use the 'generalBroadcast' socket with the message  --> gameRoom.voter.name + "did not answer this round. He minus one point"
        io.in(roomName).emit("generalBroadcast", "Voter did not vote this round. One point is deducted from them.");
    }
}

// ===================================================== END OF FUNCTIONS ===================================================== //

// ===================================================== START OF MAIN LOGIC ===================================================== //
async function gameRound(roomName) {
    // the current game room
    let gameRoom = roomMap.get(roomName);

    // indicate that game has started for this particular gameRoom
    gameRoom.gameStarted = true;
    

    // first round actions
    if (gameRoom.currRoundNumber == 0) {
        await sleep(0.8); // wait for all sockets to receive input on first round
        // update player infos
        io.in(roomName).emit('updatePlayerInfo', gameRoom.players); // emit the updated list of players and their respective scores
    }


    
    // reset round and update variables
    updateVariables(roomName);
    
    // change Voter
    changeVoter(roomName);

    // deal question cards for all to see
    dealQuestionCard(roomName);

    // deal answer cards to all players if needed
    dealAnswerCards(roomName);

    // ** in client side ** , socket.on('selectAnswer', function(answerString) { ... }); to get answer from client and submit to play area

    // broadcast timer for the time left in round
    let timeLeftInRound = gameRoom.ROUND_TIME;
    if (gameRoom.currRoundNumber == 1) {
        timeLeftInRound = timeLeftInRound + 10; // extra 10 seconds to see all the cards in the first round
    }

    while (timeLeftInRound >= 0 && 
        gameRoom.playArea.length < gameRoom.players.length - 1) { // as long as the play area has lesser cards than all ANSWERERS present, keep counting down
        io.in(roomName).emit('timeLeftInRound', timeLeftInRound);
        timeLeftInRound--;
        await sleep(1);
    }

    // signal no more time left to choose answer card. Stop players from selecting answer cards. Update the play area once again to make cards visible
    noMoreAnswering(roomName);

    // Check whether no one answered. If no one, skip the voting
    checkIfNoAnswer(roomName);

    // ** in client side ** , socket.on('voterHasVoted', function(answerString) { ... }); to get voted answer from the voter client
    
    // broadcast voting time left in the round
    let timeToVote = gameRoom.ROUND_TIME;
    while(timeToVote >= 0 && !gameRoom.voterHasVoted) {
        io.in(roomName).emit('timeLeftToVote', timeToVote);
        timeToVote--;
        await sleep(1);
    }

    // Check whether voter needs to be penalised for not voting people's cards
    checkToPenaliseVoter(roomName);

    // update player infos
    io.in(roomName).emit('updatePlayerInfo', gameRoom.players); // emit the updated list of players and their respective scores

    // broadcast resting time for the next round
    let restTimeLeft = gameRoom.REST_TIME;
    while (restTimeLeft >= 0) {
        io.in(roomName).emit('timeLeftToRest', restTimeLeft); // I didn't add this in the client side
        restTimeLeft--;
        await sleep(1);
    }

    // check condition for next round
    if (gameRoom.players.size() == 0) { // if no one in the room
        roomMap.delete(roomName); // clear the key in the hashMap so people can join it again as a new game room
        return; // break out of gameRound function
    } else if (gameRoom.players.size() == 1) { // if got only exactly one person in the room
        // don't let the game continue
        //io.in(roomName).emit('generalBroadcast', "Please rejoin the game with another player(s) to play the game."); // emit that game cannot continue with just one player
        io.in(roomName).emit("onePlayerLeft");
        roomMap.delete(roomName);
        return;
    } else if (gameRoom.currRoundNumber >= gameRoom.NUMBER_ROUNDS) { // if exceed the NUMBER_ROUNDS
        io.in(roomName).emit('gameEnd', gameRoom.players); // emit the end of the game to all players in the room
        resetRoom(roomName); // reset the current room while retaining player and customizable information
        return; // break out of the gameRound function
    } else {
        // round number will be incremented in the update variables function
        gameRound(roomName); // start the next round
    }
    
};

// ===================================================== END OF MAIN LOGIC ===================================================== //


// ===================================================== START OF SOCKET LISTENERS ===================================================== //
io.on('connection', function(socket) {
    console.log("\x1b[42m%s\x1b[0m", 'A new player ' + socket.id + ' has connected');

    // socket listener to get roomID and username when a new player joins
    socket.on("joinRoom", function(userInfo) {
        roomName = userInfo.RoomID;
        userName = userInfo.Username;
        if (!roomMap.has(roomName)) {// check if the room has been created, if not, create a new room with the respective roomName
            createRoom(roomName);  
        }
        
        let gameRoom = roomMap.get(roomName);
        
        if (!gameRoom.gameStarted) {// check if the game round of this particular room has already started
            
            // inform the player that he has joined successfully
            io.to(socket.id).emit("joinSuccess")
            createPlayer(roomName, socket.id, userName);// create a player object with attributes of the connected socket
            socket.join(roomName);// join the current socket to the respective channel(room)
            io.in(roomName).emit("newPlayerJoined", gameRoom.playerNames);// inform the waiting lobby of this room that a new player has joined
            // send a packege of room attributes to client in case he wishes to customize room settings
            let attributeBox = new roomAttributes(roomName);
            io.in(roomName).emit("roomAttributes", attributeBox);
        } else {
            io.to(socket.id).emit("joinFailed");// inform the player he is not able to join as the game of the room has already started
        }
    });

    // socket listener to update the waiting lobby about room info
    socket.on("requestRoomUpdate", function(roomName) {
        let gameRoom = roomMap.get(roomName);
        io.to(socket.id).emit("newPlayerJoined", gameRoom.playerNames);
        let attributeBox = new roomAttributes(roomName);
        io.to(socket.id).emit("roomAttributes", attributeBox);
    })

    // socket listener to update Room attributes when a player decides to customize his room
    socket.on("updatedAttributes", function (attributeBox) {
        updateRoomAttributes(attributeBox);
        io.in(roomName).emit("roomAttributes", attributeBox);// update all players of the room about the change of attributes
    });


    // socket listener to get the game started for a particular room when a player decides to start
    socket.on("startGameServer", function(roomName) {
        io.in(roomName).emit("startGameClient");// inform all the players of the particular room to start the game
        let gameRoom = roomMap.get(roomName);
        io.in(roomName).emit('updatePlayerInfo', gameRoom.players);// update all players of the room with player info
        gameRound(roomName);// start the game
    });
    
    // socket listener to get the answer string that the client selects
    socket.on('selectAnswer', function(answerInfo) {
        roomName = answerInfo.roomName;
        let gameRoom = roomMap.get(roomName);
        answerString = answerInfo.answerString;

        let submissionPair = new Array(answerString, socket.id); // create an Array Pair with the answerString and the player's socketID
        gameRoom.playArea.push(submissionPair); // push the array pair into the array play area

        // to remove the string from the player's hand
        let updatedPlayer;
        gameRoom.players.find(function(player) {
            if (player.socketID == socket.id) {
                updatedPlayer = player;
                updatedPlayer.hand.find(function(card) {
                    if (card === answerString) {
                        let pos = updatedPlayer.hand.indexOf(card); // get position of card
                        updatedPlayer.hand.splice(pos, 1); // remove that card from the hand
                    }
                })
            }
        });
        
        // The only purpose of this tempDisplay array is to just send in the list of strings WITHOUT the socketID.
        let tempDisplay = [];
        for (let i = 0; i < gameRoom.playArea.length; i++) {
            tempDisplay.push(gameRoom.playArea[i][0]);
        }

        io.in(roomName).emit('updatePlayArea', tempDisplay); // emit the playArea with the added card
        io.sockets.to(updatedPlayer.socketID).emit('answer', updatedPlayer.hand); // emitting an array
    });

    // socket listener to get the answer string voted by the voter
    socket.on('voterHasVoted', function(votedInfo) {
        roomName = votedInfo.roomName;
        let gameRoom = roomMap.get(roomName);
        votedAnswerString = votedInfo.votedAnswer;
        
        gameRoom.voterHasVoted = true; // to skip the timer when the voter has voted
        
        // find the player that played the winning card and increase his score
        for (let i = 0; i < gameRoom.playArea.length; i++) { // remember that playArea contains arrayPairs of [answerString, socketID]
            if (gameRoom.playArea[i][0] === votedAnswerString) { // look for the player with the winning card
                let winningSocketID = gameRoom.playArea[i][1]; // get the socketID of the winning player
                gameRoom.players.find(function(winningPlayer) {
                    if (winningPlayer.socketID == winningSocketID) {
                        winningPlayer.score += 1; // add 1 to the score of the winning player;
                        
                        io.in(roomName).emit('winningPlayer', new Array(winningPlayer.name, votedAnswerString)); // right now, emit socketID, in the future, emit the name
                    }
                });
                break;
            }
        }
    });

    socket.on('checkRmEmpty', function(roomName) { // if the player who's currently quitting is the last player of the room, delete the room
        let gameRoom = roomMap.get(roomName);
        // when the game ends, the entire players array would be cleared. 
        if (gameRoom.players.size() == 1) {
            console.log("gameRoom size: " + gameRoom.players.size()); 
            roomMap.delete(roomName);
            console.log("room deleted");  
        }
    })

    socket.on('disconnect', function(empty) { // placeholder variable
        console.log("Someone is leaving");
        // check if the current disconnected socket id is registered with roomNameSocketIdMap (this condition is to prevent certain bugs during disconnection, to be improved)
        if (roomNameSocketIdMap.has(socket.id)) {
            roomName = roomNameSocketIdMap.get(socket.id);
            
            if (roomMap.has(roomName)){ // check if the room has already been deleted(for the case when player quits after gameEnd)
                let gameRoom = roomMap.get(roomName);
                let removedPlayer;
                let removedPlayerName;
                // remove the player from the players arraylist
                gameRoom.players.find(function(player) {
                    if (player.socketID == socket.id) {
                        removedPlayer = player;
                    }
                });
                // then remove the name from the playerName arraylist too
                gameRoom.playerNames.find(function(playerName) {
                    if (playerName === removedPlayer.name) {
                        console.log(playerName);
                        removedPlayerName = playerName;
                    }
                });

                gameRoom.players.removeElement(removedPlayer); // 1) remove player object from players array list
                gameRoom.playerNames.removeElement(removedPlayerName); // 2) remove player name from the playerNames array list
                roomNameSocketIdMap.delete(removedPlayer.socketID); // 3) remove player socketID from the socketID hashmap
                console.log(gameRoom.players);
                console.log(gameRoom.playerNames);
                io.in(roomName).emit('updatePlayerInfo', gameRoom.players); // emit the updated list of players and their respective scores
                io.in(roomName).emit('newPlayerJoined', gameRoom.playerNames); // (reuse of event) inform the waiting lobby of this room that a new player has LEFT
                console.log("\x1b[41m%s\x1b[0m", "Player " + socket.id + " has left");
            } else {
                roomNameSocketIdMap.delete(socket.id);
            }
        }
    });
});

// ===================================================== END OF SOCKET LISTENERS ===================================================== //