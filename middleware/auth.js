const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ error: 'No authentication token provided' });
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findOne({ _id: decoded.userId });

            if (!user) {
                return res.status(401).json({ error: 'User not found' });
            }

            // Check token expiration
            if (decoded.exp && decoded.exp < Date.now() / 1000) {
                return res.status(401).json({ error: 'Token has expired' });
            }

            req.user = user;
            req.token = token;
            next();
        } catch (jwtError) {
            if (jwtError.name === 'JsonWebTokenError') {
                return res.status(401).json({ error: 'Invalid token' });
            }
            if (jwtError.name === 'TokenExpiredError') {
                return res.status(401).json({ error: 'Token has expired' });
            }
            throw jwtError;
        }
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({ error: 'Authentication error occurred' });
    }
};

module.exports = auth;
