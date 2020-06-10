package com.example.appsagainsthumanity_v1;

import androidx.appcompat.app.AppCompatActivity;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import io.socket.client.IO;
import io.socket.client.Socket;
import io.socket.emitter.Emitter;

public class JoinGame extends AppCompatActivity {

    // ======================== START OF GLOBAL VARIABLES ====================================== //
    // initialise public static variables
    public static Socket socket;// this maintains connection throughout the duration
    public static String roomName;// name of the room
    public static String userName;// name of the player

    // initialise views
    EditText roomEntry;
    EditText nameEntry;

    // ======================== END OF GLOBAL VARIABLES ====================================== //

    // ======================== START OF ONCREATE FUNCTION ====================================== //
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_join_game);

        // initialise the two editTexts
        roomEntry = findViewById(R.id.roomEntry);
        nameEntry = findViewById(R.id.nameEntry);
    }
    // ======================== END OF ONCREATE FUNCTION ====================================== //

    // ======================== START OF HELPER FUNCTIONS ====================================== //

    public void joinGame(View view) {// the player has keyed in his particulars and decides to join a game (set OnClick has been done in XML)

        // obtain the player entries
        roomName = roomEntry.getText().toString();
        userName = nameEntry.getText().toString();

        if (roomName.equals("")  || userName.equals("")) {// check if the player has entered a room name and player name
            // do not proceed if user never key in anything
        } else {
            // Connect to Socket Server
            try {
                socket = IO.socket("http://10.0.2.2:3000");
                socket.on(Socket.EVENT_CONNECT, new Emitter.Listener() {
                    @Override
                    public void call(Object... args) {
                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                Toast.makeText(JoinGame.this, "Connected", Toast.LENGTH_SHORT).show();
                            }
                        });
                    }
                });

                socket.connect();
                // to inform the server who from which room has connected to the server
                JSONObject userInfo = new JSONObject();
                userInfo.put("RoomID", roomName);
                userInfo.put("Username", userName);
                socket.emit("joinRoom", userInfo);

                /*
                When the player tries to join, the server checks if the room which the player requests
                to join is currently running a game. If the game has already started, the server emits
                "joinFailed" then the player is notified of this failure and has all his previous entries
                set to empty. If the room is not running any game, the server emits 'joinSuccess' then
                the player is directed to the lobby.
                 */
                // socket listener to check if room joined successfully
                socket.on("joinSuccess", new Emitter.Listener() {
                    @Override
                    public void call(Object... args) {
                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                // get to the next activity
                                Intent intent = new Intent(getApplicationContext(), WaitingLobby.class);
                                startActivity(intent);
                            }
                        });
                    }
                });

                // socket listener to check if the room cannot be joined
                socket.on("joinFailed", new Emitter.Listener() {
                    @Override
                    public void call(Object... args) {
                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                Toast.makeText(JoinGame.this, "Game has already started, please join another room", Toast.LENGTH_SHORT).show();
                                roomEntry.setText("");
                                nameEntry.setText("");
                                roomName = "";
                                userName = "";
                                socket.disconnect();
                            }
                        });
                    }
                });
            } catch (Exception e) {
                Toast.makeText(this, e.getMessage() + "", Toast.LENGTH_SHORT).show();
            }
        }
    }
    // ======================== END OF HELPER FUNCTIONS ====================================== //
}