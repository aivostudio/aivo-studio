package tr.aivo.app;

import android.app.DownloadManager;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.URLUtil;
import android.widget.Toast;

import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.ConsumeParams;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.BridgeActivity;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class MainActivity extends BridgeActivity {

  private BillingClient billingClient;
  private final Map<String, ProductDetails> productDetailsMap = new HashMap<>();

private final PurchasesUpdatedListener purchasesUpdatedListener = (billingResult, purchases) -> {
  if (
    billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK &&
    purchases != null
  ) {
    for (Purchase purchase : purchases) {
      handlePurchase(purchase);
    }
    return;
  }

  evaluateJs(
    "window.dispatchEvent(new CustomEvent('aivo:play-billing-error',{detail:{error:'" +
    billingResult.getResponseCode() +
    "',message:" +
    jsString(billingResult.getDebugMessage()) +
    "}}));"
  );
};

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    CookieManager cookieManager = CookieManager.getInstance();
    cookieManager.setAcceptCookie(true);
    cookieManager.setAcceptThirdPartyCookies(getBridge().getWebView(), true);
    cookieManager.flush();

        getBridge().getWebView().setDownloadListener((url, userAgent, contentDisposition, mimetype, contentLength) -> {
      try {
        String downloadUrl = String.valueOf(url);

        if (downloadUrl.startsWith("https://localhost/api/media/proxy")) {
          downloadUrl = downloadUrl.replace(
            "https://localhost/api/media/proxy",
            "https://aivo.tr/api/media/proxy"
          );
        }

        DownloadManager.Request request = new DownloadManager.Request(Uri.parse(downloadUrl));

        String cookies = CookieManager.getInstance().getCookie(url);
        if (cookies != null) {
          request.addRequestHeader("Cookie", cookies);
        }

        request.addRequestHeader("User-Agent", userAgent);
        request.setMimeType(mimetype);
        request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
        request.setDestinationInExternalPublicDir(
          Environment.DIRECTORY_DOWNLOADS,
          URLUtil.guessFileName(url, contentDisposition, mimetype)
        );

        DownloadManager downloadManager = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
        downloadManager.enqueue(request);

        Toast.makeText(this, "Video indirme başladı", Toast.LENGTH_SHORT).show();
      } catch (Exception error) {
        Toast.makeText(this, "İndirme başlatılamadı", Toast.LENGTH_SHORT).show();
      }
    });

    billingClient = BillingClient.newBuilder(this)
      .setListener(purchasesUpdatedListener)
      .enablePendingPurchases()
      .build();

    billingClient.startConnection(new BillingClientStateListener() {

      @Override
      public void onBillingSetupFinished(BillingResult billingResult) {
            if (
          billingResult.getResponseCode() ==
          BillingClient.BillingResponseCode.OK
        ) {
          queryProducts();
          consumeExistingPurchases();
        }
      }

      @Override
      public void onBillingServiceDisconnected() {}
    });

    getBridge()
      .getWebView()
      .addJavascriptInterface(
        new AivoPlayBillingBridge(),
        "AivoPlayBilling"
      );
  }

  private void queryProducts() {

    List<QueryProductDetailsParams.Product> products =
      new ArrayList<>();

    products.add(
      QueryProductDetailsParams.Product
        .newBuilder()
        .setProductId("tr.aivo.credits.25")
        .setProductType(BillingClient.ProductType.INAPP)
        .build()
    );

    products.add(
      QueryProductDetailsParams.Product
        .newBuilder()
        .setProductId("tr.aivo.credits.100")
        .setProductType(BillingClient.ProductType.INAPP)
        .build()
    );

    products.add(
      QueryProductDetailsParams.Product
        .newBuilder()
        .setProductId("tr.aivo.credits.200")
        .setProductType(BillingClient.ProductType.INAPP)
        .build()
    );

    products.add(
      QueryProductDetailsParams.Product
        .newBuilder()
        .setProductId("tr.aivo.credits.500")
        .setProductType(BillingClient.ProductType.INAPP)
        .build()
    );

    QueryProductDetailsParams params =
      QueryProductDetailsParams
        .newBuilder()
        .setProductList(products)
        .build();

    billingClient.queryProductDetailsAsync(
      params,
      (billingResult, productDetailsList) -> {

        if (
          billingResult.getResponseCode() !=
          BillingClient.BillingResponseCode.OK
        ) {
          return;
        }

        productDetailsMap.clear();

        for (ProductDetails item : productDetailsList) {
          productDetailsMap.put(
            item.getProductId(),
            item
          );
        }
      }
    );
  }

  private String planToProductId(String value) {

    if (value == null) {
      return "";
    }

    if (value.startsWith("tr.aivo.credits.")) {
      return value;
    }

    if ("baslangic".equals(value)) {
      return "tr.aivo.credits.25";
    }

    if ("standart".equals(value)) {
      return "tr.aivo.credits.100";
    }

    if ("pro".equals(value)) {
      return "tr.aivo.credits.200";
    }

    if ("studyo".equals(value)) {
      return "tr.aivo.credits.500";
    }

    return "";
  }
  private void startPurchase(String plan) {

    runOnUiThread(() -> {

      String productId = planToProductId(plan);

      ProductDetails productDetails =
        productDetailsMap.get(productId);

      if (productDetails == null) {

        queryProducts();

        evaluateJs(
          "window.dispatchEvent(new CustomEvent('aivo:play-billing-error',{detail:{error:'PRODUCT_NOT_READY'}}));"
        );

        return;
      }

      List<BillingFlowParams.ProductDetailsParams>
        productDetailsParamsList =
          new ArrayList<>();

      productDetailsParamsList.add(
        BillingFlowParams.ProductDetailsParams
          .newBuilder()
          .setProductDetails(productDetails)
          .build()
      );

      BillingFlowParams billingFlowParams =
        BillingFlowParams
          .newBuilder()
          .setProductDetailsParamsList(
            productDetailsParamsList
          )
          .build();

      billingClient.launchBillingFlow(
        this,
        billingFlowParams
      );
    });
  }

  private void handlePurchase(Purchase purchase) {

    String productId =
      purchase.getProducts() != null &&
      !purchase.getProducts().isEmpty()
        ? purchase.getProducts().get(0)
        : "";

    String purchaseToken =
      purchase.getPurchaseToken();

    String js =
      "fetch('/api/play-billing/verify', {" +
      "method:'POST'," +
      "credentials:'include'," +
      "cache:'no-store'," +
      "headers:{'Content-Type':'application/json','Accept':'application/json'}," +
      "body:JSON.stringify({" +
      "productId:" + jsString(productId) + "," +
      "purchaseToken:" + jsString(purchaseToken) + "," +
      "email:(localStorage.getItem('aivo_user_email')||'')," +
      "userId:(localStorage.getItem('aivo_user_email')||'')" +
      "})" +
      "}).then(function(r){return r.json();}).then(function(data){" +
      "window.dispatchEvent(new CustomEvent('aivo:play-billing-verified',{detail:data}));" +
      "if(window.mobileToast&&data&&data.ok){window.mobileToast.success('Kredi tanımlandı.');}" +
      "if(window.mobileCreditsInit){window.mobileCreditsInit();}" +
      "}).catch(function(err){" +
      "window.dispatchEvent(new CustomEvent('aivo:play-billing-error',{detail:{error:String(err)}}));" +
      "});";

    evaluateJs(js);

    ConsumeParams consumeParams =
      ConsumeParams
        .newBuilder()
        .setPurchaseToken(purchaseToken)
        .build();

    billingClient.consumeAsync(
      consumeParams,
      (billingResult, token) -> {
        evaluateJs(
          "window.dispatchEvent(new CustomEvent('aivo:play-billing-consumed',{detail:{code:" +
          billingResult.getResponseCode() +
          ",message:" +
          jsString(billingResult.getDebugMessage()) +
          "}}));"
        );
      }
    );
  }
    private void consumeExistingPurchases() {
    QueryPurchasesParams params =
      QueryPurchasesParams
        .newBuilder()
        .setProductType(BillingClient.ProductType.INAPP)
        .build();

    billingClient.queryPurchasesAsync(
      params,
      (billingResult, purchases) -> {
        if (
          billingResult.getResponseCode() !=
          BillingClient.BillingResponseCode.OK ||
          purchases == null
        ) {
          return;
        }

        for (Purchase purchase : purchases) {
          String purchaseToken = purchase.getPurchaseToken();

          ConsumeParams consumeParams =
            ConsumeParams
              .newBuilder()
              .setPurchaseToken(purchaseToken)
              .build();

          billingClient.consumeAsync(
            consumeParams,
            (consumeResult, token) -> {
              evaluateJs(
                "window.dispatchEvent(new CustomEvent('aivo:play-billing-existing-consumed',{detail:{code:" +
                consumeResult.getResponseCode() +
                ",message:" +
                jsString(consumeResult.getDebugMessage()) +
                "}}));"
              );
            }
          );
        }
      }
    );
  }

  private String jsString(String value) {

    if (value == null) {
      value = "";
    }

    return "'" +
      value
        .replace("\\", "\\\\")
        .replace("'", "\\'") +
      "'";
  }

  private void evaluateJs(String js) {

    runOnUiThread(() -> {
      getBridge()
        .getWebView()
        .evaluateJavascript(js, null);
    });
  }

  public class AivoPlayBillingBridge {

    @JavascriptInterface
    public void purchase(String plan) {

      android.util.Log.d(
        "AivoPlayBilling",
        "purchase called plan=" + plan
      );

      startPurchase(plan);
    }
  }
}
