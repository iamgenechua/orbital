package com.example.appsagainsthumanity_v1;

import androidx.appcompat.app.AppCompatActivity;

import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.ListView;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONException;

import java.util.ArrayList;
import java.util.Collections;

import io.socket.client.Socket;
import io.socket.emitter.Emitter;

public class WaitingLobby extends AppCompatActivity {

    Button bttn_start;
    ListView playerList;

    Socket socket;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_waiting_lobby);

        TextView roomNameDisplay = findViewById(R.id.roomNameDisplay);
        roomNameDisplay.setText("Room: " + JoinGame.roomName);

        bttn_start = findViewById(R.id.bttn_start);
        playerList = findViewById(R.id.playerList);
        socket = JoinGame.socket;
        ArrayList<String> playerNames = new ArrayList<>();
        ArrayAdapter<String> arrayAdapter = new ArrayAdapter<>(this, android.R.layout.simple_list_item_1, playerNames);
        playerList.setAdapter(arrayAdapter);

        // socket listener to update the playerName listview then new player joins the current room
        socket.on("newPlayerJoined", new Emitter.Listener() {
            @Override
            public void call(Object... args) {
                final JSONArray jArray = (JSONArray) args[0];
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        playerNames.clear(); // same method as the updating of hand cards
                        for (int name = 0; name < jArray.length(); name++) {
                            try {
                                String tempString = (String) jArray.get(name);
                                playerNames.add(tempString);
                            } catch (JSONException e) {
                                e.printStackTrace();
                            }
                        }
                        arrayAdapter.notifyDataSetChanged();
                    }
                });
            }
        });

        // socket listener to respond to server's instruction to start the game
        socket.on("startGameClient", new Emitter.Listener() {
            @Override
            public void call(Object... args) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        Intent intent = new Intent(getApplicationContext(), MainActivity.class);
                        startActivity(intent);
                    }
                });
            }
        });

    }

    public void startGame(View view) {
        socket.emit("startGameServer", JoinGame.roomName);
    }
}
