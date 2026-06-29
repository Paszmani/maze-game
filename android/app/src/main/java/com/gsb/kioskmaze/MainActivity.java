package com.gsb.kioskmaze;

import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;

/**
 * Totem Android: tela cheia imersiva, tela sempre ligada e Lock Task (screen
 * pinning) para travar o visitante no app.
 *
 * Lock Task sem device-owner = "fixacao de tela" (escapavel segurando
 * Voltar+Recentes). Para travamento TOTAL, defina o app como device-owner via ADB
 * (ver android/README-kiosk.md). Nesse caso o startLockTask() trava de verdade.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }

    @Override
    public void onResume() {
        super.onResume();
        enterImmersive();
        startKioskLock();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) enterImmersive();
    }

    private void enterImmersive() {
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            | View.SYSTEM_UI_FLAG_FULLSCREEN
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
        );
    }

    private void startKioskLock() {
        try {
            startLockTask();
        } catch (Exception ignored) {
            // Em alguns estados o Lock Task nao pode iniciar; ignora.
        }
    }
}
