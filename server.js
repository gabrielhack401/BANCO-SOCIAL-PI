const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const path = require('path');
const session = require('express-session');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ==============================================
// SESSÃO PARA LOGIN (PAINEL SECRETO)
// ==============================================
app.use(session({
    secret: 'segredo-do-painel-bspi',
    resave: false,
    saveUninitialized: true
}));

// ==============================================
// CONFIGURAÇÕES
// ==============================================
const CONTRACT_ADDRESS = "0x9cbA7EE455eED643555D12B65D28b82A3AdB3f10";
let REWARD_AMOUNT = "5"; // ⬅️ AGORA PODE SER ALTERADO PELO PAINEL
const DECIMALS = 18;
const RPC_URL = "https://polygon-rpc.com";

const CONTRACT_ABI = [
    "function transfer(address to, uint256 amount) returns (bool)",
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
            console.error('❌ ERRO: Frase secreta não encontrada no Environment!');
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

// ==============================================
// ROTA DA API - ENVIAR BSPI
// ==============================================
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
        
        res.json({
            ok: true,
            hash: tx.hash,
            quantidade: REWARD_AMOUNT
        });

        tx.wait().then(() => {
            console.log(`✅ Transação confirmada: ${tx.hash}`);
        });

    } catch (error) {
        console.error('Erro ao enviar:', error);
        res.status(500).json({ erro: error.message });
    }
});

// ==============================================
// ROTA DA API - VER SALDO
// ==============================================
app.get('/api/saldo', async (req, res) => {
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
// PAINEL SECRETO (ÁREA ADMIN)
// ==============================================

// Página de login do painel
app.get('/admin', (req, res) => {
    if (req.session.logado) {
        // Se já estiver logado, mostra o painel
        res.sendFile(path.join(__dirname, 'public', 'admin-panel.html'));
    } else {
        // Se não, mostra o formulário de login
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Painel Admin - BSPI</title>
                <script src="https://cdn.tailwindcss.com"></script>
            </head>
            <body class="bg-gray-900 text-white flex items-center justify-center min-h-screen">
                <div class="bg-zinc-800 p-8 rounded-2xl w-96">
                    <h1 class="text-2xl font-bold mb-6 text-yellow-500">🔐 Área Restrita</h1>
                    <form method="POST" action="/admin/login">
                        <input type="password" name="senha" placeholder="Senha do admin" 
                               class="w-full p-3 rounded-xl mb-4 bg-zinc-700 text-white">
                        <button type="submit" class="w-full bg-yellow-500 text-black font-bold py-3 rounded-xl">
                            Entrar
                        </button>
                    </form>
                </div>
            </body>
            </html>
        `);
    }
});

// Rota de login
app.post('/admin/login', express.urlencoded({ extended: true }), (req, res) => {
    const SENHA_ADMIN = "BSPI@2025"; // ⬅️ VOCÊ PODE MUDAR ESSA SENHA
    
    if (req.body.senha === SENHA_ADMIN) {
        req.session.logado = true;
        res.redirect('/admin');
    } else {
        res.send(`
            <script>
                alert('Senha incorreta!');
                window.location.href = '/admin';
            </script>
        `);
    }
});

// Rota de logout
app.get('/admin/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/admin');
});

// API do painel (requer login)
app.get('/api/admin/dados', async (req, res) => {
    if (!req.session.logado) {
        return res.status(401).json({ erro: 'Não autorizado' });
    }

    try {
        const balance = await contract.balanceOf(masterAddress);
        const formatted = ethers.utils.formatUnits(balance, DECIMALS);
        
        res.json({
            endereco: masterAddress,
            saldo: formatted,
            recompensaAtual: REWARD_AMOUNT,
            rede: 'Polygon',
            contrato: CONTRACT_ADDRESS
        });
    } catch (error) {
        res.status(500).json({ erro: error.message });
    }
});

// API para alterar recompensa (requer login)
app.post('/api/admin/set-recompensa', express.json(), async (req, res) => {
    if (!req.session.logado) {
        return res.status(401).json({ erro: 'Não autorizado' });
    }

    const { novoValor } = req.body;
    
    if (!novoValor || isNaN(novoValor) || novoValor <= 0) {
        return res.status(400).json({ erro: 'Valor inválido' });
    }

    REWARD_AMOUNT = String(novoValor);
    
    res.json({
        ok: true,
        novaRecompensa: REWARD_AMOUNT
    });
});

// ==============================================
// ROTA RAIZ - REDIRECIONA PARA O SITE
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
    console.log(`📁 Site público: http://localhost:${PORT}`);
    console.log(`🔒 Painel admin: http://localhost:${PORT}/admin`);
});
