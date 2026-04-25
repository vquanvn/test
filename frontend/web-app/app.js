function baseUrl() {
  return document.getElementById("baseUrl").value.replace(/\/$/, "");
}

function show(id, data) {
  document.getElementById(id).textContent =
    typeof data === "string" ? data : JSON.stringify(data, null, 2);
}

let authToken = "";
let authUser = null;

document.getElementById("btnRegister").addEventListener("click", async () => {
  const body = {
    email: document.getElementById("regEmail").value,
    fullName: document.getElementById("regName").value,
    password: document.getElementById("regPassword").value
  };

  const resp = await fetch(`${baseUrl()}/users/users/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  show("authInfo", await resp.json());
});

document.getElementById("btnLogin").addEventListener("click", async () => {
  const body = {
    email: document.getElementById("loginEmail").value,
    password: document.getElementById("loginPassword").value
  };

  const resp = await fetch(`${baseUrl()}/users/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const data = await resp.json();
  if (resp.ok) {
    authToken = data.token;
    authUser = data.user;
    show("authInfo", `Dang nhap thanh cong: ${authUser.full_name} (id=${authUser.id})`);
  } else {
    show("authInfo", data);
  }
});

document.getElementById("btnLoadProducts").addEventListener("click", async () => {
  const resp = await fetch(`${baseUrl()}/orders/products`);
  show("productsOutput", await resp.json());
});

document.getElementById("btnCreateOrder").addEventListener("click", async () => {
  const userId = Number(document.getElementById("orderUserId").value);
  const productId = document.getElementById("orderProductId").value;
  const quantity = Number(document.getElementById("orderQuantity").value || 1);
  const shippingAddress = document.getElementById("orderAddress").value;

  const payload = {
    user_id: userId,
    shipping_address: shippingAddress,
    items: [{ product_id: productId, quantity }]
  };

  const resp = await fetch(`${baseUrl()}/orders/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
    },
    body: JSON.stringify(payload)
  });

  show("orderOutput", await resp.json());
});

document.getElementById("btnGetRecs").addEventListener("click", async () => {
  const userId = document.getElementById("recUserId").value || (authUser ? authUser.id : "");
  const resp = await fetch(`${baseUrl()}/recommendations/recommendations/user/${userId}`);
  show("recOutput", await resp.json());
});
