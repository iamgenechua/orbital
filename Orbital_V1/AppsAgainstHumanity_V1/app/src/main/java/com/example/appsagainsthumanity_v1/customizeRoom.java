package com.example.appsagainsthumanity_v1;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;

import android.content.Intent;
import android.os.Bundle;
import android.text.TextUtils;
import android.util.Log;
import android.view.View;
import android.widget.EditText;
import android.widget.Toast;

import org.json.JSONObject;

import io.socket.client.Socket;

public class customizeRoom extends AppCompatActivity {

    // ======================== START OF GLOBAL VARIABLES ====================================== //

    // initialise variables
    EditText roundDuration;
    EditText restDuration;
    EditText maxHands;
    EditText maxRounds;

    JSONObject attributeBox; // the package of room setting information to be received

    Socket socket;

    // the room attributes to be displayed
    int roundTime;
    int restTime;
    int maxHand;
    int maxRound;

    // ======================== END OF GLOBAL VARIABLES ====================================== //

    // ======================== START OF ONCREATE FUNCTION ====================================== //
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_customize_room);

        socket = JoinGame.socket;

        // initialise views
        roundDuration = findViewById(R.id.editText1);
        restDuration = findViewById(R.id.editText2);
        maxHands = findViewById(R.id.editText3);
        maxRounds = findViewById(R.id.editText4);

        // set the texts of editTexts with numerical values of the current room attributes
        attributeBox = WaitingLobby.attributeBox;
        try {
            roundTime = attributeBox.getInt("ROUND_TIME");
            restTime = attributeBox.getInt("REST_TIME");
            maxHand = attributeBox.getInt("MAX_HAND");
            maxRound = attributeBox.getInt("NUMBER_ROUNDS");
        } catch (Exception e) {
            e.printStackTrace();
        }
        roundDuration.setText(Integer.toString(roundTime));
        restDuration.setText(Integer.toString(restTime));
        maxHands.setText(Integer.toString(maxHand));
        maxRounds.setText(Integer.toString(maxRound));
    }

    // ======================== END OF ONCREATE FUNCTION ====================================== //

    // ======================== START OF HELPER FUNCTIONS ====================================== //

    public void saveChanges(View view) {

        // Obtain the entries by the player
        String entryR = roundDuration.getText().toString();
        String entryE = restDuration.getText().toString();
        String entryH = maxHands.getText().toString();
        String entryN = maxRounds.getText().toString();

        // check if any of the entries are empty
        if(TextUtils.isEmpty(entryR) || TextUtils.isEmpty(entryE) || TextUtils.isEmpty(entryH) || TextUtils.isEmpty(entryN)) {
            Toast.makeText(this, "No empty entry allowed", Toast.LENGTH_SHORT).show();
        } else {
            // update the server with the new set of attributes
            int roundEntry = Integer.parseInt(entryR);
            int restEntry = Integer.parseInt(entryE);
            int handEntry = Integer.parseInt(entryH);
            int roundNumberEntry = Integer.parseInt(entryN);
            try {
                attributeBox.put("ROUND_TIME", roundEntry);
                attributeBox.put("REST_TIME", restEntry);
                attributeBox.put("MAX_HAND", handEntry);
                attributeBox.put("NUMBER_ROUNDS", roundNumberEntry);
                socket.emit("updatedAttributes", attributeBox);
            } catch (Exception e) {
                e.printStackTrace();
            }
            startActivity(new Intent(getApplicationContext(), WaitingLobby.class));
        }
    }

    public void cancelChanges(View view) { // if player doesn't want to edit, lead him back to lobby
        startActivity(new Intent(getApplicationContext(), WaitingLobby.class));
    }

    // display the editTexts with the default numerical values
    public void defaultChanges(View view) {
        roundDuration.setText(roundTime);
        restDuration.setText(restTime);
        maxHands.setText(maxHand);
        maxRounds.setText(maxRound);
    }
    // ======================== END OF HELPER FUNCTIONS ====================================== //
}
