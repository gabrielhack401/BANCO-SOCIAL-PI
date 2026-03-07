const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ==============================================
// CONFIGURAÇÕES
// ==============================================
const CONTRACT_ADDRESS = "0x9cbA7EE455eED643555D12B65D28b82A3AdB3f10";
const DECIMALS = 18;
const RPC_URL = "https://polygon-rpc.com";
const CONFIG_FILE = path.join(__dirname, 'config.json');

// Arquivo de configuração (rewardAmount - não usado no momento, mas mantido)
let config = { rewardAmount: "5" };
if (fs.existsSync(CONFIG_FILE)) {
    config = JSON.parse(fs.readFileSync(CONFIG_FILE));
}

const CONTRACT_ABI = [
    "function balanceOf(address) view returns (uint256)"
];

// ==============================================
// CONEXÃO COM A CARTEIRA MASTER (VIA ENV)
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
// ROTA PÚBLICA - VER SALDO (OPCIONAL)
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
// PAINEL ADMIN (PROTEGIDO POR SENHA)
// ==============================================
const ADMIN_PASSWORD = "BSPI@9924"; // ⬅️ SENHA DEFINIDA POR VOCÊ

// Servir o painel admin
app.use('/admin', express.static(path.join(__dirname, 'public', 'admin')));

// API de login
app.post('/api/admin/login', (req, res) => {
    const { senha } = req.body;
    if (senha === ADMIN_PASSWORD) {
        res.json({ ok: true });
    } else {
        res.status(401).json({ erro: 'Senha incorreta' });
    }
});

// API para pegar dados (protegida)
app.get('/api/admin/dados', async (req, res) => {
    const authHeader = req.headers.authorization;
    
    if (authHeader !== ADMIN_PASSWORD) {
        return res.status(401).json({ erro: 'Não autorizado' });
    }

    try {
        const balance = await contract.balanceOf(masterAddress);
        const formatted = ethers.utils.formatUnits(balance, DECIMALS);
        
        // Aqui você pode adicionar outras estatísticas depois
        res.json({
            endereco: masterAddress,
            saldo: formatted,
            status: "online"
        });
    } catch (error) {
        res.status(500).json({ erro: error.message });
    }
});

// ==============================================
// ROTA RAIZ - SERVE O SITE PRINCIPAL
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
    console.log(`📁 Site principal: https://bspi-geral.onrender.com`);
    console.log(`🔒 Painel secreto: https://bspi-geral.onrender.com/admin`);
    console.log(`🔗 API pública: https://bspi-geral.onrender.com/api/saldo`);
});
