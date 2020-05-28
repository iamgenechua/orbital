package com.example.appsagainsthumanity_v1;

import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.RecyclerView;

import android.os.Bundle;
import android.util.Log;
import android.widget.ArrayAdapter;
import android.widget.ListView;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONException;

import java.util.ArrayList;
import java.util.Arrays;

import io.socket.client.IO;
import io.socket.client.Socket;
import io.socket.emitter.Emitter;

public class MainActivity extends AppCompatActivity {

    TextView textView_status;
    TextView textView_question;

    ArrayList<String> hand;
    ListView listView_answers;
    ArrayAdapter<String> arrayAdapter;


    Socket socket;
    boolean isVoter;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        textView_status = findViewById(R.id.textView_status);
        textView_question = findViewById(R.id.textView_question);

        // Display hand in client
        hand = new ArrayList<>();
        listView_answers = findViewById(R.id.listView_answers);
        arrayAdapter = new ArrayAdapter<String>(this, android.R.layout.simple_list_item_single_choice, hand);
        listView_answers.setAdapter(arrayAdapter);

        isVoter = false;

        // Connect to Socket Server
        try {
            socket = IO.socket("http://10.0.2.2:3000");
            socket.on(Socket.EVENT_CONNECT, new Emitter.Listener() {
                @Override
                public void call(Object... args) {
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            Toast.makeText(MainActivity.this, "Connected", Toast.LENGTH_SHORT).show();
                        }
                    });
                }
            });

            socket.connect();
            runGame();
        } catch (Exception e) {
            Toast.makeText(MainActivity.this, e.getMessage() + "", Toast.LENGTH_SHORT).show();
        }
    }

    public void runGame() {
        socket.on("voter", new Emitter.Listener() {
            @Override
            public void call(Object... args) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        textView_status.setText("YOU ARE THE VOTER");
                        isVoter = true;
                    }
                });
            }
        });

        socket.on("answerer", new Emitter.Listener() {
            @Override
            public void call(Object... args) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        textView_status.setText("YOU ARE THE ANSWERER");
                        isVoter = false;
                    }
                });
            }
        });

        socket.on(Socket.EVENT_DISCONNECT, new Emitter.Listener() {

            @Override
            public void call(Object... args) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        textView_status.setText("YOU ARE DISCONNECTED");
                    }
                });
            }
        });

        socket.on("question", new Emitter.Listener() {
            @Override
            public void call(Object... args) {
                final Object[] myArgs = args;
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        Log.i("question", "called");
                        textView_question.setText(myArgs[0].toString());
                    }
                });
            }
        });

        socket.on("answer", new Emitter.Listener() {
            @Override
            public void call(Object... args) {
                final JSONArray jArray = (JSONArray) args[0];
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        hand.clear();
                        for (int item = 0; item < jArray.length(); item++) {
                            try {
                                String tempString = (String) jArray.get(item);
                                hand.add(tempString);
                            } catch (JSONException e) {
                                e.printStackTrace();
                            }
                        }
                        arrayAdapter.notifyDataSetChanged();
                    }
                });
            }
        });
    }
}
