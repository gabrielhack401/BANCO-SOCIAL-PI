const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const CONTRACT_ADDRESS = "0x9cbA7EE455eED643555D12B65D28b82A3AdB3f10";
const REWARD_AMOUNT = "50";
const DECIMALS = 18;
const RPC_URL = "https://polygon-rpc.com";
const CONTRACT_ABI = [
    "function transfer(address to, uint256 amount) returns (bool)",
    "function balanceOf(address) view returns (uint256)"
];

let provider, wallet, contract;
let masterAddress = "";

async function initWallet() {
    try {
        const seed = process.env.SEED;
        if (!seed) {
            console.error('❌ ERRO: Frase secreta não encontrada no Environment!');
            console.error('👉 Adicione SEED no Render com sua frase de 12 palavras');
            return;
        }

        provider = new ethers.providers.JsonRpcProvider(RPC_URL);
        wallet = ethers.Wallet.fromMnemonic(seed).connect(provider);
        masterAddress = await wallet.getAddress();
        contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

        console.log('✅ Carteira master conectada:', masterAddress);

        const balance = await contract.balanceOf(masterAddress);
        const formatted = ethers.utils.formatUnits(balance, DECIMALS);
        console.log(`💰 Saldo master: ${formatted} BSPI`);
    } catch (error) {
        console.error('❌ Erro ao conectar carteira:', error);
    }
}

initWallet();

app.post('/api/enviar', async (req, res) => {
    const { destino } = req.body;
    if (!destino || !ethers.utils.isAddress(destino)) {
        return res.status(400).json({ erro: 'Endereço inválido' });
    }

    try {
        const balance = await contract.balanceOf(masterAddress);
        const rewardWei = ethers.utils.parseUnits(REWARD_AMOUNT, DECIMALS);

        if (balance.lt(rewardWei)) {
            return res.status(400).json({ erro: 'Saldo insuficiente na conta master' });
        }

        const tx = await contract.transfer(destino, rewardWei);
        res.json({ ok: true, hash: tx.hash, quantidade: REWARD_AMOUNT });

        tx.wait().then(() => {
            console.log(`✅ Transação confirmada: ${tx.hash}`);
        });
    } catch (error) {
        console.error('Erro ao enviar:', error);
        res.status(500).json({ erro: error.message });
    }
});

app.get('/api/saldo', async (req, res) => {
    try {
        const balance = await contract.balanceOf(masterAddress);
        const formatted = ethers.utils.formatUnits(balance, DECIMALS);
        res.json({ endereco: masterAddress, saldo: formatted });
    } catch (error) {
        res.status(500).json({ erro: error.message });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Servidor rodando na porta ${PORT}`);
    console.log(`📁 Site: http://localhost:${PORT}`);
    console.log(`🔗 API: http://localhost:${PORT}/api/saldo`);
});