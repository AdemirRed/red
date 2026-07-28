const bcrypt = require('bcryptjs');

async function generateHash() {
    try {
        const hash = await bcrypt.hash('admin123', 12);
        console.log('Hash para senha admin123:', hash);
        
        // Verificar se o hash funciona
        const isValid = await bcrypt.compare('admin123', hash);
        console.log('Verificação do hash:', isValid);
        
    } catch (error) {
        console.error('Erro ao gerar hash:', error);
    }
}

generateHash();
