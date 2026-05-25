package tr.aivo.app;

import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;

import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
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
    }
  };

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    CookieManager cookieManager = CookieManager.getInstance();
    cookieManager.setAcceptCookie(true);
    cookieManager.setAcceptThirdPartyCookies(getBridge().getWebView(), true);
    cookieManager.flush();

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

  private String planToProductId(String plan) {

    if ("baslangic".equals(plan)) {
      return "tr.aivo.credits.25";
    }

    if ("standart".equals(plan)) {
      return "tr.aivo.credits.100";
    }

    if ("pro".equals(plan)) {
      return "tr.aivo.credits.200";
    }

    if ("studyo".equals(plan)) {
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
      "purchaseToken:" + jsString(purchaseToken) +
      "})" +
      "}).then(function(r){return r.json();}).then(function(data){" +
      "window.dispatchEvent(new CustomEvent('aivo:play-billing-verified',{detail:data}));" +
      "if(window.mobileToast&&data&&data.ok){window.mobileToast.success('Kredi tanımlandı.');}" +
      "if(window.mobileCreditsInit){window.mobileCreditsInit();}" +
      "}).catch(function(err){" +
      "window.dispatchEvent(new CustomEvent('aivo:play-billing-error',{detail:{error:String(err)}}));" +
      "});";

    evaluateJs(js);
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
