<script>
async function startPayTRPayment() {
  // 1️⃣ Backend init çağrısı
  const res = await fetch("/api/paytr/init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: "user_123",        // login sisteminden gelecek
      email: "test@aivo.tr",
      plan: "AIVO_PRO",
      credits: 300,
      amount: 199
    })
  });

  const data = await res.json();
  if (!data.ok) {
    alert("Ödeme başlatılamadı");
    return;
  }

  const formData = data.form;

  // 2️⃣ PayTR formu oluştur
  const form = document.createElement("form");
  form.method = "POST";
  form.action = "https://www.paytr.com/odeme";
  form.target = "paytriframe";

  Object.keys(formData).forEach((key) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = key;
    input.value = formData[key];
    form.appendChild(input);
  });

  document.body.appendChild(form);

  // 3️⃣ Iframe aç
  document.getElementById("paytr-iframe-wrap").style.display = "block";

  // 4️⃣ Form submit → iframe
  form.submit();

  // 5️⃣ Temizlik
  setTimeout(() => form.remove(), 1000);
}
</script>
