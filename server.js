require('dotenv').config();
const express = require('express');
const { ethers } = require('ethers');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const SEED_PHRASE = process.env.SEED_PHRASE;
const RPC_URL = 'https://polygon-rpc.com'; // Polygon RPC
const BSPI_ADDRESS = '0x9cbA7EE455eED643555D12B65D28b82A3AdB3f10';

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = ethers.Wallet.fromMnemonic(SEED_PHRASE).connect(provider);

// BSPI Contract ABI (replace with actual ABI)
const BSPI_ABI = [
    // Add BSPI contract ABI here
];

const bspiContract = new ethers.Contract(BSPI_ADDRESS, BSPI_ABI, wallet);

app.post('/api/enviar', async (req, res) => {
    try {
        const tx = await bspiContract.sendTokens(req.body.to, ethers.utils.parseUnits('50', 18)); // assuming 18 decimals
        await tx.wait();
        res.status(200).send({ success: true, txHash: tx.hash });
    } catch (error) {
        res.status(500).send({ success: false, message: error.message });
    }
});

app.get('/api/saldo', async (req, res) => {
    try {
        const balance = await wallet.getBalance();
        res.status(200).send({ balance: ethers.utils.formatUnits(balance, 18) });
    } catch (error) {
        res.status(500).send({ success: false, message: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});