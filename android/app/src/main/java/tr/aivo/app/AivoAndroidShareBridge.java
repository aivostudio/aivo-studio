package tr.aivo.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.widget.Toast;
import androidx.core.content.FileProvider;
import java.io.File;
import java.io.FileOutputStream;

public class AivoAndroidShareBridge {

  private final MainActivity activity;

  public AivoAndroidShareBridge(MainActivity activity) {
    this.activity = activity;
  }

  @JavascriptInterface
  public void shareBase64File(String base64Data, String fileName, String mimeType, String title) {
    try {
      String cleanBase64 = String.valueOf(base64Data);
      if (cleanBase64.contains(",")) {
        cleanBase64 = cleanBase64.substring(cleanBase64.indexOf(",") + 1);
      }

      byte[] bytes = Base64.decode(cleanBase64, Base64.DEFAULT);

      String safeFileName = String.valueOf(fileName == null ? "" : fileName).trim();
      if (safeFileName.isEmpty()) {
        safeFileName = "aivo-invoice-" + System.currentTimeMillis() + ".pdf";
      }

      String safeMimeType = String.valueOf(mimeType == null ? "" : mimeType).trim();
      if (safeMimeType.isEmpty() || "null".equals(safeMimeType)) {
        safeMimeType = "application/pdf";
      }

      File shareDir = new File(activity.getCacheDir(), "aivo-share");
      if (!shareDir.exists() && !shareDir.mkdirs()) {
        throw new Exception("share_dir_create_failed");
      }

      File shareFile = new File(shareDir, safeFileName);
      FileOutputStream outputStream = new FileOutputStream(shareFile);
      outputStream.write(bytes);
      outputStream.flush();
      outputStream.close();

      Uri contentUri = FileProvider.getUriForFile(
        activity,
        activity.getPackageName() + ".fileprovider",
        shareFile
      );

      Intent sendIntent = new Intent(Intent.ACTION_SEND);
      sendIntent.setType(safeMimeType);
      sendIntent.putExtra(Intent.EXTRA_STREAM, contentUri);
      sendIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

      String safeTitle = String.valueOf(title == null ? "" : title).trim();
      if (safeTitle.isEmpty()) {
        safeTitle = "AIVO Fatura";
      }

      Intent chooser = Intent.createChooser(sendIntent, safeTitle);
      chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

      activity.runOnUiThread(() -> activity.startActivity(chooser));
    } catch (Exception error) {
      activity.runOnUiThread(() -> {
        Toast.makeText(activity, "Paylaşım başlatılamadı", Toast.LENGTH_SHORT).show();
      });
    }
  }
}