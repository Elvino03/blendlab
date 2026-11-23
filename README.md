# Blendlab

Blendlab turns a single image or up to ten artworks into a fixed-supply ERC-721 collection. The studio builds token metadata in the browser and opens a wallet transaction only after the creator reviews the mint.

## Run the studio

Open `dist/index.html` to try the preview offline, or run `npm start` and visit `http://127.0.0.1:4173` in a browser with an installed EVM wallet. Choose an extension under **Connect wallet**. Open the connected account in the header to switch wallets or disconnect. The default network is Ethereum Sepolia. Add the selected network in your wallet before minting if your wallet does not already list it. The current-wallet-network option accepts other compatible EVM networks.

Run `npm ci` and `npm run build` to rebuild the self-contained HTML. The Solidity contract is compiled with the Paris EVM target and pins the OpenZeppelin ERC-721 implementation.

## Artwork and minting

- Use **Try a sample** to explore the single-image blender or the three-image collection.
- Local uploads use PNG, JPG or WebP and may be compressed to fit onchain. The preview shows the image data the token will use.
- **Add IPFS artwork** accepts an already pinned image URI. The contract stores this reference and the token metadata onchain. Keep the IPFS image pinned.
- **Review mint** deploys one ERC-721 contract through the connected wallet. The wallet pays network gas and receives all the tokens in the same transaction.
- **Mint history** stores transaction hashes on the current browser. Use **Refresh receipts** while connected to the corresponding network.

The contract does not expose a method for minting additional tokens or changing metadata. This prototype has been exercised with a local EVM simulator. Public release would require verified operator details, a custom domain and live testnet checks.
