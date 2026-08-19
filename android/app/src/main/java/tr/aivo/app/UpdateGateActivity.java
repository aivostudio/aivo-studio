package tr.aivo.app;

import android.app.Activity;
import android.os.Bundle;
import android.util.Log;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;

import com.google.android.play.core.appupdate.AppUpdateInfo;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.appupdate.AppUpdateOptions;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.UpdateAvailability;

public class UpdateGateActivity extends MainActivity {

  private static final String TAG = "AivoInAppUpdate";

  private AppUpdateManager appUpdateManager;

  private final ActivityResultLauncher<IntentSenderRequest> updateLauncher =
    registerForActivityResult(
      new ActivityResultContracts.StartIntentSenderForResult(),
      result -> {
        if (result.getResultCode() != Activity.RESULT_OK) {
          Toast.makeText(
            UpdateGateActivity.this,
            "AIVO'yu kullanmak için uygulamayı güncelleyin.",
            Toast.LENGTH_LONG
          ).show();

          finishAffinity();
        }
      }
    );

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    appUpdateManager = AppUpdateManagerFactory.create(this);
    checkForImmediateUpdate();
  }

  private void checkForImmediateUpdate() {
    appUpdateManager
      .getAppUpdateInfo()
      .addOnSuccessListener(appUpdateInfo -> {
        if (
          appUpdateInfo.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE &&
          appUpdateInfo.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)
        ) {
          startImmediateUpdate(appUpdateInfo);
        }
      })
      .addOnFailureListener(error ->
        Log.w(TAG, "Update check failed", error)
      );
  }

  private void startImmediateUpdate(AppUpdateInfo appUpdateInfo) {
    Toast.makeText(
      this,
      "Yeni AIVO sürümü hazır. Uygulamayı güncelleyin.",
      Toast.LENGTH_LONG
    ).show();

    boolean started = appUpdateManager.startUpdateFlowForResult(
      appUpdateInfo,
      updateLauncher,
      AppUpdateOptions.newBuilder(AppUpdateType.IMMEDIATE).build()
    );

    if (!started) {
      Log.w(TAG, "Immediate update flow could not be started");
    }
  }

  @Override
  protected void onResume() {
    super.onResume();

    if (appUpdateManager == null) {
      return;
    }

    appUpdateManager
      .getAppUpdateInfo()
      .addOnSuccessListener(appUpdateInfo -> {
        if (
          appUpdateInfo.updateAvailability() ==
            UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS
        ) {
          startImmediateUpdate(appUpdateInfo);
        }
      })
      .addOnFailureListener(error ->
        Log.w(TAG, "Update resume check failed", error)
      );
  }
}
