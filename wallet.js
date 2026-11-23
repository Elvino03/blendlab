const announcedWallets = new Map();
let activeWallet = null;
let walletPicker = null;

function discoverWallets() {
  window.dispatchEvent(new Event("eip6963:requestProvider"));
}

function installedWallets() {
  const wallets = [...announcedWallets.values()];
  const injected = window.ethereum;
  const legacy = Array.isArray(injected?.providers) ? injected.providers : wallets.length ? [] : [injected];
  const unique = [...new Set(legacy)].filter(provider =>
    typeof provider?.request === "function" && !wallets.some(wallet => wallet.provider === provider)
  );
  return wallets.concat(unique.map((provider, index) => ({
    provider,
    name: unique.length === 1 ? "Browser wallet" : `Browser wallet ${index + 1}`
  })));
}

function announceWallet({ detail }) {
  const { info, provider } = detail ?? {};
  if (typeof provider?.request !== "function" || typeof info?.uuid !== "string" ||
      typeof info.name !== "string" || !info.name.trim() ||
      announcedWallets.has(info.uuid) || [...announcedWallets.values()].some(wallet => wallet.provider === provider)) return;
  const iconUrl = typeof info.icon === "string" && info.icon.length <= 32_768 &&
    /^data:image\/(?:png|jpeg|webp|svg\+xml)(?:;[^,]*)?,/i.test(info.icon) ? info.icon : "";
  announcedWallets.set(info.uuid, { name: info.name.trim().slice(0, 64), iconUrl, provider });
  if (isOpenPicker(walletPicker) && !walletPicker.pending) renderWallets(walletPicker);
}

function isOpenPicker(picker) {
  return Boolean(picker && walletPicker === picker && picker.choices.isConnected && $("#dialog").open);
}

function walletIcon(wallet) {
  if (!wallet.iconUrl) return icon("wallet");
  // Wallet-provided SVGs load as images so they cannot run script in this document.
  const image = make("img");
  image.alt = "";
  image.src = wallet.iconUrl;
  image.onerror = () => image.replaceWith(icon("wallet"));
  return image;
}

function renderWallets(picker) {
  const focused = picker.choices.querySelector(":focus")?.walletProvider;
  const wallets = installedWallets();
  const options = wallets.map(wallet => {
    const control = button("", "secondary wallet-option");
    control.disabled = picker.pending;
    control.walletProvider = wallet.provider;
    control.append(walletIcon(wallet), make("span", wallet.name));
    control.onclick = () => chooseWallet(picker, wallet);
    return control;
  });
  picker.choices.replaceChildren(...options);
  picker.help.hidden = options.length > 0;
  if (focused) options.find(control => control.walletProvider === focused)?.focus();
}

function showWalletPicker({ onConnected = () => $("#dialog").close(), onBack } = {}) {
  const choices = make("div");
  choices.className = "wallet-options";
  const help = make("p", "Open Blendlab in a browser with an EVM wallet extension, or in your wallet’s browser.");
  const status = make("p");
  status.className = "message";
  status.setAttribute("role", "status");
  status.hidden = true;
  const controls = [choices, help, status];
  if (onBack) {
    const back = button("Back");
    back.onclick = onBack;
    controls.push(back);
  }
  const picker = { choices, help, status, onConnected, pending: false };
  walletPicker = picker;
  dialog("Choose a wallet", ...controls);
  discoverWallets();
  renderWallets(picker);
  choices.querySelector("button")?.focus();
}

async function chooseWallet(picker, wallet) {
  if (!isOpenPicker(picker) || picker.pending) return;
  picker.pending = true;
  picker.choices.querySelectorAll("button").forEach(control => { control.disabled = true; });
  picker.status.hidden = false;
  picker.status.classList.remove("error");
  picker.status.textContent = `Approve the connection in ${wallet.name}.`;
  try {
    const [account] = await call("eth_requestAccounts", undefined, wallet);
    if (!isOpenPicker(picker)) return;
    if (typeof account !== "string" || !addressPattern.test(account)) throw Error("Select an account in your wallet to continue.");
    setActiveWallet(wallet, account);
    walletPicker = null;
    picker.onConnected();
  } catch (error) {
    if (isOpenPicker(picker)) {
      picker.status.textContent = walletError(error);
      picker.status.classList.add("error");
    }
  } finally {
    if (isOpenPicker(picker)) {
      picker.pending = false;
      renderWallets(picker);
      [...picker.choices.querySelectorAll("button")]
        .find(control => control.walletProvider === wallet.provider)?.focus();
    }
  }
}

function setActiveWallet(wallet, account = null) {
  activeWallet?.detach?.();
  activeWallet = wallet;
  setAccount(account);
  if (!wallet) return;
  const { provider } = wallet;
  const disconnected = () => {
    if (activeWallet !== wallet) return;
    setActiveWallet(null);
    if ($("#dialog").open && $("#dialog-body .wallet-account")) showWalletPicker();
  };
  const accountsChanged = (accounts) => {
    if (activeWallet !== wallet) return;
    const account = accounts?.[0];
    if (typeof account === "string" && addressPattern.test(account)) setAccount(account);
    else disconnected();
  };
  provider.on?.("accountsChanged", accountsChanged);
  provider.on?.("disconnect", disconnected);
  wallet.detach = () => {
    provider.removeListener?.("accountsChanged", accountsChanged);
    provider.removeListener?.("disconnect", disconnected);
  };
}

function showConnectedWallet() {
  const wallet = activeWallet;
  if (!wallet || !state.account) return showWalletPicker();
  const address = make("p", state.account);
  address.className = "wallet-account";
  const network = make("p");
  network.hidden = true;
  const switchWallet = button("Switch wallet", "primary");
  switchWallet.onclick = () => showWalletPicker({ onBack: showConnectedWallet });
  const disconnect = button("Disconnect");
  disconnect.onclick = () => {
    setActiveWallet(null);
    $("#dialog").close();
  };
  const actions = make("div");
  actions.className = "wallet-actions";
  actions.append(switchWallet, disconnect);
  dialog("Connected wallet", make("p", wallet.name), address, network, actions);
  getChain(wallet).then(chain => {
    network.textContent = networkName(chain);
    network.hidden = false;
  }).catch(() => {});
}
