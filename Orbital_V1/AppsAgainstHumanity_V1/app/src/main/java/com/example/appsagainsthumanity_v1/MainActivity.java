package com.example.appsagainsthumanity_v1;

import androidx.annotation.RequiresApi;
import androidx.appcompat.app.AppCompatActivity;
import androidx.constraintlayout.widget.ConstraintLayout;
import androidx.recyclerview.widget.RecyclerView;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.widget.AbsListView;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.ListView;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Optional;

import io.socket.client.IO;
import io.socket.client.Socket;
import io.socket.emitter.Emitter;

public class MainActivity extends AppCompatActivity {

    // ======================== START OF GLOBAL VARIABLES ====================================== //
    TextView textView_status;
    TextView textView_question;
    TextView textView_timer;
    TextView textView_score;
    TextView textView_round;

    ConstraintLayout playerListLayout;
    ArrayList<String> playerList;
    Button bttn_backToMain;
    ListView playerListview;
    ArrayAdapter<String> arrayAdapterPlayers;

    ArrayList<String> hand;
    ListView listView_answers;
    ArrayAdapter<String> arrayAdapterHand;
    Optional<String> chosenCard;

    ArrayList<String> playArea;
    ListView listView_playArea;
    ArrayAdapter<String> arrayAdapterPlayArea;

    Socket socket;
    boolean isVoter; // boolean to determine if the player is a voter or an answerer. Will change depending on info received by socket.
    boolean canAnswer; // if true, means answerers still got time to pick an answer from their hand. else, no more time to pick an answer from hand.
    int score = 0;
    int round = 1;

    Button btn_submit;

    // ======================== END OF GLOBAL VARIABLES ====================================== //

    // ======================== START OF ONCREATE FUNCTION ====================================== //

    @RequiresApi(api = Build.VERSION_CODES.N)
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        textView_status = findViewById(R.id.textView_status); // initialise status textView
        textView_question = findViewById(R.id.textView_question); // initialise question box textView
        textView_timer = findViewById(R.id.textView_timer); // initialise timer textView
        textView_score = findViewById(R.id.textView_score);// initialise score textView
        textView_score.setText(Integer.toString(score));
        textView_round = findViewById(R.id.textView_round);// initialise round textView
        textView_round.setText(Integer.toString(round));

        chosenCard = Optional.empty(); // If answerer, this Optional will store the answer card chosen from hand. If voter, this Optional will store the card voted from play area.

        // Initialise the playerInfo layout
        playerListLayout = findViewById(R.id.playerListLayout);
        playerListview = findViewById(R.id.playerListview);
        bttn_backToMain = findViewById(R.id.bttn_backToMain);
        playerListLayout.setVisibility(View.INVISIBLE);
        playerList = new ArrayList<>();
        arrayAdapterPlayers = new ArrayAdapter<>(this, android.R.layout.simple_list_item_1, playerList);
        playerListview.setAdapter(arrayAdapterPlayers);

        // Display hand in client
        hand = new ArrayList<>();
        listView_answers = findViewById(R.id.listView_answers);
        arrayAdapterHand = new ArrayAdapter<String>(this, android.R.layout.simple_list_item_single_choice, hand);
        listView_answers.setAdapter(arrayAdapterHand);
        listView_answers.setChoiceMode(AbsListView.CHOICE_MODE_SINGLE); // only allow answerer to select one card at a time
        listView_answers.setOnItemClickListener((parent, view, position, id) -> {
            chosenCard = Optional.ofNullable(hand.get(position)); // update the chosenCard Optional with the selected card
        });

        // Display play area in client
        playArea = new ArrayList<>();
        listView_playArea = findViewById(R.id.listView_playArea);
        arrayAdapterPlayArea = new ArrayAdapter<String>(this, android.R.layout.simple_list_item_single_choice, playArea);
        listView_playArea.setAdapter(arrayAdapterPlayArea);
        listView_playArea.setChoiceMode(AbsListView.CHOICE_MODE_SINGLE); // only allow voter to select one card at a time
        listView_playArea.setOnItemClickListener((parent, view, position, id) -> {
            chosenCard = Optional.ofNullable(playArea.get(position)); // update the chosenCard Optional with the voted card
        });

        isVoter = false; // initialise as an answerer until client is assigned as a voter
        canAnswer = true; // client still has time to be able to choose the answer card

        btn_submit = findViewById(R.id.btn_submit);

