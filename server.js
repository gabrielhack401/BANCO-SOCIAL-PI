const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ==============================================
// CONFIGURAÇÕES BÁSICAS
// ==============================================
const CONTRACT_ADDRESS = "0x9cbA7EE455eED643555D12B65D28b82A3AdB3f10";
const DECIMALS = 18;
const RPC_URL = "https://polygon-rpc.com";

const CONTRACT_ABI = [
    "function balanceOf(address) view returns (uint256)"
];

// ==============================================
// CONEXÃO COM A CARTEIRA MASTER (OPCIONAL)
// ==============================================
let provider, wallet, contract;
let masterAddress = "";

async function initWallet() {
    try {
        const seed = process.env.SEED;
        
        if (!seed) {
            console.log('ℹ️ Nenhuma SEED configurada. API de saldo não funcionará.');
            return;
        }

        provider = new ethers.providers.JsonRpcProvider(RPC_URL);
        wallet = ethers.Wallet.fromMnemonic(seed).connect(provider);
        masterAddress = await wallet.getAddress();
        contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

        console.log('✅ Carteira master conectada:', masterAddress);
        
    } catch (error) {
        console.error('❌ Erro ao conectar carteira:', error);
    }
}
initWallet();

// ==============================================
// ROTA DA API - VER SALDO (OPCIONAL)
// ==============================================
app.get('/api/saldo', async (req, res) => {
    if (!contract || !masterAddress) {
        return res.status(503).json({ erro: 'API de saldo não disponível' });
    }
    
    try {
        const balance = await contract.balanceOf(masterAddress);
        const formatted = ethers.utils.formatUnits(balance, DECIMALS);
        res.json({
            endereco: masterAddress,
            saldo: formatted
        });
    } catch (error) {
        res.status(500).json({ erro: error.message });
    }
});

// ==============================================
// ROTA RAIZ - SERVE O SITE
// ==============================================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==============================================
// INICIAR SERVIDOR
// ==============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Servidor rodando na porta ${PORT}`);
    console.log(`📁 Site: https://bspi-geral.onrender.com`);
    console.log(`🔗 API: https://bspi-geral.onrender.com/api/saldo (se configurada)`);
});
