package com.entr.ticketplatform;

import com.getcapacitor.BridgeActivity;
import com.entr.ticketplatform.plugins.SecureStoragePlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(SecureStoragePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