        try {
            socket = JoinGame.socket;
            runGame();
        } catch (Exception e) {
            Toast.makeText(MainActivity.this, e.getMessage() + "", Toast.LENGTH_SHORT).show();
        }
    }

    // ======================== END OF ONCREATE FUNCTION ====================================== //

    // ======================== START OF SOCKET LISTENERS====================================== //
    public void runGame() {
        // socket listener to be a voter
        socket.on("voter", new Emitter.Listener() {
            @Override
            public void call(Object... args) {
                runOnUiThread(new Runnable() {
                    @RequiresApi(api = Build.VERSION_CODES.N)
                    @Override
                    public void run() {
                        isVoter = true;
                        updateInterface(isVoter); // encapsulates the User interface
                    }
                });
            }
        });

        // socket listener to be an answerer
        socket.on("answerer", new Emitter.Listener() {
            @Override
            public void call(Object... args) {
                runOnUiThread(new Runnable() {
                    @RequiresApi(api = Build.VERSION_CODES.N)
                    @Override
                    public void run() {
                        isVoter = false;
                        updateInterface(isVoter); // encapsulates the User interface
                    }
                });
            }
        });

        // socket listener to display the question card
        socket.on("question", new Emitter.Listener() {
            @Override
            public void call(Object... args) {
                final Object[] myArgs = args;
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        textView_question.setText(myArgs[0].toString()); // changes the question textView to the question card dealt to everyone
                    }
                });
            }
        });

        // socket listener to display the answer cards in hand
        socket.on("answer", new Emitter.Listener() {
            @Override
            public void call(Object... args) {
                final JSONArray jArray = (JSONArray) args[0];
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        hand.clear(); // clear the hand first
                        // then update the hand with the updated hand in the server
                        for (int item = 0; item < jArray.length(); item++) {
                            try {
                                String tempString = (String) jArray.get(item);
                                hand.add(tempString);
                            } catch (JSONException e) {
                                e.printStackTrace();
                            }
                        }
                        arrayAdapterHand.notifyDataSetChanged();
                    }
                });
            }
        });

        // socket listener to display the time left in the round
        socket.on("timeLeftInRound", new Emitter.Listener() {
            @Override
            public void call(Object... args) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        textView_timer.setTextColor(Color.parseColor("#FA8072")); // color is red to signify the time left to pick an answer from hand
                        int timeLeftSeconds = Integer.parseInt(args[0].toString());
                        int minutes = timeLeftSeconds / 60;
                        int seconds = timeLeftSeconds % 60;
                        textView_timer.setText("Answer: " + String.format("%02d:%02d", minutes, seconds));
                    }
                });
            }
        });

        // socket listener to display the time left for voter to vote
        socket.on("timeLeftToVote", new Emitter.Listener() {
            @Override
            public void call(Object... args) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        textView_timer.setTextColor(Color.parseColor("#00A86B")); // color is green to signify the time left to vote for the winning card
                        int timeLeftSeconds = Integer.parseInt(args[0].toString());
                        int minutes = timeLeftSeconds / 60;
                        int seconds = timeLeftSeconds % 60;
                        textView_timer.setText("Vote: " + String.format("%02d:%02d", minutes, seconds));
                    }
                });
            }
        });

        // socket listener to update the play area
        socket.on("updatePlayArea", new Emitter.Listener() {
            @Override
            public void call(Object... args) {
                final JSONArray jArray = (JSONArray) args[0];
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        playArea.clear(); // same method as the updating of hand cards
                        for (int card = 0; card < jArray.length(); card++) {
                            try {
                                String tempString = (String) jArray.get(card);
                                playArea.add(tempString);
                            } catch (JSONException e) {
                                e.printStackTrace();
                            }
                        }
                        Collections.sort(playArea); // Shuffle the cards just by sorting.
                        if (canAnswer) {  // Round has not ended, make the cards hidden
                            listView_playArea.setBackgroundColor(Color.parseColor("#000000")); // just my way of making the cards hidden. Change this code to whatever u want to make the cards hidden
                        }

                        arrayAdapterPlayArea.notifyDataSetChanged();
                    }
                });
            }
        });

        // socket listener to update the player scores
        socket.on("updatePlayerInfo", new Emitter.Listener() {
            @Override
            public void call(Object... args) {
                final JSONArray jArray = (JSONArray) args[0];
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        playerList.clear();
                        for (int player = 0; player < jArray.length(); player++) {
                            try {
                                JSONObject currPlayer = (JSONObject) jArray.get(player);
                                String currPlayerName = currPlayer.getString("name");
                                int currPlayerScore = currPlayer.getInt("score");
                                playerList.add(currPlayerName + " : " + currPlayerScore + "pts");// update the playerInfo listview
                                if (currPlayerName.equals(JoinGame.userName)) {//update score of current player
                                    score = currPlayerScore;
                                    textView_score.setText(Integer.toString(score));
                                }
                            } catch (JSONException e) {
                                e.printStackTrace();
                            }
                        }
                        Collections.sort(playArea); // Shuffle the cards just by sorting.
                        if (canAnswer) {  // Round has not ended, make the cards hidden
                            listView_playArea.setBackgroundColor(Color.parseColor("#000000")); // just my way of making the cards hidden. Change this code to whatever u want to make the cards hidden
                        }

                        arrayAdapterPlayers.notifyDataSetChanged();
                        arrayAdapterPlayArea.notifyDataSetChanged();
                    }
                });
            }
        });

        // socket listener to turn the cards over when the time to answer is up
        socket.on("noMoreAnswering", new Emitter.Listener() {
            @Override
            public void call(Object... args) {
                runOnUiThread(new Runnable() {
                    @RequiresApi(api = Build.VERSION_CODES.N)
                    @Override
                    public void run() {
                        chosenCard = Optional.empty(); // so that players cannot submit anything even if they press the submit button
                        canAnswer = false; // players not allowed to answer or choose a card from the hand anymore
                        listView_answers.setEnabled(false); // disallow players from selecting anything in their hand once no more answering
                        listView_playArea.setEnabled(true); // after players cannot answer anymore, voter can then vote on the best card in the play area
                        listView_playArea.setBackgroundColor(Color.parseColor("#FFFFFF")); // Again, just my way of making the cards visible. Change this code to whatever u want
                    }
                });
            }
        });

        socket.on("winningPlayer", new Emitter.Listener() {
            @Override
            public void call(Object... args) {
                final JSONArray jArray = (JSONArray) args[0];
                runOnUiThread(new Runnable() {
                    @RequiresApi(api = Build.VERSION_CODES.N)
                    @Override
                    public void run() {
                        try {
                            // just the easiest way for me to display the winner.
                            // jArray.get(0) <-- gets the player's socketID (because server pass in socketID. Server should pass in the name in the future
                            // jArray.get(1) <-- gets the winning card chosen by the voter
                            String winnerName = jArray.get(0).toString();
                            if (winnerName.equals(JoinGame.userName)) {
                                Toast.makeText(getApplicationContext(), "You won!", Toast.LENGTH_LONG).show();
                            } else {
                                Toast.makeText(getApplicationContext(), jArray.get(0).toString() + " played the winning card: " + jArray.get(1).toString(), Toast.LENGTH_LONG).show();
                            }
                            round++;
                            textView_round.setText(Integer.toString(round));
                        } catch (JSONException e) {
                            e.printStackTrace();
                        }
                    }
                });



            }
        });

        // socket listener to disconnect from server
        socket.on(Socket.EVENT_DISCONNECT, new Emitter.Listener() {

            @Override
            public void call(Object... args) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        textView_status.setText("DISCONNECTED");
                    }
                });
            }
        });
    }

    // ======================== END OF SOCKET LISTENERS====================================== //

    // ======================== START OF HELPER FUNCTIONS ====================================== //
    public void updateInterface(boolean isVoter) {
        canAnswer = true; // allow players to be able to select an ans
        if (isVoter) {
            textView_status.setText("VOTER");
            btn_submit.setText("Vote this card!");
            listView_answers.setEnabled(false); // don't allow voter to play a card from their hand at all.
            listView_playArea.setEnabled(false); // don't allow voter to choose a card from playArea straightaway. Wait for everyone to play their card first.
            btn_submit.setOnClickListener(new View.OnClickListener() {
                @RequiresApi(api = Build.VERSION_CODES.N)
                @Override
                public void onClick(View v) { // if voter, deal with listView_playArea
                    // deal with this after you handle the answerer side
                    chosenCard.ifPresent(votedAnswer -> {
                        try {
                            JSONObject votedInfo = new JSONObject();
                            votedInfo.put("roomName", JoinGame.roomName);
                            votedInfo.put("votedAnswer", votedAnswer);
                            socket.emit("voterHasVoted", votedInfo);
                            listView_playArea.setEnabled(false); // don't let the voter vote for another card once they have
                            chosenCard = Optional.empty(); // empty the chosenCard variable so cannot submit anything when button is clicked again
                        } catch (Exception e) {
                            e.printStackTrace();
                        }
                    });
                }
            });
        } else {
            textView_status.setText("ANSWERER");
            btn_submit.setText("Pick this card!");
            listView_answers.setEnabled(true); // allow answerer to choose a card
            btn_submit.setOnClickListener(new View.OnClickListener() {
                @RequiresApi(api = Build.VERSION_CODES.N)
                @Override
                public void onClick(View v) { // if answerer, deal with listView_answers
                    chosenCard.ifPresent(answer -> {
                        try {
                            // Store both roomName and the answer string into a JSONObject to be passed to the server
                            JSONObject answerInfo = new JSONObject();
                            answerInfo.put("answerString", answer);
                            answerInfo.put("roomName", JoinGame.roomName);
                            socket.emit("selectAnswer", answerInfo); // emit the answer string back to server
                            listView_answers.setEnabled(false); // don't let the answerer play another card once they have chosen a card
                            chosenCard = Optional.empty(); // empty the chosenCard variable so cannot submit anything when button is clicked again
                        } catch (Exception e) {
                            e.printStackTrace();
                        }
                    });

                }
            });
        }
    }

    public void backToMain(View view) {// to set the playerInfo page invisible
        playerListLayout.setVisibility(View.INVISIBLE);
    }

    public void evokeInfo(View view) {// to bring out the playerInfo page
        playerListLayout.setVisibility(View.VISIBLE);
    }

    // ======================== END OF HELPER FUNCTIONS ====================================== //
}
