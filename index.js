const { Client } = require('discord.js-selfbot-v13');
const { joinVoiceChannel } = require('@discordjs/voice');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// Configurações
const TOKENS_FILE = 'tokens.json';
const CONFIG_FILE = 'config.json';

// Verifica e cria arquivos se não existirem
if (!fs.existsSync(TOKENS_FILE)) {
    fs.writeFileSync(TOKENS_FILE, '[]');
}
if (!fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({
        rpc: {
            details: "xP",
            startTimestamp: Date.now(),
            largeImageKey: "xx",
            largeImageText: "xx",
            smallImageKey: "xx",
            smallImageText: "xx"
        }
    }, null, 2));
}

// Carrega configurações
const config = JSON.parse(fs.readFileSync(CONFIG_FILE));
let tokens = JSON.parse(fs.readFileSync(TOKENS_FILE));

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Menu principal
function mainMenu() {
    console.log('\n=== painel ===');
    console.log('1. configurar token');
    console.log('2. ver tokens logadas');
    console.log('3. Configurar RPC');
    console.log('4. connect call');
    console.log('5. Sair');
    
    rl.question('Escolha uma opção: ', (choice) => {
        switch(choice) {
            case '1':
                addNewToken();
                break;
            case '2':
                manageTokens();
                break;
            case '3':
                configureRPC();
                break;
            case '4':
                directCallLogin();
                break;
            case '5':
                process.exit(0);
                break;
            default:
                console.log('Opção inválida!');
                mainMenu();
        }
    });
}

// Adicionar nova token
function addNewToken() {
    rl.question('\nDigite a nova token: ', (token) => {
        if (!token.trim()) {
            console.log('Token inválida!');
            return addNewToken();
        }
        
        tokens.push(token.trim());
        saveTokens();
        console.log('Token adicionada com sucesso!');
        mainMenu();
    });
}

// Gerenciar tokens
function manageTokens() {
    console.log('\n=== Tokens ===');
    tokens.forEach((token, index) => {
        console.log(`${index + 1}. Token #${index + 1} (${token.substring(0, 5)}...)`);
    });
    
    console.log(`${tokens.length + 1}. Conectar todas`);
    console.log(`${tokens.length + 2}. Voltar`);
    
    rl.question('Escolha uma opção: ', (choice) => {
        const index = parseInt(choice) - 1;
        
        if (choice === `${tokens.length + 2}`) {
            mainMenu();
        } else if (choice === `${tokens.length + 1}`) {
            askChannelAndConnectAll();
        } else if (index >= 0 && index < tokens.length) {
            startBot(tokens[index]);
        } else {
            console.log('Opção inválida!');
            manageTokens();
        }
    });
}

// Função para login direto em call
function directCallLogin() {
    if (tokens.length === 0) {
        console.log('❌ Nenhuma token disponível!');
        return mainMenu();
    }

    rl.question('\n🔊 Digite o ID do canal de voz: ', (channelId) => {
        if (!channelId.trim()) {
            console.log('❌ ID inválido');
            return directCallLogin();
        }
        connectAllTokens(channelId.trim());
    });
}

// Função auxiliar para perguntar canal e conectar
function askChannelAndConnectAll() {
    rl.question('\n🔊 Digite o ID do canal de voz: ', (channelId) => {
        if (!channelId.trim()) {
            console.log('❌ ID inválido');
            return askChannelAndConnectAll();
        }
        connectAllTokens(channelId.trim());
    });
}

// Configurar RPC
function configureRPC() {
    console.log('\nConfiguração atual do RPC:');
    console.log(JSON.stringify(config.rpc, null, 2));
    
    rl.question('\nDeseja editar? (s/n): ', (answer) => {
        if (answer.toLowerCase() === 's') {
            editRPCConfig();
        } else {
            mainMenu();
        }
    });
}

function editRPCConfig() {
    rl.question('Novo texto para "details": ', (details) => {
        config.rpc.details = details || config.rpc.details;
        saveConfig();
        console.log('Configuração atualizada!');
        mainMenu();
    });
}

// Salvar dados
function saveTokens() {
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2));
}

