const $ = (selector) => document.querySelector(selector);
const make = (tag, value) => {
  const element = document.createElement(tag);
  if (value !== undefined) element.textContent = value;
  return element;
};
function icon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  svg.setAttribute("aria-hidden", "true");
  use.setAttribute("href", `#i-${name}`);
  svg.append(use);
  return svg;
}
function button(label, className = "secondary") {
  const element = make("button", label);
  element.type = "button";
  element.className = `button ${className}`;
  return element;
}

const networks = new Map([
  ["0xaa36a7", { name: "Ethereum Sepolia", explorer: "https://sepolia.etherscan.io", test: true }],
  ["0x14a34", { name: "Base Sepolia", explorer: "https://sepolia.basescan.org", test: true }],
  ["0x2105", { name: "Base", explorer: "https://basescan.org" }],
  ["0x1", { name: "Ethereum", explorer: "https://etherscan.io" }],
  ["0xa", { name: "OP Mainnet", explorer: "https://optimistic.etherscan.io" }],
  ["0xa4b1", { name: "Arbitrum One", explorer: "https://arbiscan.io" }],
  ["0x89", { name: "Polygon PoS", explorer: "https://polygonscan.com" }]
]);

const MAX_ASSETS = 10;
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_INITCODE = 49_152;
const FILE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const addressPattern = /^0x[0-9a-f]{40}$/i;
const hashPattern = /^0x[0-9a-f]{64}$/i;
const encoder = new TextEncoder();
const historyKey = "blendlab.mints.v1";
const cookieKey = "blendlab.cookie-notice.v1";
const state = { mode: "single", assets: [], draft: null, busy: false, sending: false, account: null, history: readHistory() };

