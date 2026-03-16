const jwt = require('jsonwebtoken');

const generateToken = (userId, email, role) => {
    console.log('🔐 Генерация токена для:', { userId, email, role });
    
    const token = jwt.sign(
        { userId, email, role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );
    
    console.log('✅ Токен сгенерирован, содержит role:', role);
    return token;
};

const verifyToken = (token) => {
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('🔍 Токен верифицирован:', decoded);
        return decoded;
    } catch (error) {
        console.error('❌ Ошибка верификации токена:', error.message);
        throw error;
    }
};

module.exports = {
    generateToken,
    verifyToken
};