function saveConfig() {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// Iniciar bot individual
function startBot(token) {
    const client = new Client({
        checkUpdate: false
    });

    client.on('ready', () => {
        console.log(`\n✅ Logado como ${client.user.tag}`);
        setupRPC(client);
        askForChannel(client);
    });

    client.login(token).catch(err => {
        console.error(`❌ Falha no login: ${err.message}`);
        manageTokens();
    });
}

// Conectar todas as tokens
async function connectAllTokens(channelId) {
    console.log('\nIniciando conexão de todas as contas...');
    const clients = [];
    const connections = [];

    try {
        for (const token of tokens) {
            const client = new Client({ checkUpdate: false });
            clients.push(client);

            client.on('ready', async () => {
                console.log(`✅ ${client.user.tag} conectado`);
                
                try {
                    const channel = client.channels.cache.get(channelId);
                    if (!channel || channel.type !== 'GUILD_VOICE') {
                        console.log(`❌ ${client.user.tag} - Canal inválido`);
                        return;
                    }

                    const connection = joinVoiceChannel({
                        channelId: channel.id,
                        guildId: channel.guild.id,
                        adapterCreator: channel.guild.voiceAdapterCreator,
                        selfDeaf: true,
                        selfMute: false,
                    });

                    connections.push({ client, connection });
                    console.log(`🎧 ${client.user.tag} entrou no canal ${channel.name}`);
                    
                    // Configura RPC após entrar no canal
                    setupRPC(client);
                } catch (err) {
                    console.error(`❌ ${client.user.tag} - Erro ao entrar no canal:`, err.message);
                }
            });

            await client.login(token).catch(err => {
                console.error(`❌ Falha no login (${token.substring(0, 5)}...):`, err.message);
            });
        }

        console.log('\n🛑 Pressione CTRL+C para desconectar todas');
        console.log('⚠️ Digite "sair" para retornar ao menu');

        // Monitora entrada do usuário
        const inputListener = () => {
            rl.question('', (input) => {
                if (input.toLowerCase() === 'sair') {
                    disconnectAll(clients, connections);
                } else {
                    inputListener();
                }
            });
        };
        inputListener();

    } catch (error) {
        console.error('❌ Erro geral:', error.message);
        disconnectAll(clients, connections);
    }
}

// Desconectar todas as contas
async function disconnectAll(clients, connections) {
    console.log('\nDesconectando todas as contas...');
    
    // Desconecta das chamadas de voz
    for (const { connection } of connections) {
        try {
            connection.disconnect();
        } catch (err) {
            console.error('❌ Erro ao desconectar:', err.message);
        }
    }
    
    // Desconecta os clients
    for (const client of clients) {
        try {
            client.destroy();
        } catch (err) {
            console.error('❌ Erro ao destruir client:', err.message);
        }
    }
    
    console.log('Todas as contas foram desconectadas');
    mainMenu();
}

// Configurar RPC
function setupRPC(client) {
    client.user.setPresence({
        status: 'dnd',
        activities: [{
            name: 'xP',
            type: 'PLAYING',
            ...config.rpc
        }]
    });
}

// Gerenciar conexão de voz individual
function askForChannel(client) {
    rl.question('\n🔊 Digite o ID do canal de voz (ou "voltar"): ', (input) => {
        if (input.toLowerCase() === 'voltar') {
            client.destroy();
            manageTokens();
            return;
        }

        connectToVoice(client, input.trim());
    });
}

async function connectToVoice(client, channelId) {
    try {
        const channel = client.channels.cache.get(channelId);
        
        if (!channel) {
            console.log('❌ Canal não encontrado');
            return askForChannel(client);
        }
        
        if (channel.type !== 'GUILD_VOICE') {
            console.log('❌ O ID não corresponde a um canal de voz');
            return askForChannel(client);
        }
        
        const connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
            selfDeaf: true,
            selfMute: false,
        });
        
        console.log(`🎧 Conectado a: ${channel.name} (${channel.guild.name})`);
        console.log('🛑 Digite "voltar" para retornar ao menu');
        
        connection.on('stateChange', (oldState, newState) => {
            if (newState.status === 'disconnected') {
                console.log('⚠️ Desconectado do canal');
                askForChannel(client);
            }
        });
        
    } catch (error) {
        console.error('❌ Falha na conexão:', error.message);
        askForChannel(client);
    }
}

// Iniciar aplicação
console.log('=== ninez self call ===');
mainMenu();