function readStorage(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function writeStorage(key, value) {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}
function readHistory() {
  try {
    const records = JSON.parse(readStorage(historyKey));
    return Array.isArray(records) ? records.filter(record => record && hashPattern.test(record.hash) && typeof record.name === "string") : [];
  } catch {
    return [];
  }
}
function remember(record) {
  state.history = [record, ...state.history.filter(item => item.hash !== record.hash || item.chain !== record.chain)].slice(0, 100);
  return writeStorage(historyKey, JSON.stringify(state.history));
}
function message(text = "", error = false, selector = "#form-message") {
  const element = $(selector);
  element.hidden = !text;
  element.textContent = text;
  element.classList.toggle("error", error);
}
function stamp(caption, mode = "") {
  $("#stage-status").textContent = caption;
  $("#stage-status").dataset.state = mode;
}
function setBusy(value) {
  state.busy = value;
  document.querySelectorAll("#art-form button, #art-form input, #art-form textarea, .mode button, #blend").forEach(element => { element.disabled = value; });
}
function showArt(mode) {
  const isSingle = mode === "single";
  $("#machine-title span").textContent = isSingle ? "The blender" : "Collection preview";
  $("#blend span").textContent = isSingle ? "Blend preview" : "Preview collection";
  $("#blender").hidden = !isSingle;
  $("#stage-caption").textContent = isSingle ? "Add artwork to load the blender." : "Add artwork to preview the collection.";
  $("#stage-caption").hidden = false;
  $("#result").hidden = true;
  $("#export").hidden = true;
  $("#mint").hidden = true;
  $("#blend").className = "button primary";
  if (isSingle) drawMachine(state.assets[0]?.image, state.assets.length > 0);
  if (state.assets.length) {
    $("#stage-caption").textContent = isSingle ? "Artwork loaded. Ready to blend." : `${state.assets.length} of ${MAX_ASSETS} artworks added.`;
  }
  stamp(state.assets.length ? "Loaded" : "Standby", state.assets.length ? "active" : "");
}
function invalidate() {
  state.draft = null;
  message();
  showArt(state.mode);
}
function selectMode(mode) {
  if (state.busy || state.mode === mode) return;
  if (mode === "single" && state.assets.length > 1 && !confirm("Keep the first artwork and remove the others from this draft?")) return;
  state.mode = mode;
  $("#single").setAttribute("aria-pressed", String(mode === "single"));
  $("#collection").setAttribute("aria-pressed", String(mode === "collection"));
  const single = mode === "single";
  if (single) state.assets.splice(1).forEach(release);
  $("#art-label").textContent = single ? "Artwork" : "Artworks";
  $("#title-label").textContent = single ? "NFT name" : "Collection name";
  $("#file").multiple = !single;
  $("#drop strong").textContent = single ? "Drop an image or browse" : "Drop images or browse";
  $("#drop small").textContent = single ? "PNG, JPG, WebP · up to 15 MB" : "Up to 10 images · 15 MB each";
  $("#symbol-field").hidden = single;
  $("#symbol").required = !single;
  renderAssets();
  invalidate();
}

function release(asset) {
  if (asset?.url?.startsWith("blob:")) URL.revokeObjectURL(asset.url);
}
function getImage(url) {
  const image = new Image();
  image.src = url;
  return image.decode().then(() => image);
}
function shortTitle(filename) {
  return filename.replace(/\.[a-z0-9]{1,8}$/i, "").trim().slice(0, 64) || "Untitled artwork";
}
function renderAssets() {
  const items = state.assets.map((asset, index) => {
    const line = make("li");
    let thumb = icon("link");
    if (asset.url) {
      thumb = make("img");
      thumb.src = asset.url;
      thumb.className = "file-icon";
      thumb.alt = "";
    }
    const remove = make("button");
    remove.type = "button";
    remove.className = "icon-button";
    remove.setAttribute("aria-label", `Remove ${asset.name}`);
    remove.append(icon("close"));
    remove.onclick = () => {
      release(state.assets[index]);
      state.assets.splice(index, 1);
      renderAssets();
      invalidate();
      $("#drop").focus();
    };
    line.append(thumb, make("span", asset.name), remove);
    return line;
  });
  $("#assets").replaceChildren(...items);
  $("#assets").hidden = !items.length;
}
function addAssets(assets) {
  if (state.mode === "single") {
    state.assets.forEach(release);
    state.assets = assets.slice(0, 1);
    if (!$("#title").value.trim()) $("#title").value = shortTitle(assets[0].name);
  } else {
    state.assets.push(...assets);
  }
  renderAssets();
  invalidate();
}
async function addFiles(files) {
  if (state.busy || !files.length) return;
  const room = state.mode === "single" ? 1 : MAX_ASSETS - state.assets.length;
  if (files.length > room) {
    message(`Choose up to ${room} ${room === 1 ? "image" : "images"} for this mint.`, true);
    return;
  }
  setBusy(true);
  const images = [];
  try {
    for (const file of files) {
      if (!FILE_TYPES.has(file.type) || file.size > MAX_FILE_BYTES) throw Error(`${file.name} must be a PNG, JPG or WebP under 15 MB.`);
      const url = URL.createObjectURL(file);
      const asset = { name: file.name, file, url };
      images.push(asset);
      try { asset.image = await getImage(url); } catch { throw Error(`Couldn't open ${file.name} as an image.`); }
    }
    addAssets(images);
  } catch (error) {
    images.forEach(release);
    message(error.message, true);
  } finally {
    setBusy(false);
  }
}
async function loadSample() {
  if (state.busy || (state.assets.length && !confirm("Replace the current artwork with the sample?"))) return;
  setBusy(true);
  try {
    const names = ["Signal Bloom", "Ember Ridge", "Moonwater"];
    const limit = state.mode === "single" ? 1 : names.length;
    const assets = await Promise.all(names.slice(0, limit).map(async (name, index) => {
      const url = sampleArt(index);
      return { name, url, image: await getImage(url) };
    }));
    state.assets.forEach(release);
    state.assets = [];
    $("#title").value = limit === 1 ? names[0] : "Signals at Dusk";
    $("#description").value = limit === 1 ? "An illustrated landscape at the edge of night." : "Three illustrated landscapes at the edge of night.";
    if (limit > 1) $("#symbol").value = "SIGNAL";
    addAssets(assets);
  } catch {
    message("The sample couldn't open. Try uploading an image.", true);
  } finally {
    setBusy(false);
  }
}
function addIpfs() {
  const value = $("#ipfs-uri").value.trim();
  if (!/^ipfs:\/\/(?:Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{20,})(?:\/[\w.%~!$&'()+,@=/-]+)?$/.test(value)) {
    message("Enter an ipfs:// URI with a CIDv0 or base32 CIDv1.", true);
    return;
  }
  if (state.mode === "collection" && state.assets.length >= MAX_ASSETS) {
    message("This collection is limited to 10 artworks.", true);
    return;
  }
  const basename = value.split("/").slice(3).pop();
  addAssets([{ name: basename ? shortTitle(basename) : `IPFS artwork ${state.assets.length + 1}`, uri: value }]);
  $("#ipfs-uri").value = "";
  $("#ipfs").open = false;
}

function bytes64(bytes) {
  let characters = "";
  for (let i = 0; i < bytes.length; i += 8192) characters += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(characters);
}
function dataBytes(url) {
  return Math.floor(url.slice(url.indexOf(",") + 1).replace(/=+$/, "").length * 3 / 4);
}
async function embeddedArt(asset, budget) {
  if (asset.uri) return { url: asset.uri, compressed: false };
  if (asset.file && asset.file.size <= budget) {
    const data = bytes64(new Uint8Array(await asset.file.arrayBuffer()));
    return { url: `data:${asset.file.type};base64,${data}`, compressed: false };
  }
  if (!asset.file && dataBytes(asset.url) <= budget) return { url: asset.url, compressed: false };
  const thumbnail = document.createElement("canvas");
  const context = thumbnail.getContext("2d");
  const picture = asset.image;
  for (const size of [352, 256, 192, 128, 96, 64, 48, 32]) {
    const scale = Math.min(1, size / Math.max(picture.naturalWidth, picture.naturalHeight));
    thumbnail.width = Math.max(1, Math.round(picture.naturalWidth * scale));
    thumbnail.height = Math.max(1, Math.round(picture.naturalHeight * scale));
    context.drawImage(picture, 0, 0, thumbnail.width, thumbnail.height);
    for (const quality of [.88, .68, .48]) {
      const url = thumbnail.toDataURL("image/webp", quality);
      if (dataBytes(url) <= budget) return { url, compressed: true };
    }
  }
  throw Error(`Couldn't fit ${asset.name} onchain. Add its pinned IPFS image instead.`);
}
function uint(value) {
  return BigInt(value).toString(16).padStart(64, "0");
}
function abiString(string) {
  const bytes = encoder.encode(string);
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  return uint(bytes.length) + hex.padEnd(Math.ceil(hex.length / 64) * 64, "0");
}
function deployment(name, symbol, uris) {
  const first = abiString(name);
  const second = abiString(symbol);
  const strings = uris.map(abiString);
  let offset = strings.length * 32;
  const offsets = strings.map(value => {
    const address = uint(offset);
    offset += value.length / 2;
    return address;
  });
  const array = uint(strings.length) + offsets.join("") + strings.join("");
  return "0x" + CONTRACT_CODE + uint(96) + uint(96 + first.length / 2) + uint(96 + (first.length + second.length) / 2) + first + second + array;
}
async function buildDraft() {
  const name = $("#title").value.trim();
  if (!name) throw Error("Enter a name before previewing.");
  const symbol = state.mode === "single" ? "BLEND" : $("#symbol").value.toUpperCase();
  const description = $("#description").value.trim();
  const budget = Math.min(4200, Math.floor(15_000 / state.assets.length));
  const items = await Promise.all(state.assets.map(async asset => {
    const art = await embeddedArt(asset, budget);
    const metadata = { name: state.mode === "single" ? name : shortTitle(asset.name), description, image: art.url };
    const uri = "data:application/json;base64," + bytes64(encoder.encode(JSON.stringify(metadata)));
    if (uri.length > 12_000) throw Error("The description and artwork are too large together. Shorten the description or use IPFS.");
    return { metadata, uri, compressed: art.compressed };
  }));
  const data = deployment(name, symbol, items.map(item => item.uri));
  if ((data.length - 2) / 2 > MAX_INITCODE) throw Error("This collection is too large for one transaction. Use more IPFS images or split the collection.");
  return { name, symbol, items, data };
}
function showResult(draft) {
  const tiles = draft.items.map(({ metadata }) => {
    const tile = make("figure");
    if (metadata.image.startsWith("data:")) {
      const img = make("img");
      img.src = metadata.image;
      img.alt = `Preview of ${metadata.name}`;
      tile.append(img);
    } else {
      const placeholder = make("div");
      placeholder.className = "remote-art";
      placeholder.setAttribute("aria-label", "Artwork stored on IPFS");
      placeholder.append(icon("link"), make("span", "IPFS image"));
      tile.append(placeholder);
    }
    if (state.mode === "collection") tile.append(make("figcaption", metadata.name));
    return tile;
  });
  $("#result-gallery").replaceChildren(...tiles);
  $("#result-title").textContent = draft.name;
  const embedded = draft.items.filter(item => item.metadata.image.startsWith("data:")).length;
  const compressed = draft.items.some(item => item.compressed);
  const storage = embedded === draft.items.length ? "Artwork embedded onchain" : embedded ? "Embedded artwork and IPFS links" : "Artwork linked from IPFS";
  $("#result-note").textContent = `${draft.items.length} ${draft.items.length === 1 ? "item" : "items"} · ${storage}${compressed ? " · File size reduced" : ""}`;
  $("#blender").hidden = true;
  $("#stage-caption").hidden = true;
  $("#result").hidden = false;
  $("#mint").hidden = false;
  $("#mint").className = "button primary";
  $("#export").hidden = false;
  $("#blend").className = "button secondary";
  $("#blend span").textContent = state.mode === "single" ? "Blend again" : "Preview again";
  stamp("Ready to mint", "ready");
}
async function preview(event) {
  event.preventDefault();
  if (state.busy) return;
  if (!state.assets.length) {
    message("Add artwork or try the sample to get started.", true);
    $("#drop").focus();
    return;
  }
  if (!event.currentTarget.reportValidity()) return;
  message();
  setBusy(true);
  showArt(state.mode);
  try {
    if (state.mode === "single") {
      stamp("Blending", "active");
      $("#stage-caption").textContent = "Preparing the NFT preview…";
    }
    const draft = await buildDraft();
    if (state.mode === "single") await animateBlender(state.assets[0].image);
    state.draft = draft;
    showResult(draft);
  } catch (error) {
    state.draft = null;
    showArt(state.mode);
    message(error.message, true);
  } finally {
    setBusy(false);
  }
}
function downloadMetadata() {
  if (!state.draft) return;
  const draft = state.draft;
  const content = state.mode === "single" ? draft.items[0].metadata : {
    name: draft.name,
    symbol: draft.symbol,
    items: draft.items.map(({ metadata }) => metadata)
  };
  const blob = new Blob([JSON.stringify(content, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = make("a");
  a.href = url;
  a.download = (draft.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "blendlab") + ".json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function dialog(title, ...elements) {
  $("#dialog-title").textContent = title;
  $("#dialog-body").replaceChildren(...elements);
  if (!$("#dialog").open) $("#dialog").showModal();
}
function call(method, params) {
  const provider = window.ethereum;
  if (!provider?.request) throw Error("Open the studio in a browser with an installed EVM wallet.");
  return provider.request(params ? { method, params } : { method });
}
function setAccount(account) {
  state.account = addressPattern.test(account ?? "") ? account : null;
  $("#wallet span").textContent = state.account ? `${state.account.slice(0, 6)}…${state.account.slice(-4)}` : "Connect wallet";
}
function walletError(error) {
  if (error?.code === 4001 || error?.code === "ACTION_REJECTED") return "The wallet request was declined. You can try again when ready.";
  if (error?.code === 4902) return "Add this network in your wallet, then try again.";
  if (error?.code === -32002) return "A request is already waiting in your wallet. Open the wallet to continue.";
  return String(error?.shortMessage || error?.message || "The wallet request didn't complete.").slice(0, 230);
}
async function connect() {
  if (!window.ethereum?.request) {
    dialog("Connect an EVM wallet", make("p", "Open Blendlab in a browser with an EVM wallet extension, or in your wallet’s browser. You can preview and download metadata here without a wallet."));
    return null;
  }
  const [account] = await call("eth_requestAccounts");
  setAccount(account);
  if (!state.account) throw Error("Select an account in your wallet to continue.");
  return state.account;
}
async function getChain() {
  const chain = await call("eth_chainId");
  if (!/^0x[\da-f]+$/i.test(chain)) throw Error("The wallet did not return a valid EVM chain ID.");
  return "0x" + BigInt(chain).toString(16);
}
function networkName(chain) {
  return networks.get(chain)?.name ?? (chain && /^0x[\da-f]+$/i.test(chain) ? `Chain ${BigInt(chain)}` : "Current wallet network");
}
function reviewMint() {
  if (!state.draft || state.sending) return;
  const draft = state.draft;
  const selected = $("#network").value;
  const networkLabel = networkName(selected);
  const embedded = draft.items.filter(item => item.metadata.image.startsWith("data:")).length;
  const details = make("dl");
  for (const [key, value] of [
    ["Name", draft.name],
    ["Network", networkLabel],
    ["Supply", `${draft.items.length} · ${draft.symbol}`],
    ["Artwork", embedded === draft.items.length ? "Embedded onchain" : embedded ? "Embedded and IPFS" : "IPFS links"]
  ]) details.append(make("dt", key), make("dd", value));
  const action = button("Continue to wallet", "primary");
  const status = make("p");
  status.className = "message";
  status.setAttribute("role", "status");
  status.hidden = true;
  action.onclick = () => sendMint(draft, selected, action, status);
  dialog("Review mint", details, make("p", "Your wallet will deploy a new ERC-721 contract and receive every NFT. The transaction requires gas. After confirmation, the metadata is public and permanent."), status, action);
}
async function sendMint(draft, selected, action, status) {
  if (state.sending) return;
  state.sending = true;
  action.disabled = true;
  $("#wallet").disabled = true;
  $("#close-dialog").disabled = true;
  status.hidden = false;
  status.classList.remove("error");
  try {
    status.textContent = "Checking your wallet and network…";
    const from = await connect();
    if (!from) return;
    let chain = await getChain();
    if (selected !== "current" && chain !== selected) {
      await call("wallet_switchEthereumChain", [{ chainId: selected }]);
      chain = await getChain();
      if (chain !== selected) throw Error("Switch to the selected network in your wallet before minting.");
    }
    const transaction = { from, data: draft.data, value: "0x0" };
    status.textContent = `Estimating gas on ${networkName(chain)}…`;
    try {
      const estimate = await call("eth_estimateGas", [transaction]);
      if (!/^0x[0-9a-f]+$/i.test(estimate) || BigInt(estimate) <= 0n) throw Error("The wallet returned an invalid gas estimate.");
      transaction.gas = estimate;
    } catch (error) {
      throw Error(`Gas estimation failed. ${walletError(error)}`);
    }
    if (await getChain() !== chain) throw Error("The wallet network changed. Review the network and try again.");
    const [active] = await call("eth_accounts");
    if (active?.toLowerCase() !== from.toLowerCase()) throw Error("The wallet account changed. Review the account and try again.");
    status.textContent = `Review and confirm the transaction in your wallet on ${networkName(chain)}.`;
    const hash = await call("eth_sendTransaction", [transaction]);
    if (!hashPattern.test(hash)) throw Error("The wallet did not return a transaction hash. Check wallet activity before retrying.");
    const record = { name: draft.name, chain, hash, count: draft.items.length, status: "Pending", submitted: Date.now() };
    const saved = remember(record);
    if (state.draft === draft) {
      $("#mint").hidden = true;
      $("#blend").className = "button primary";
      stamp("Submitted", "active");
    }
    const go = button("View mint history", "primary");
    go.onclick = () => { $("#dialog").close(); navigate("history"); refreshHistory(); };
    dialog("Transaction submitted", make("p", saved ? `Your mint is pending on ${networkName(chain)}.` : "Your mint is pending. Browser storage is unavailable, so copy the transaction hash before closing this page."), transactionRef(record), go);
  } catch (error) {
    status.textContent = walletError(error);
    status.classList.add("error");
  } finally {
    state.sending = false;
    $("#wallet").disabled = false;
    $("#close-dialog").disabled = false;
    action.disabled = false;
  }
}

function transactionRef(record) {
  const row = make("p");
  const explorer = networks.get(record.chain)?.explorer;
  if (explorer) {
    const a = make("a", "View transaction in explorer");
    a.href = `${explorer}/tx/${record.hash}`;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    row.append(a);
  }
  const hash = make("small", record.hash);
  if (explorer) row.append(make("br"));
  row.append(hash);
  row.style.overflowWrap = "anywhere";
  return row;
}
function renderHistory() {
  const list = $("#history-list");
  if (!state.history.length) {
    const blank = make("div");
    blank.className = "empty-history";
    const openStudio = button("Back to studio");
    openStudio.onclick = () => navigate("studio");
    blank.append(make("strong", "No mints yet"), make("p", "Your submitted transactions will appear here."), openStudio);
    list.replaceChildren(blank);
    return;
  }
  list.replaceChildren(...state.history.map(record => {
    const row = make("article");
    row.className = "history-row";
    row.append(make("strong", record.name), make("span", record.status), make("small", `${networkName(record.chain)} · ${record.count} ${record.count === 1 ? "item" : "items"}`), make("small", new Date(record.submitted).toLocaleDateString()));
    if (addressPattern.test(record.contract ?? "")) row.append(make("small", `Contract ${record.contract}`));
    row.append(transactionRef(record));
    return row;
  }));
}
async function refreshHistory() {
  const pending = state.history.filter(record => record.status === "Pending");
  if (!pending.length) {
    message("There are no pending transactions to check.", false, "#history-message");
    return;
  }
  $("#refresh").disabled = true;
  try {
    const current = await getChain();
    const matching = pending.filter(record => record.chain === current);
    if (!matching.length) throw Error("Switch your wallet to a network with a pending mint, then refresh.");
    for (const record of matching) {
      const receipt = await call("eth_getTransactionReceipt", [record.hash]);
      if (!receipt) continue;
      if (receipt.status === "0x1" && addressPattern.test(receipt.contractAddress ?? "")) {
        record.status = "Confirmed";
        record.contract = receipt.contractAddress;
      } else if (receipt.status === "0x0") {
        record.status = "Reverted";
      }
    }
    writeStorage(historyKey, JSON.stringify(state.history));
    renderHistory();
    const other = pending.length - matching.length;
    message(other ? `Checked ${networkName(current)}. Switch networks to check the other pending mints.` : `Checked ${networkName(current)}.`, false, "#history-message");
  } catch (error) {
    message(walletError(error), true, "#history-message");
  } finally {
    $("#refresh").disabled = false;
  }
}
function navigate(page) {
  const history = page === "history";
  $("#studio").hidden = history;
  $("#history").hidden = !history;
  $("#studio-nav").toggleAttribute("aria-current", !history);
  $("#history-nav").toggleAttribute("aria-current", history);
  $(history ? "#history-nav" : "#studio-nav").setAttribute("aria-current", "page");
  if (history) renderHistory();
}

const policies = {
  privacy: ["Privacy policy", [
    "Viper Vineswag operates Blendlab.",
    "Blendlab processes uploaded artwork and draft metadata in your browser. It stores recent mint records, such as the transaction hash, network and status, in this browser so you can see them in Mint history.",
    "When you choose to mint, your wallet handles the transaction. On public networks, the receiving address, transaction, contract address and NFT metadata become public. The metadata includes the image or its IPFS reference. Blendlab cannot erase public blockchain records.",
    "Vercel hosts this site and may process IP addresses and request information to deliver and protect it. Your wallet, block explorer and IPFS provider handle data under their own policies when you use those services.",
    "You can clear this site’s data in your browser to remove its local records. For privacy questions or requests, contact the operator by Direct Message on X."
  ]],
  terms: ["Terms and conditions", [
    "Viper Vineswag operates Blendlab, a tool for preparing and minting NFTs through your own wallet.",
    "Only mint artwork and metadata you have permission to use. Check the network, receiving wallet and estimated gas fee before signing.",
    "Blendlab currently charges no platform fee. Your wallet handles network fees, and your IPFS provider may charge separately. The network may charge gas for a transaction that reverts.",
    "A confirmed mint is permanent. IPFS images depend on continued hosting or pinning. Wallet and marketplace support can vary by network.",
    "For questions about these terms or the studio, contact the operator by Direct Message on X."
  ]],
  cookies: ["Cookie policy", [
    "Blendlab uses browser local storage to keep mint history on this device and remember your storage notice choice. The studio itself uses no optional cookies, trackers or analytics.",
    "When a review deployment requires Vercel sign-in, Vercel Authentication can set a cookie to remember that you have access.",
    "Clear this site’s cookies and storage through your browser settings to remove local records and preferences. Public blockchain records are stored separately."
  ]]
};
function dismissCookies() {
  writeStorage(cookieKey, "acknowledged");
  $("#cookie-banner").hidden = true;
}
function showPolicy(key) {
  const [title, paragraphs] = policies[key];
  const content = paragraphs.map(line => make("p", line));
  if (key === "privacy" || key === "terms") {
    const contact = make("a", "Contact @ViperVineswag on X");
    contact.href = "https://x.com/ViperVineswag";
    contact.target = "_blank";
    contact.rel = "noopener noreferrer";
    const links = make("p");
    links.append(contact);
    if (key === "privacy") {
      const hostPrivacy = make("a", "Vercel privacy notice");
      hostPrivacy.href = "https://vercel.com/legal/privacy-notice";
      hostPrivacy.target = "_blank";
      hostPrivacy.rel = "noopener noreferrer";
      links.append(make("br"), hostPrivacy);
    }
    content.push(links);
  } else {
    const save = button("Acknowledge storage");
    save.onclick = () => { dismissCookies(); $("#dialog").close(); };
    content.push(save);
  }
  dialog(title, ...content);
}

$("#single").onclick = () => selectMode("single");
$("#collection").onclick = () => selectMode("collection");
$("#file").onchange = (event) => {
  addFiles([...event.currentTarget.files]);
  event.currentTarget.value = "";
};
$("#drop").onclick = () => $("#file").click();
for (const name of ["dragover", "dragleave", "drop"]) {
  $("#drop").addEventListener(name, event => {
    event.preventDefault();
    $("#drop").classList.toggle("dragging", name === "dragover" && !state.busy);
    if (name === "drop") addFiles([...event.dataTransfer.files]);
  });
}
$("#sample").onclick = loadSample;
$("#ipfs-add").onclick = addIpfs;
$("#ipfs-uri").onkeydown = event => {
  if (event.key === "Enter") { event.preventDefault(); addIpfs(); }
};
for (const key of ["#title", "#description", "#symbol"]) $(key).oninput = invalidate;
$("#art-form").onsubmit = preview;
$("#export").onclick = downloadMetadata;
$("#mint").onclick = reviewMint;
$("#brand").onclick = () => navigate("studio");
$("#studio-nav").onclick = () => navigate("studio");
$("#history-nav").onclick = () => navigate("history");
$("#refresh").onclick = refreshHistory;
$("#wallet").onclick = async () => {
  $("#wallet").disabled = true;
  try {
    if (state.account) dialog("Connected wallet", make("p", state.account), make("p", networkName(await getChain())));
    else await connect();
  } catch (error) {
    dialog("Wallet connection", make("p", walletError(error)));
  } finally {
    $("#wallet").disabled = false;
  }
};
window.ethereum?.on?.("accountsChanged", accounts => setAccount(accounts[0]));
if (window.ethereum?.request) call("eth_accounts").then(accounts => setAccount(accounts[0])).catch(() => {});
$("#close-dialog").onclick = () => $("#dialog").close();
$("#dialog").addEventListener("cancel", event => { if (state.sending) event.preventDefault(); });
document.querySelectorAll("[data-policy]").forEach(element => { element.onclick = () => showPolicy(element.dataset.policy); });
$("#cookie-dismiss").onclick = dismissCookies;
$("#cookie-banner").hidden = readStorage(cookieKey) === "acknowledged";
showArt(state.mode);
