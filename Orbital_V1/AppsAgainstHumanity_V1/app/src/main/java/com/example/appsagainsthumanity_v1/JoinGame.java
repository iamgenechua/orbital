package com.example.appsagainsthumanity_v1;

import androidx.appcompat.app.AppCompatActivity;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONObject;

import io.socket.client.IO;
import io.socket.client.Socket;
import io.socket.emitter.Emitter;

public class JoinGame extends AppCompatActivity {

    EditText roomEntry;
    EditText nameEntry;

    public static Socket socket;
    public static String roomName;
    public static String userName;


    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_join_game);

        roomEntry = findViewById(R.id.roomEntry);
        nameEntry = findViewById(R.id.nameEntry);

    }


    public void joinGame(View view) {

        roomName = roomEntry.getText().toString();
        userName = nameEntry.getText().toString();

        if (roomName == "" || userName == "") {
            Toast.makeText(this, "You did not enter a username or a roomID", Toast.LENGTH_LONG).show();
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

                JSONObject userInfo = new JSONObject();
                userInfo.put("RoomID", roomName);
                userInfo.put("Username", userName);
                socket.emit("joinRoom", userInfo);
            } catch (Exception e) {
                Toast.makeText(this, e.getMessage() + "", Toast.LENGTH_SHORT).show();
            }
        }
        Intent intent = new Intent(getApplicationContext(), WaitingLobby.class);
        startActivity(intent);
    }
}